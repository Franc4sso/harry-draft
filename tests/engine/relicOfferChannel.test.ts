import { describe, it, expect } from 'vitest'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { JOKER_RELIC_IDS } from '@/data/relics'
import type { RunNode, RunState } from '@/types'

function nodeFor(i: number): RunNode {
  return { id: `a${i % 3}f${Math.floor(i / 3) % 5}n${i % 4}`, type: 'relic', next: [] }
}

function stateFor(i: number): RunState {
  return {
    seed: `seed-${i}`, phase: 'relic-node', team: [], activeSynergies: [], stage: 0, relics: [],
    map: [], currentNodeId: nodeFor(i).id, house: 'Tassorosso', area: 0, teamMax: 5, log: [], pendingLevelUps: [],
  }
}

describe('relic node channel', () => {
  it('is deterministic per node id', () => {
    const node = nodeFor(7)
    const state = stateFor(7)
    const a = relicOffer(state, node, createRng(state.seed))
    const b = relicOffer(state, node, createRng(state.seed))
    expect(a.map(r => r.id)).toEqual(b.map(r => r.id))
  })

  it('offers jokers on some nodes and relics on others across seeds', () => {
    const jokerSet = new Set(JOKER_RELIC_IDS)
    let sawJoker = false
    let sawRelic = false
    for (let i = 0; i < 40; i++) {
      const state = stateFor(i)
      const node = nodeFor(i)
      const offer = relicOffer(state, node, createRng(state.seed))
      const allJoker = offer.length > 0 && offer.every(r => jokerSet.has(r.id))
      const noJoker = offer.every(r => !jokerSet.has(r.id))
      if (allJoker) sawJoker = true
      if (noJoker) sawRelic = true
    }
    expect(sawJoker).toBe(true)
    expect(sawRelic).toBe(true)
  })
})
