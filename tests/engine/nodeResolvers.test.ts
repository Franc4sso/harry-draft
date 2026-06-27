import { describe, it, expect } from 'vitest'
import { recruitResolver, recruitOffer, relicResolver, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { generateArea } from '@/game/engine/map'
import type { RunState } from '@/types'

function baseState(): RunState {
  const team = offerRecruits(createRng(1), { house: 'Tassorosso', exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(createRng(2).fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
  const recruitNode = map.find(n => n.type === 'recruit')!
  return { seed: 's', phase: 'recruit-node', team, activeSynergies: [], stage: 0, relics: [],
    map, currentNodeId: recruitNode.id, house: 'Tassorosso', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}

describe('recruit resolver', () => {
  it('offers 3 distinct candidates, none already on the team', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = recruitOffer(s, node, createRng(s.seed))
    expect(offer).toHaveLength(3)
    const teamIds = new Set(s.team.map(t => t.wizard.id))
    expect(offer.every(o => !teamIds.has(o.wizard.id))).toBe(true)
  })
  it('adds the picked wizard when the team has room, with provenance', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = recruitOffer(s, node, createRng(s.seed))
    const next = recruitResolver.resolve(s, node, { kind: 'recruit-pick', wizardId: offer[0]!.wizard.id }, createRng(s.seed))
    expect(next.team).toHaveLength(3)
    expect(next.team.find(t => t.wizard.id === offer[0]!.wizard.id)?.recruitedVia).toBe('Reclutamento')
  })
  it('replaces a member when the team is full', () => {
    const s = baseState()
    // pad team to teamMax
    const filler = offerRecruits(createRng(9), { house: 'Grifondoro', exclude: new Set(s.team.map(t => t.wizard.id)) })
    s.team = [...s.team, ...filler].slice(0, 5)
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = recruitOffer(s, node, createRng(s.seed))
    const outId = s.team[0]!.wizard.id
    const next = recruitResolver.resolve(s, node, { kind: 'recruit-pick', wizardId: offer[0]!.wizard.id, replaceId: outId }, createRng(s.seed))
    expect(next.team).toHaveLength(5)
    expect(next.team.some(t => t.wizard.id === outId)).toBe(false)
  })
})

describe('relic resolver', () => {
  it('offers relics and appends the picked one', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')! // any node id works for determinism here
    const offer = relicOffer(s, node, createRng(s.seed))
    expect(offer.length).toBeGreaterThan(0)
    const next = relicResolver.resolve(s, node, { kind: 'relic-pick', relicId: offer[0]!.id }, createRng(s.seed))
    expect(next.relics).toHaveLength(s.relics.length + 1)
  })
})
