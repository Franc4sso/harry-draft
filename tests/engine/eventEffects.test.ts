import { describe, it, expect } from 'vitest'
import { applyEventEffects } from '@/game/engine/events'
import { startRunB, starterOffer, chooseStarters } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { RULE_BREAKING_RELIC_IDS } from '@/data/relics'
import type { EventEffect } from '@/data/events'
import type { RunState } from '@/types'

/** Build a realistic RunState with a 3-wizard team via the real house/starter flow
 *  (mirrors campaignBalanceRestricted.test.ts / useRunB.test.ts). */
function buildState(seed = 'events-test'): RunState {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Grifondoro')
  const starterIds = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 3).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starterIds, createRng(seed))
  return s
}

function weakestOf(s: RunState) {
  return [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!
}

describe('applyEventEffects', () => {
  it('healTeam raises currentHp toward maxHp, never above', () => {
    let s = buildState()
    // Damage the team first so healing has something to raise.
    s = { ...s, team: s.team.map(dw => ({ ...dw, currentHp: Math.max(1, Math.floor(dw.maxHp * 0.2)) })) }
    const r = applyEventEffects(s, [{ kind: 'healTeam', pct: 1 }], createRng('heal'))
    expect(r.state.team.length).toBe(s.team.length)
    for (const dw of r.state.team) {
      expect(dw.currentHp).toBe(dw.maxHp)
      expect(dw.currentHp).toBeLessThanOrEqual(dw.maxHp)
    }
  })

  it('damageTeam lowers currentHp but never below 1 (no kills)', () => {
    const s = buildState()
    const r = applyEventEffects(s, [{ kind: 'damageTeam', pct: 1 }], createRng('dmg'))
    expect(r.state.team.length).toBe(s.team.length)
    for (const dw of r.state.team) {
      expect(dw.currentHp).toBe(1)
      expect(dw.currentHp).toBeGreaterThanOrEqual(1)
    }
  })

  it('levelWizard raises the chosen wizard level by N', () => {
    const s = buildState()
    const target = weakestOf(s)
    const beforeLevel = target.level ?? 1
    const r = applyEventEffects(s, [{ kind: 'levelWizard', which: 'weakest', levels: 2 }], createRng('lvl'))
    const after = r.state.team.find(dw => dw.wizard.id === target.wizard.id)!
    expect(after.level).toBe(beforeLevel + 2)
    // Untouched members keep their level.
    for (const dw of r.state.team) {
      if (dw.wizard.id === target.wizard.id) continue
      const before = s.team.find(o => o.wizard.id === dw.wizard.id)!
      expect(dw.level ?? 1).toBe(before.level ?? 1)
    }
  })

  it('removeWizard + addWizard(+2) trades weakest for a new one 2 levels above the removed', () => {
    const s = buildState()
    const target = weakestOf(s)
    const weakestLevel = target.level ?? 1
    const beforeIds = new Set(s.team.map(dw => dw.wizard.id))
    const effects: EventEffect[] = [{ kind: 'removeWizard', which: 'weakest' }, { kind: 'addWizard', levelsAboveWeakest: 2 }]
    const r = applyEventEffects(s, effects, createRng('trade'))
    expect(r.state.team.length).toBe(s.team.length)
    expect(r.state.team.some(dw => dw.wizard.id === target.wizard.id)).toBe(false)
    const added = r.state.team.find(dw => !beforeIds.has(dw.wizard.id))
    expect(added).toBeTruthy()
    expect(added!.level).toBe(weakestLevel + 2)
  })

  it('grantRelic appends a rule-breaking relic', () => {
    const s = buildState()
    const r = applyEventEffects(s, [{ kind: 'grantRelic', pool: 'ruleBreaking' }], createRng('relic'))
    expect(r.state.relics.length).toBe(s.relics.length + 1)
    const added = r.state.relics[r.state.relics.length - 1]!
    expect(RULE_BREAKING_RELIC_IDS).toContain(added.relic.id)
    expect(added.stageObtained).toBe(s.stage)
  })

  it('cioccorane accumulates into cioccoraneDelta, not state', () => {
    const s = buildState()
    const r = applyEventEffects(s, [{ kind: 'cioccorane', amount: 20 }], createRng('x'))
    expect(r.cioccoraneDelta).toBe(20)
    expect(r.state).toEqual(s)
  })

  it('cioccorane amounts across multiple effects sum into cioccoraneDelta', () => {
    const s = buildState()
    const effects: EventEffect[] = [{ kind: 'cioccorane', amount: 20 }, { kind: 'cioccorane', amount: -30 }]
    const r = applyEventEffects(s, effects, createRng('y'))
    expect(r.cioccoraneDelta).toBe(-10)
  })

  it('gamble is deterministic per seed (same seed -> same branch)', () => {
    const s = buildState()
    const effects: EventEffect[] = [{
      kind: 'gamble', chance: 0.5,
      win: [{ kind: 'cioccorane', amount: 5 }],
      lose: [{ kind: 'cioccorane', amount: -5 }],
    }]
    const r1 = applyEventEffects(s, effects, createRng('gamble-seed'))
    const r2 = applyEventEffects(s, effects, createRng('gamble-seed'))
    expect(r1.cioccoraneDelta).toBe(r2.cioccoraneDelta)
    expect([5, -5]).toContain(r1.cioccoraneDelta)
  })

  it('gamble win/lose branches produce their expected effect (chance=1 always wins, chance=0 always loses)', () => {
    const s = buildState()
    const alwaysWin: EventEffect[] = [{
      kind: 'gamble', chance: 1,
      win: [{ kind: 'cioccorane', amount: 7 }],
      lose: [{ kind: 'cioccorane', amount: -7 }],
    }]
    const alwaysLose: EventEffect[] = [{
      kind: 'gamble', chance: 0,
      win: [{ kind: 'cioccorane', amount: 7 }],
      lose: [{ kind: 'cioccorane', amount: -7 }],
    }]
    expect(applyEventEffects(s, alwaysWin, createRng('w')).cioccoraneDelta).toBe(7)
    expect(applyEventEffects(s, alwaysLose, createRng('l')).cioccoraneDelta).toBe(-7)
  })
})
