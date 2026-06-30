import { describe, it, expect } from 'vitest'
import { relicResolver, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { generateArea } from '@/game/engine/map'
import type { RunState } from '@/types'

function baseState(): RunState {
  const team = offerRecruits(createRng(1), { exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(createRng(2).fork(4).fork(0), 'test', 0, { teamSize: 2, teamMax: 5 })
  const node = map.find(n => n.type === 'recruit')! // any node works for offer determinism
  return { seed: 's', phase: 'relic-node', team, activeSynergies: [], stage: 0, relics: [],
    map, currentNodeId: node.id, house: 'Tassorosso', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}

describe('relic-pick stores assignedTo', () => {
  it('assignedTo on the choice is saved on the drafted ActiveRelic', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = relicOffer(s, node, createRng(s.seed))
    const relicId = offer[0]!.id

    const out = relicResolver.resolve(s, node, { kind: 'relic-pick', relicId, assignedTo: 'voldemort' }, createRng(s.seed))
    const stored = out.relics.find(r => r.relic.id === relicId)!

    expect(stored).toBeDefined()
    expect(stored.assignedTo).toBe('voldemort')
  })

  it('no assignedTo on a normal relic-pick leaves assignedTo undefined', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = relicOffer(s, node, createRng(s.seed))
    const relicId = offer[0]!.id

    const out = relicResolver.resolve(s, node, { kind: 'relic-pick', relicId }, createRng(s.seed))
    const stored = out.relics.find(r => r.relic.id === relicId)!

    expect(stored).toBeDefined()
    expect(stored.assignedTo).toBeUndefined()
  })
})
