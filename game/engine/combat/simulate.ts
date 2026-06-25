import type {
  ActiveRelic, ActiveSynergy, BattleResult, BattleUnit, DraftedWizard, HookCtx, LogEntry, LogFlag, Side, StepSnapshot, UnitSnapshot,
} from '@/types'
import type { Rng } from '../rng'
import { BALANCE } from '@/data/constants'
import { applyBonuses, totalRegen } from '../synergy'
import { applyRelicBonuses, registerRelicTriggers, totalRelicRegen } from '../relics'
import { registerTraitTriggers } from '../traits'
import { createEventBus } from './eventBus'
import { canAct } from '../status'
import { EFFECT_HANDLERS } from './effects'
import { effectiveStats, resolveAction, tickStatuses } from './resolve'
import { selectSpell } from './selectSpell'
import { mostWounded, selectTarget } from './targeting'

export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[], relics: ActiveRelic[] = [],
): BattleUnit[] {
  return team.map(dw => {
    const synBuffed = applyBonuses(dw.stats, synergies)
    const buffed = applyRelicBonuses(synBuffed, team, relics)
    const startHp = dw.currentHp ?? buffed.hp
    return {
      ...dw, side, buffedStats: buffed, maxHp: buffed.hp,
      hp: Math.min(buffed.hp, Math.max(0, startHp)),
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
  opts: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[]; leftRelics?: ActiveRelic[] } = {},
): BattleResult {
  const leftSyn = opts.leftSyn ?? []
  const rightSyn = opts.rightSyn ?? []
  // Relics only ever apply to the LEFT (player) team. The enemy never gets relics.
  const leftRelics = opts.leftRelics ?? []
  const L = toBattleUnits(left, 'left', leftSyn, leftRelics)
  const R = toBattleUnits(right, 'right', rightSyn)
  const regen: Record<Side, number> = {
    left: totalRegen(leftSyn) + totalRelicRegen(left, leftRelics),
    right: totalRegen(rightSyn),
  }
  const log: LogEntry[] = []
  // Per-step engine snapshots, kept 1:1 with `log` via pushLog. Each captures a DEEP COPY
  // of every unit's hp/alive/cooldowns/statusEffects at the instant the entry was pushed,
  // because cooldowns and statusEffects are mutated in place during the sim.
  const snapshots: StepSnapshot[] = []
  // unitKey inlined as `${side}:${id}` to avoid a circular import (replay.ts imports
  // toBattleUnits from this module, so importing unitKey back would cycle).
  const captureSnapshot = (): StepSnapshot => {
    const snap: StepSnapshot = {}
    for (const u of [...L, ...R]) {
      snap[`${u.side}:${u.wizard.id}`] = {
        hp: Math.max(0, u.hp),
        alive: u.alive,
        cooldowns: { ...u.cooldowns },
        statusEffects: u.statusEffects.map(e => ({ ...e })),
      }
    }
    return snap
  }
  const pushLog = (entry: LogEntry) => { log.push(entry); snapshots.push(captureSnapshot()) }
  // Score keyed by "side:wizard.id" to avoid merging same-id wizards on opposite teams
  const score: Record<string, number> = {}

  const sync = (u: BattleUnit) => { if (u.hp <= 0) { u.hp = 0; u.alive = false } }
  const sideUnits = (s: Side) => (s === 'left' ? L : R).filter(u => u.alive)

  // Relic triggers dispatch through the EventBus. Only the LEFT team carries relics.
  const bus = createEventBus()
  registerRelicTriggers(bus, left, leftRelics)
  registerTraitTriggers(bus, [...L, ...R])

  // Apply a collected reactive hook for `unit`. Guarded by collectReactive().length
  // so a zero-listener hook draws NO rng and emits NO log line — preserving every
  // existing battle's rng stream byte-for-byte.
  const fireReactive = (hook: 'onHeal' | 'onDeath' | 'onAllyDeath' | 'onHpThreshold' | 'onTurnStart' | 'onTurnEnd', unit: BattleUnit, t: number, hpPct?: number) => {
    const ctx: HookCtx = { turn: t, actor: unit, side: unit.side, flags: [], hpPct }
    const specs = bus.collectReactive(hook, ctx)
    if (specs.length === 0) return
    for (const eff of specs) {
      const flags: LogFlag[] = []
      const r = EFFECT_HANDLERS[eff.kind]({ rng, turn: t, actor: unit, target: unit, flags }, eff)
      // Mirror the onBattleStart block: log every reactive effect as a 'Reliquia'
      // system entry so buildReplay (which reconstructs HP from logged values) stays
      // in parity with live combat for any HP-changing effect.
      pushLog({
        turn: t, actorId: unit.wizard.id, actorSide: unit.side, action: 'Reliquia',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'system', value: r.value, flags,
      })
    }
  }
  // onHpThreshold fires once per downward crossing per unit; key `${side}:${id}:${threshold}`.
  // The threshold fractions come straight from the left relics' onHpThreshold triggers
  // (only the LEFT team carries relics). When none exist this stays empty → no rng, no log.
  const registeredThresholds = leftRelics.flatMap(({ relic }) =>
    (relic.triggers ?? [])
      .filter(t => t.hook === 'onHpThreshold' && typeof t.threshold === 'number')
      .map(t => t.threshold!),
  )
  const firedThresholds = new Set<string>()
  const checkThreshold = (unit: BattleUnit, t: number) => {
    if (registeredThresholds.length === 0 || unit.maxHp <= 0) return
    const pct = Math.max(0, unit.hp) / unit.maxHp
    for (const trig of registeredThresholds) {
      const key = `${unit.side}:${unit.wizard.id}:${trig}`
      if (pct < trig && !firedThresholds.has(key)) {
        firedThresholds.add(key)
        fireReactive('onHpThreshold', unit, t, pct)
      }
    }
  }

  // onBattleStart: apply collected specs to every left unit.
  // Old order was relic→effect→unit (effect-outer, unit-inner). collectReactive gives us
  // the flat spec list in relic→trigger→effect order; apply each spec across all units
  // to preserve the exact rng draw sequence.
  {
    const ctx0 = (u: BattleUnit): HookCtx => ({ turn: 0, actor: u, side: 'left', flags: [] })
    const specs = bus.collectReactive('onBattleStart', ctx0(L[0] ?? ({} as BattleUnit)))
    for (const eff of specs) {
      for (const unit of L) {
        const flags: LogFlag[] = []
        const r = EFFECT_HANDLERS[eff.kind]({ rng, turn: 0, actor: unit, target: unit, flags }, eff)
        pushLog({
          turn: 0, actorId: unit.wizard.id, actorSide: unit.side, action: 'Reliquia',
          targetId: unit.wizard.id, targetSide: unit.side, type: 'system', value: r.value, flags,
        })
      }
    }
  }

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
      // onTurnStart: top of each LEFT unit's turn, before it acts (fires even if
      // stunned). Gated by collectReactive().length so zero-listener = no rng/no log.
      fireReactive('onTurnStart', actor, turn)
      if (!canAct(actor)) {
        // Do NOT manually decrement here — tickStatuses at end-of-turn handles all status decrements uniformly.
        pushLog({ turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'Stordito', type: 'system', flags: ['stun'] })
        fireReactive('onTurnEnd', actor, turn)
        continue
      }
      const allies = actor.side === 'left' ? L : R
      const enemies = actor.side === 'left' ? R : L
      const spell = selectSpell(actor)
      const healIntent = spell.type === 'Cura'
      const target = selectTarget(actor, allies, enemies, spell)
      if (!target) { fireReactive('onTurnEnd', actor, turn); continue }
      const realTarget = healIntent
        ? (mostWounded(allies.filter(a => a.alive)) ?? actor)
        : (spell.type === 'Difesa' ? actor : target)
      const entry = resolveAction(rng, turn, actor, realTarget, spell, bus)
      pushLog(entry)
      // onHit: after an actor resolves a spell against an ENEMY target.
      if (realTarget.side !== actor.side) {
        const hitCtx: HookCtx = { turn, actor, target: realTarget, side: actor.side, flags: [] }
        for (const eff of bus.collectReactive('onHit', hitCtx)) {
          EFFECT_HANDLERS[eff.kind]({ rng, turn, actor, target: realTarget, flags: hitCtx.flags }, eff)
        }
      }
      // onHeal: after a heal resolves on any target.
      if (entry.flags.includes('heal')) {
        fireReactive('onHeal', realTarget, turn)
      }
      if (entry.value) {
        const scoreKey = `${actor.side}:${actor.wizard.id}`
        score[scoreKey] = (score[scoreKey] ?? 0) + entry.value
      }
      sync(realTarget)
      if (!realTarget.alive && entry.flags.includes('heal') === false) {
        pushLog({
          turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'KO',
          targetId: realTarget.wizard.id, targetSide: realTarget.side, type: 'system', flags: ['kill'],
        })
      }
      // onDeath / onAllyDeath: after sync, when any unit just died.
      if (!realTarget.alive) {
        fireReactive('onDeath', realTarget, turn)
        const allyPool = realTarget.side === 'left' ? L : R
        for (const ally of allyPool) {
          if (ally.alive && ally !== realTarget) fireReactive('onAllyDeath', ally, turn)
        }
      }
      // onHpThreshold: HP of the target changed this action.
      checkThreshold(realTarget, turn)
      // onTurnEnd: after an actor finishes acting.
      fireReactive('onTurnEnd', actor, turn)
    }
    // end-of-turn: dot/cooldown tick + regen
    for (const u of [...L, ...R]) {
      if (!u.alive) continue
      const dots = tickStatuses(turn, u)
      for (const d of dots) pushLog(d)
      sync(u)
      // onDeath / onAllyDeath when a dot tick kills any unit.
      if (!u.alive) {
        fireReactive('onDeath', u, turn)
        const allyPool = u.side === 'left' ? L : R
        for (const ally of allyPool) {
          if (ally.alive && ally !== u) fireReactive('onAllyDeath', ally, turn)
        }
      }
      if (u.alive && regen[u.side] > 0) {
        const before = u.hp
        u.hp = Math.min(u.maxHp, u.hp + regen[u.side])
        const healed = u.hp - before
        // Log the actual healed amount (0 when already at full HP) so buildReplay —
        // which reconstructs HP from log deltas — reflects regen and stays in sync.
        if (healed > 0) {
          pushLog({
            turn, actorId: u.wizard.id, actorSide: u.side, action: 'Rigenera',
            targetId: u.wizard.id, targetSide: u.side, type: 'Cura', value: healed, flags: ['heal'],
          })
        }
      }
      // Anti-stall fatigue: escalating TRUE damage past fatigueStart, ignoring
      // def/shields/regen so defensive stalemates always converge before turnCap.
      if (u.alive && turn > BALANCE.combat.fatigueStart) {
        const dmg = Math.round(u.maxHp * BALANCE.combat.fatiguePctStep * (turn - BALANCE.combat.fatigueStart))
        if (dmg > 0) {
          u.hp = Math.max(0, u.hp - dmg)
          pushLog({
            turn, actorId: u.wizard.id, actorSide: u.side, action: 'Fatica',
            targetId: u.wizard.id, targetSide: u.side, type: 'system', value: dmg, flags: ['dot'],
          })
          sync(u)
          if (!u.alive) {
            fireReactive('onDeath', u, turn)
            const allyPool = u.side === 'left' ? L : R
            for (const ally of allyPool) {
              if (ally.alive && ally !== u) fireReactive('onAllyDeath', ally, turn)
            }
          }
        }
      }
      // onHpThreshold after dot + regen settle this unit's HP for the turn.
      if (u.alive) checkThreshold(u, turn)
    }
  }

  const leftAlive = sideUnits('left').length
  const rightAlive = sideUnits('right').length
  let winner: Side
  if (leftAlive && !rightAlive) winner = 'left'
  else if (rightAlive && !leftAlive) winner = 'right'
  else winner = totalHpPct(L) >= totalHpPct(R) ? 'left' : 'right'

  const snapshot: UnitSnapshot[] = [...L, ...R].map(u => ({
    id: u.wizard.id, side: u.side, hp: Math.max(0, u.hp), maxHp: u.maxHp, alive: u.alive,
  }))
  const mvpScoreKey = Object.entries(score).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  // Strip "side:" prefix to get plain wizard.id
  const mvpId = mvpScoreKey
    ? mvpScoreKey.split(':').slice(1).join(':')
    : (winner === 'left' ? L[0]!.wizard.id : R[0]!.wizard.id)

  return { winner, turns: turn, log, mvpId, finalSnapshot: snapshot, snapshots }
}
