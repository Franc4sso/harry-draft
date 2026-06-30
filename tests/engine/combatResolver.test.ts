import { describe, it, expect } from 'vitest'
import { resolveCombat, globalDepth } from '@/game/engine/resolvers/combat'
import { BALANCE } from '@/data/constants'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import type { RunState, RunNode } from '@/types'

function starterState(): RunState {
  const team = offerRecruits(createRng(1), { exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(createRng(1).fork(4).fork(0), 'test', 0, { teamSize: 2, teamMax: 5 })
  return { seed: 's', phase: 'map', team, activeSynergies: [], stage: 0, relics: [],
    map, currentNodeId: map[0]!.id, house: 'Serpeverde', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}
const firstBattleNode = (s: RunState): RunNode =>
  s.map!.find(n => n.type === 'battle' && n.id !== s.currentNodeId) ?? s.map!.find(n => n.type === 'battle')!

describe('globalDepth', () => {
  it('is strictly monotonic and never collides across area boundaries', () => {
    const F = BALANCE.map.floorsPerArea
    // last node of area a and first node of area a+1 must differ
    for (let a = 0; a < BALANCE.map.areas - 1; a++) {
      expect(globalDepth(a, F - 1)).toBeLessThan(globalDepth(a + 1, 0))
    }
    // strictly increasing within and across areas
    let prev = -1
    for (let a = 0; a < BALANCE.map.areas; a++) {
      for (let f = 0; f < F; f++) {
        const d = globalDepth(a, f)
        expect(d).toBeGreaterThan(prev)
        prev = d
      }
    }
  })
})

describe('resolveCombat', () => {
  it('returns a battle result and grants levels to survivors', () => {
    const s = starterState()
    const node = firstBattleNode(s)
    const out = resolveCombat(s, node, createRng('s').fork(2))
    expect(out.result.winner === 'left' || out.result.winner === 'right').toBe(true)
    expect(out.levelsGained).toBeGreaterThan(0)
    // only the living gain levels (dead wizards are benched at currentHp 0, no level-up)
    const living = out.survivors.filter(dw => (dw.currentHp ?? dw.maxHp) > 0)
    for (const dw of living) {
      expect(dw.level ?? 1).toBeGreaterThanOrEqual(2)
      expect(dw.exp ?? 0).toBeGreaterThan(0)
    }
  })
  it('is deterministic per (seed, node)', () => {
    const s = starterState()
    const node = firstBattleNode(s)
    const a = resolveCombat(s, node, createRng('s').fork(2)).result.winner
    const b = resolveCombat(s, node, createRng('s').fork(2)).result.winner
    expect(a).toBe(b)
  })
  it('flags isFinalBoss only for the final area boss, not earlier-area bosses', () => {
    const last = BALANCE.map.areas - 1
    const s0 = starterState()
    // area 0 boss node: a boss fight, but NOT the scripted final boss
    const boss0 = s0.map!.find(n => n.type === 'boss')!
    const out0 = resolveCombat(s0, boss0, createRng('s').fork(2))
    expect(out0.isBoss).toBe(true)
    expect(out0.isFinalBoss).toBe(false)
    // final-area boss node: the scripted Voldemort fight
    const finalMap = generateArea(createRng(1).fork(4).fork(last), 'test', last, { teamSize: 2, teamMax: 5 })
    const bossF = finalMap.find(n => n.type === 'boss')!
    const sF: RunState = { ...s0, area: last, map: finalMap, currentNodeId: finalMap[0]!.id }
    const outF = resolveCombat(sF, bossF, createRng('s').fork(2))
    expect(outF.isBoss).toBe(true)
    expect(outF.isFinalBoss).toBe(true)
  })
})
