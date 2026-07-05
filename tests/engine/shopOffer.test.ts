import { describe, it, expect } from 'vitest'
import { shopOffer, priceForRelic } from '@/game/engine/resolvers/shop'
import { createRng } from '@/game/engine/rng'
import type { RunNode, RunState } from '@/types'
import { BALANCE } from '@/data/constants'

const node = (over: Partial<RunNode> = {}): RunNode => ({ id: 'a0f1n0', type: 'shop', next: [], ...over })
const state = (): RunState => ({ seed: 's', phase: 'shop-node', team: [], activeSynergies: [], stage: 0, relics: [], area: 0 })

describe('shopOffer', () => {
  it('is deterministic per (seed, node, reroll) and has 3 relics + heal + removeWizard', () => {
    const a = shopOffer(state(), node(), createRng('s'))
    const b = shopOffer(state(), node(), createRng('s'))
    expect(a.slots.map(s => s.id)).toEqual(b.slots.map(s => s.id))
    expect(a.slots.filter(s => s.kind === 'relic')).toHaveLength(3)
    expect(a.slots.find(s => s.id === 'heal')?.price).toBe(BALANCE.shop.heal)
    expect(a.slots.find(s => s.id === 'removeWizard')?.price).toBe(BALANCE.shop.removeWizard)
    expect(a.rerollPrice).toBe(BALANCE.shop.reroll)
  })
  it('a reroll changes the relic stock', () => {
    const a = shopOffer(state(), node({ shopReroll: 0 }), createRng('s'))
    const c = shopOffer(state(), node({ shopReroll: 1 }), createRng('s'))
    const ids = (x: typeof a) => x.slots.filter(s => s.kind === 'relic').map(s => s.relic!.id).join(',')
    expect(ids(a)).not.toBe(ids(c))
  })
  it('prices relics by rarity', () => {
    const a = shopOffer(state(), node(), createRng('s'))
    for (const s of a.slots.filter(s => s.kind === 'relic')) {
      expect(s.price).toBe(priceForRelic(s.relic!))
      expect(s.price).toBe(BALANCE.shop.relicByRarity[s.relic!.rarity])
    }
  })
})
