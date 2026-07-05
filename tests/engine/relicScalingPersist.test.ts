import { describe, it, expect } from 'vitest'
import { applyRelicScaling, applyRelicBonuses } from '@/game/engine/relics'
import { combatResolver } from '@/game/engine/resolvers/combat'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
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
