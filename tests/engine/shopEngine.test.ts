import { describe, it, expect } from 'vitest'
import { leaveShop, rerollShop, registerCoreResolvers } from '@/game/engine/runEngine'
import { resolverFor } from '@/game/engine/resolvers'
import type { RunNode, RunState } from '@/types'

registerCoreResolvers()
const mk = (over: Partial<RunNode> = {}): RunState => {
  const node: RunNode = { id: 'a0f1n0', type: 'shop', next: [], ...over }
  return { seed: 's', phase: 'shop-node', team: [], activeSynergies: [], stage: 0, relics: [], map: [node], currentNodeId: 'a0f1n0', area: 0 }
}
const cur = (s: RunState) => s.map!.find(n => n.id === s.currentNodeId)!

describe('shop engine wiring', () => {
  it('registers a shop resolver', () => {
    expect(resolverFor('shop').id).toBe('shop')
  })
  it('leaveShop resolves the node and returns to the map', () => {
    const out = leaveShop(mk())
    expect(cur(out).resolved).toBe(true)
    expect(out.phase).toBe('map')
  })
  it('rerollShop bumps the counter and frees relic slots', () => {
    const out = rerollShop(mk({ shopReroll: 0, shopBought: ['relic-0', 'heal'] }))
    expect(cur(out).shopReroll).toBe(1)
    expect(cur(out).shopBought).toEqual(['heal']) // relic-* cleared, heal kept
  })
})
