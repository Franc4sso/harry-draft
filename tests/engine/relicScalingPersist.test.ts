import { describe, it, expect } from 'vitest'
import { applyRelicScaling, applyRelicBonuses } from '@/game/engine/relics'
import { combatResolver } from '@/game/engine/resolvers/combat'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import { startRunB } from '@/game/engine/runEngine'
import type { ActiveRelic, Relic, RunNode, RunState, Stats } from '@/types'

const joker: Relic = {
  id: 'j', name: 'J', desc: '', rarity: 'epica',
  scaling: { trigger: 'kill', stat: 'attack', per: 2, cap: 20 },
}
const plain: Relic = { id: 'p', name: 'P', desc: '', rarity: 'comune' }

describe('applyRelicScaling', () => {
  it('increments runCounter only for scaling relics', () => {
    const relics: ActiveRelic[] = [
      { relic: joker, stageObtained: 0, runCounter: 3 },
      { relic: plain, stageObtained: 0 },
    ]
    const out = applyRelicScaling(relics, 4)
    expect(out[0]!.runCounter).toBe(7)          // 3 + 4
    expect(out[1]!.runCounter).toBeUndefined()  // plain relic untouched
  })

  it('treats undefined runCounter as 0', () => {
    const out = applyRelicScaling([{ relic: joker, stageObtained: 0 }], 2)
    expect(out[0]!.runCounter).toBe(2)
  })

  it('is a no-op for zero kills', () => {
    const out = applyRelicScaling([{ relic: joker, stageObtained: 0, runCounter: 5 }], 0)
    expect(out[0]!.runCounter).toBe(5)
  })
})

// --- Resolver write-back (end-to-end): a carried joker's runCounter must
// survive resolveCombat/combatResolver.resolve and feed back into read-time
// bonuses. RELIC_BY_ID['fame-vorace'] does not exist yet (jokers land in Task
// 4), so this uses an inline test relic literal with a `scaling` descriptor.
function team(ids: string[], seed: number) {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('relic scaling persists through the combat resolver', () => {
  it("carrier's runCounter grows by kills.left after a resolved combat node, and read-time bonus reflects it", () => {
    // Strong left trio vs a single weak right unit: a clean, deterministic wipe
    // (mirrors tests/engine/killCount.test.ts), so kills.left is known and > 0.
    const left = team(['harry', 'ron', 'hermione'], 1)
    const right = team(['eloise'], 2)
    const testJoker: Relic = {
      id: 'test-joker', name: 'T', desc: '', rarity: 'epica',
      scaling: { trigger: 'kill', stat: 'attack', per: 2, cap: 20 },
    }
    const carrier: ActiveRelic = { relic: testJoker, stageObtained: 0, runCounter: 3 }
    const state: RunState = {
      seed: 's', phase: 'battle', team: left, activeSynergies: [], stage: 0,
      relics: [carrier],
    }
    const node: RunNode = {
      id: 'a0f0n0', type: 'battle', next: [],
      battle: { enemyTeam: right, enemyRelics: [], enemyLevel: 1 },
    }

    const out = combatResolver.resolve(state, node, { kind: 'combat-ack' }, createRng('kill-seed'))

    const kills = out.lastBattle!.kills.left
    expect(kills).toBe(right.length) // clean wipe — proves this isn't a zero-kill no-op

    const updated = out.relics.find(r => r.relic.id === 'test-joker')!
    expect(updated.runCounter).toBe(3 + kills) // persisted across the resolver, not reset

    const base: Stats = { hp: 100, atk: 50, def: 10, spd: 10 }
    const bonused = applyRelicBonuses(base, [], out.relics)
    const expectedBonus = Math.min(updated.runCounter! * 2, 20) // per=2, cap=20
    expect(bonused.atk).toBe(base.atk + expectedBonus)
  })

  it('a resolve that yields zero kills.left leaves the carrier runCounter untouched (no false accumulation)', () => {
    // Flip the matchup so the left side is wiped instead: kills.left is 0 and the
    // relic scaling passthrough must be a true no-op, not silently reset either.
    const left = team(['eloise'], 1)
    const right = team(['harry', 'ron', 'hermione'], 2)
    const testJoker: Relic = {
      id: 'test-joker', name: 'T', desc: '', rarity: 'epica',
      scaling: { trigger: 'kill', stat: 'attack', per: 2, cap: 20 },
    }
    const carrier: ActiveRelic = { relic: testJoker, stageObtained: 0, runCounter: 5 }
    const state: RunState = {
      seed: 's', phase: 'battle', team: left, activeSynergies: [], stage: 0,
      relics: [carrier],
    }
    const node: RunNode = {
      id: 'a0f0n0', type: 'battle', next: [],
      battle: { enemyTeam: right, enemyRelics: [], enemyLevel: 1 },
    }

    const out = combatResolver.resolve(state, node, { kind: 'combat-ack' }, createRng('kill-seed-2'))

    expect(out.lastBattle!.kills.left).toBe(0)
    const updated = out.relics.find(r => r.relic.id === 'test-joker')!
    expect(updated.runCounter).toBe(5) // unchanged, not reset to 0 either
  })
})

// --- Real joker end-to-end (Task 4 landed the actual data): a carried
// 'fame-vorace' joker persists its runCounter across the resolver and its
// read-time attack bonus reflects the accumulated kills, capped per the
// relic's own descriptor. Also verifies a freshly-started run's relics carry
// no runCounter (nothing to reset — the field just isn't there yet).
describe('a real scaling joker (fame-vorace) persists through a run', () => {
  it("carrier's runCounter grows by kills.left and applyRelicBonuses reflects +2*runCounter attack (capped at 20)", () => {
    const left = team(['harry', 'ron', 'hermione'], 1)
    const right = team(['eloise'], 2)
    const carrier: ActiveRelic = { relic: RELIC_BY_ID['fame-vorace']!, stageObtained: 0, runCounter: 0 }
    const state: RunState = {
      seed: 's', phase: 'battle', team: left, activeSynergies: [], stage: 0,
      relics: [carrier],
    }
    const node: RunNode = {
      id: 'a0f0n0', type: 'battle', next: [],
      battle: { enemyTeam: right, enemyRelics: [], enemyLevel: 1 },
    }

    const out = combatResolver.resolve(state, node, { kind: 'combat-ack' }, createRng('kill-seed'))

    const kills = out.lastBattle!.kills.left
    expect(kills).toBe(right.length) // clean wipe

    const updated = out.relics.find(r => r.relic.id === 'fame-vorace')!
    expect(updated.runCounter).toBe(0 + kills)

    const base: Stats = { hp: 100, atk: 50, def: 10, spd: 10 }
    const bonused = applyRelicBonuses(base, [], out.relics)
    const expectedBonus = Math.min(updated.runCounter! * 2, 20) // per=2, cap=20
    expect(bonused.atk).toBe(base.atk + expectedBonus)
  })

  it("starting a fresh run does not inherit a prior run's relics or runCounter (within-run only, resets each run)", () => {
    // Build a prior run carrying a scaling relic with a real, non-zero runCounter — this is
    // what a vacuous "fresh.relics is []" check would silently pass against without ever
    // exercising the reset semantics.
    const priorRelics: ActiveRelic[] = [
      { relic: RELIC_BY_ID['fame-vorace']!, stageObtained: 0, runCounter: 15 },
    ]
    const priorRun: RunState = {
      seed: 'prior-seed', phase: 'battle', team: [], activeSynergies: [], stage: 0,
      relics: priorRelics,
    }
    // Sanity: the prior run really does carry a non-zero counter (guards against a vacuous fixture).
    expect(priorRun.relics[0]!.runCounter).toBe(15)

    const fresh = startRunB('fresh-seed')

    // The fresh run must not inherit the prior run's relics array, its reference, or the
    // carried runCounter — relic scaling is within-run only and resets every run. A future
    // change that seeds starter relics into a new run without stripping runCounter would
    // fail this assertion (unlike the old vacuous "every relic has no runCounter" check,
    // which trivially passed because startRunB always returned an empty relics array).
    expect(fresh.relics).toEqual([])
    expect(fresh.relics).not.toBe(priorRun.relics)
    expect(fresh.relics.some(r => r.relic.id === 'fame-vorace')).toBe(false)
  })
})
