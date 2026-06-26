import { describe, it, expect } from 'vitest'
import { resolveCombat } from '@/game/engine/resolvers/combat'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import type { RunState, RunNode } from '@/types'

function starterState(): RunState {
  const team = offerRecruits(createRng(1), { house: 'Serpeverde', exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(createRng(1).fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
  return { seed: 's', phase: 'map', team, activeSynergies: [], stage: 0, relics: [],
    map, currentNodeId: map[0]!.id, house: 'Serpeverde', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}
const firstBattleNode = (s: RunState): RunNode =>
  s.map!.find(n => n.type === 'battle' && n.id !== s.currentNodeId) ?? s.map!.find(n => n.type === 'battle')!

describe('resolveCombat', () => {
  it('returns a battle result and awards positive EXP to survivors', () => {
    const s = starterState()
    const node = firstBattleNode(s)
    const out = resolveCombat(s, node, createRng('s').fork(2))
    expect(out.result.winner === 'left' || out.result.winner === 'right').toBe(true)
    expect(out.expEach).toBeGreaterThan(0)
    // survivors carry incremented exp
    for (const dw of out.survivors) expect(dw.exp ?? 0).toBeGreaterThan(0)
  })
  it('is deterministic per (seed, node)', () => {
    const s = starterState()
    const node = firstBattleNode(s)
    const a = resolveCombat(s, node, createRng('s').fork(2)).result.winner
    const b = resolveCombat(s, node, createRng('s').fork(2)).result.winner
    expect(a).toBe(b)
  })
})
