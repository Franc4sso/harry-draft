import { describe, it, expect } from 'vitest'
import { relicResolver, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { generateArea } from '@/game/engine/map'
import { RELICS, JOKER_RELIC_IDS, SACRIFICE_RELIC_IDS } from '@/data/relics'
import type { ActiveRelic, RunState } from '@/types'

function fiveOwned(excludeIds: Set<string>): ActiveRelic[] {
  const pool = RELICS.filter(r => !JOKER_RELIC_IDS.includes(r.id) && !SACRIFICE_RELIC_IDS.includes(r.id) && !excludeIds.has(r.id))
  return pool.slice(0, 5).map((relic, i) => ({ relic, stageObtained: i }))
}

function baseState(): RunState {
  const team = offerRecruits(createRng(1), { exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale', 1))
  const map = generateArea(createRng(2).fork(4).fork(0), 'test', 0, { teamSize: 2, teamMax: 5 })
  const node = map.find(n => n.type === 'relic')!
  const relics = fiveOwned(new Set())
  return { seed: 's', phase: 'relic-node', team, activeSynergies: [], stage: 0, relics,
    map, currentNodeId: node.id, house: 'Tassorosso', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}

describe('relicResolver at the cap', () => {
  it('replaces the chosen owned relic when replaceRelicId is given', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'relic')!
    const offer = relicOffer(s, node, createRng(s.seed)).filter(r => !s.relics.some(a => a.relic.id === r.id))
    const offered = offer[0]!.id
    const replaceId = s.relics[0]!.relic.id

    const out = relicResolver.resolve(s, node, { kind: 'relic-pick', relicId: offered, replaceRelicId: replaceId }, createRng(s.seed))

    expect(out.relics).toHaveLength(5)
    expect(out.relics.some(a => a.relic.id === replaceId)).toBe(false)
    expect(out.relics.some(a => a.relic.id === offered)).toBe(true)
  })

  it('is a reference-equal no-op at the cap without replaceRelicId', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'relic')!
    const offer = relicOffer(s, node, createRng(s.seed)).filter(r => !s.relics.some(a => a.relic.id === r.id))
    const offered = offer[0]!.id

    const out = relicResolver.resolve(s, node, { kind: 'relic-pick', relicId: offered }, createRng(s.seed))

    expect(out).toBe(s)
  })

  it('preserves assignedTo on the swapped-in relic', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'relic')!
    const offer = relicOffer(s, node, createRng(s.seed)).filter(r => !s.relics.some(a => a.relic.id === r.id))
    const offered = offer[0]!.id
    const replaceId = s.relics[0]!.relic.id
    const carrier = s.team[0]!.wizard.id

    const out = relicResolver.resolve(
      s, node, { kind: 'relic-pick', relicId: offered, replaceRelicId: replaceId, assignedTo: carrier }, createRng(s.seed),
    )
    const stored = out.relics.find(a => a.relic.id === offered)!
    expect(stored.assignedTo).toBe(carrier)
  })
})
