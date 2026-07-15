import type { DraftedWizard, RunState } from '@/types'
import type { EventEffect } from '@/data/events'
import type { Rng } from './rng'
import { gainLevels } from './leveling'
import { recruitVia } from './recruit'
import { createDraftPool } from './draft'
import { draftWizard } from './statRoll'
import { powerOf } from './combat/teamGen'
import { RELIC_BY_ID, RULE_BREAKING_RELIC_IDS } from '@/data/relics'
import { applySacrificeCost } from './sacrifice'

export interface EventEffectResult {
  state: RunState
  cioccoraneDelta: number
  log: string[]
}

function currentHp(dw: DraftedWizard): number {
  return dw.currentHp ?? dw.maxHp
}

/** Pick a team member by the given selection strategy. `weakest`/`strongest` rank by
 *  `powerOf` (raw stat power); `random` draws via `rng.pick`. Undefined on an empty team. */
function pickWizard(
  team: DraftedWizard[], which: 'weakest' | 'strongest' | 'random', rng: Rng,
): DraftedWizard | undefined {
  if (team.length === 0) return undefined
  if (which === 'random') return rng.pick(team)
  const sorted = [...team].sort((a, b) => powerOf(a) - powerOf(b))
  return which === 'weakest' ? sorted[0] : sorted[sorted.length - 1]
}

/**
 * Pure reducer: applies a list of event-choice effects to a RunState. Deterministic
 * given `rng` (no Date.now/Math.random). `cioccorane` effects never touch `state` —
 * they accumulate into `cioccoraneDelta`, which the controller applies to wallet.
 */
export function applyEventEffects(state: RunState, effects: EventEffect[], rng: Rng): EventEffectResult {
  let s = state
  let cioccoraneDelta = 0
  const log: string[] = []
  let gambleSalt = 0

  // `addWizard` levels the new recruit relative to the team's weakest member BEFORE
  // any removeWizard in this same effect list runs (captured once, up front).
  const preWeakest = pickWizard(state.team, 'weakest', rng)
  const preWeakestLevel = preWeakest?.level ?? 1

  for (const effect of effects) {
    switch (effect.kind) {
      case 'healTeam': {
        if (s.team.length === 0) break
        const team = s.team.map(dw => {
          if (dw.corrotto) return dw
          const healed = Math.min(dw.maxHp, currentHp(dw) + Math.round(dw.maxHp * effect.pct))
          return { ...dw, currentHp: healed }
        })
        s = { ...s, team }
        log.push(`healTeam pct=${effect.pct}`)
        break
      }
      case 'damageTeam': {
        if (s.team.length === 0) break
        const team = s.team.map(dw => {
          const dmg = Math.round(dw.maxHp * effect.pct)
          const hurt = Math.max(1, currentHp(dw) - dmg) // never kills
          return { ...dw, currentHp: hurt }
        })
        s = { ...s, team }
        log.push(`damageTeam pct=${effect.pct}`)
        break
      }
      case 'levelWizard': {
        const target = pickWizard(s.team, effect.which, rng)
        if (!target) break
        const { dw } = gainLevels(target, effect.levels)
        s = { ...s, team: s.team.map(m => (m.wizard.id === target.wizard.id ? dw : m)) }
        log.push(`levelWizard ${effect.which} +${effect.levels}`)
        break
      }
      case 'removeWizard': {
        const target = pickWizard(s.team, effect.which, rng)
        if (!target) break
        s = { ...s, team: s.team.filter(m => m.wizard.id !== target.wizard.id) }
        log.push(`removeWizard ${effect.which} (${target.wizard.id})`)
        break
      }
      case 'addWizard': {
        if (s.runModifiers?.noRecruits) { log.push('addWizard blocked (noRecruits)'); break }
        const excludeIds = new Set(s.team.map(dw => dw.wizard.id))
        const pool = createDraftPool().filter(w => !excludeIds.has(w.id))
        if (pool.length === 0) break
        const wizard = rng.pick(pool)
        const drafted = draftWizard(rng, wizard, true)
        const targetLevel = preWeakestLevel + effect.levelsAboveWeakest
        const recruited = recruitVia(drafted, 'evento', targetLevel)
        s = { ...s, team: [...s.team, recruited] }
        log.push(`addWizard ${wizard.id} level=${recruited.level}`)
        break
      }
      case 'grantRelic': {
        if (effect.pool !== 'ruleBreaking') break
        const owned = new Set(s.relics.map(a => a.relic.id))
        const notOwned = RULE_BREAKING_RELIC_IDS.filter(id => !owned.has(id))
        const candidates = notOwned.length > 0 ? notOwned : RULE_BREAKING_RELIC_IDS
        const pickedId = rng.pick(candidates)
        const relic = RELIC_BY_ID[pickedId]
        if (!relic) break
        s = { ...s, relics: [...s.relics, { relic, stageObtained: s.stage }] }
        log.push(`grantRelic ${pickedId}`)
        break
      }
      case 'cioccorane': {
        cioccoraneDelta += effect.amount
        log.push(`cioccorane ${effect.amount}`)
        break
      }
      case 'gamble': {
        const forked = rng.fork(gambleSalt++)
        const won = forked.chance(effect.chance)
        const branch = won ? effect.win : effect.lose
        const sub = applyEventEffects(s, branch, forked)
        s = sub.state
        cioccoraneDelta += sub.cioccoraneDelta
        log.push(`gamble chance=${effect.chance} -> ${won ? 'win' : 'lose'}`, ...sub.log)
        break
      }
      case 'sacrificeCost': {
        const paid = applySacrificeCost(s, effect.cost)
        if (paid === s) { log.push(`sacrificeCost UNPAYABLE ${effect.cost.kind}`); break }
        s = paid
        log.push(`sacrificeCost ${effect.cost.kind}`)
        break
      }
      case 'setRunModifier': {
        s = { ...s, runModifiers: { ...s.runModifiers, [effect.modifier]: true } }
        log.push(`setRunModifier ${effect.modifier}`)
        break
      }
      case 'buffTeamPct': {
        const m = 1 + effect.pct
        const team = s.team.map(dw => ({
          ...dw,
          stats: { hp: Math.round(dw.stats.hp * m), atk: Math.round(dw.stats.atk * m),
                   def: Math.round(dw.stats.def * m), spd: Math.round(dw.stats.spd * m) },
          maxHp: Math.round(dw.maxHp * m),
        }))
        s = { ...s, team }
        log.push(`buffTeamPct ${effect.pct}`)
        break
      }
    }
  }

  return { state: s, cioccoraneDelta, log }
}
