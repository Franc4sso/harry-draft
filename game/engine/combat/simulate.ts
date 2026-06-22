import type {
  ActiveSynergy, BattleResult, BattleUnit, DraftedWizard, LogEntry, Side, UnitSnapshot,
} from '@/types'
import type { Rng } from '../rng'
import { BALANCE } from '@/data/constants'
import { applyBonuses, totalRegen } from '../synergy'
import { canAct } from '../status'
import { effectiveStats, resolveAction, tickStatuses } from './resolve'
import { selectSpell } from './selectSpell'
import { mostWounded, selectTarget } from './targeting'

export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[],
): BattleUnit[] {
  return team.map(dw => {
    const buffed = applyBonuses(dw.stats, synergies)
    return {
      ...dw, side, buffedStats: buffed, maxHp: buffed.hp, hp: buffed.hp,
      cooldowns: {}, statusEffects: [], alive: true,
    }
  })
}

function totalHpPct(units: BattleUnit[]): number {
  const max = units.reduce((s, u) => s + u.maxHp, 0)
  const cur = units.reduce((s, u) => s + Math.max(0, u.hp), 0)
  return max === 0 ? 0 : cur / max
}

export function simulateBattle(
  left: DraftedWizard[],
  right: DraftedWizard[],
  rng: Rng,
  opts: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[] } = {},
): BattleResult {
  const leftSyn = opts.leftSyn ?? []
  const rightSyn = opts.rightSyn ?? []
  const L = toBattleUnits(left, 'left', leftSyn)
  const R = toBattleUnits(right, 'right', rightSyn)
  const regen: Record<Side, number> = { left: totalRegen(leftSyn), right: totalRegen(rightSyn) }
  const log: LogEntry[] = []
  // Score keyed by "side:wizard.id" to avoid merging same-id wizards on opposite teams
  const score: Record<string, number> = {}

  const sync = (u: BattleUnit) => { if (u.hp <= 0) { u.hp = 0; u.alive = false } }
  const sideUnits = (s: Side) => (s === 'left' ? L : R).filter(u => u.alive)

  let turn = 0
  while (turn < BALANCE.combat.turnCap && sideUnits('left').length && sideUnits('right').length) {
    turn++
    const order = [...L, ...R].filter(u => u.alive).sort((a, b) =>
      effectiveStats(b).spd - effectiveStats(a).spd ||
      a.wizard.id.localeCompare(b.wizard.id) ||
      a.side.localeCompare(b.side),
    )
    for (const actor of order) {
      if (!actor.alive) continue
      if (!canAct(actor)) {
        // Do NOT manually decrement here — tickStatuses at end-of-turn handles all status decrements uniformly.
        log.push({ turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'Stordito', type: 'system', flags: ['stun'] })
        continue
      }
      const allies = actor.side === 'left' ? L : R
      const enemies = actor.side === 'left' ? R : L
      const spell = selectSpell(actor)
      const healIntent = spell.type === 'Cura'
      const target = selectTarget(actor, allies, enemies)
      if (!target) continue
      const realTarget = healIntent
        ? (mostWounded(allies.filter(a => a.alive)) ?? actor)
        : (spell.type === 'Difesa' ? actor : target)
      const entry = resolveAction(rng, turn, actor, realTarget, spell)
      log.push(entry)
      if (entry.value) {
        const scoreKey = `${actor.side}:${actor.wizard.id}`
        score[scoreKey] = (score[scoreKey] ?? 0) + entry.value
      }
      sync(realTarget)
      if (!realTarget.alive && entry.flags.includes('heal') === false) {
        log.push({
          turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'KO',
          targetId: realTarget.wizard.id, targetSide: realTarget.side, type: 'system', flags: ['kill'],
        })
      }
    }
    // end-of-turn: dot/cooldown tick + regen
    for (const u of [...L, ...R]) {
      if (!u.alive) continue
      const dots = tickStatuses(turn, u)
      for (const d of dots) log.push(d)
      sync(u)
      if (u.alive && regen[u.side] > 0) u.hp = Math.min(u.maxHp, u.hp + regen[u.side])
    }
  }

  const leftAlive = sideUnits('left').length
  const rightAlive = sideUnits('right').length
  let winner: Side
  if (leftAlive && !rightAlive) winner = 'left'
  else if (rightAlive && !leftAlive) winner = 'right'
  else winner = totalHpPct(L) >= totalHpPct(R) ? 'left' : 'right'

  const snapshot: UnitSnapshot[] = [...L, ...R].map(u => ({
    id: u.wizard.id, hp: Math.max(0, u.hp), maxHp: u.maxHp, alive: u.alive,
  }))
  const mvpScoreKey = Object.entries(score).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  // Strip "side:" prefix to get plain wizard.id
  const mvpId = mvpScoreKey
    ? mvpScoreKey.split(':').slice(1).join(':')
    : (winner === 'left' ? L[0]!.wizard.id : R[0]!.wizard.id)

  return { winner, turns: turn, log, mvpId, finalSnapshot: snapshot }
}
