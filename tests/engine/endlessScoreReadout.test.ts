import { describe, it, expect } from 'vitest'
import { scoreForEndlessRun } from '@/game/engine/endless'
import type { DraftedWizard, RunNode, RunState } from '@/types'

function stubState(over: Partial<RunState>): RunState {
  return {
    seed: 's', phase: 'defeat', team: [], activeSynergies: [], stage: 0, relics: [],
    area: 2, currentNodeId: 'a2f0n0', ...over,
  } as RunState
}

function stubWizard(over: Partial<DraftedWizard> = {}): DraftedWizard {
  return {
    wizard: {} as DraftedWizard['wizard'],
    stats: {} as DraftedWizard['stats'],
    maxHp: 100,
    spell: {} as DraftedWizard['spell'],
    ...over,
  } as DraftedWizard
}

function node(over: Partial<RunNode>): RunNode {
  return { id: 'a2f1n0', type: 'battle', next: [], ...over }
}

describe('scoreForEndlessRun', () => {
  it('returns endlessScore of the extracted inputs (>=0, deterministic)', () => {
    const s = stubState({})
    const score = scoreForEndlessRun(s)
    expect(score).toBe(scoreForEndlessRun(s)) // deterministic
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('deeper run scores higher, all else equal', () => {
    const shallow = scoreForEndlessRun(stubState({ area: 1, currentNodeId: 'a1f0n0' }))
    const deep = scoreForEndlessRun(stubState({ area: 10, currentNodeId: 'a10f0n0' }))
    expect(deep).toBeGreaterThan(shallow)
  })

  it('counts a resolved elite node from state.map, not from the (always-empty) log', () => {
    const base = stubState({
      area: 2, currentNodeId: 'a2f4n0',
      map: [node({ id: 'a2f1n0', type: 'elite', resolved: false })],
      log: [],
    })
    const withEliteKill = stubState({
      area: 2, currentNodeId: 'a2f4n0',
      map: [node({ id: 'a2f1n0', type: 'elite', resolved: true })],
      log: [],
    })
    expect(scoreForEndlessRun(withEliteKill)).toBeGreaterThan(scoreForEndlessRun(base))
  })

  it('counts a resolved boss node from state.map', () => {
    const base = stubState({
      area: 3, currentNodeId: 'a3f4n0',
      map: [node({ id: 'a3f4n0', type: 'boss', resolved: false })],
    })
    const withBossKill = stubState({
      area: 3, currentNodeId: 'a3f4n0',
      map: [node({ id: 'a3f4n0', type: 'boss', resolved: true })],
    })
    expect(scoreForEndlessRun(withBossKill)).toBeGreaterThan(scoreForEndlessRun(base))
  })

  it('ignores unresolved elite/boss nodes and non-elite/boss node types', () => {
    const withNoise = stubState({
      area: 1, currentNodeId: 'a1f0n0',
      map: [
        node({ id: 'a1f1n0', type: 'elite', resolved: false }),
        node({ id: 'a1f2n0', type: 'battle', resolved: true }),
        node({ id: 'a1f3n0', type: 'recruit', resolved: true }),
      ],
    })
    const clean = stubState({ area: 1, currentNodeId: 'a1f0n0', map: [] })
    expect(scoreForEndlessRun(withNoise)).toBe(scoreForEndlessRun(clean))
  })

  it('a full-HP team (currentHp absent) yields the max hp bonus, not zero', () => {
    const fullHpAbsent = stubState({ team: [stubWizard({ maxHp: 80 }), stubWizard({ maxHp: 120 })] })
    const noTeam = stubState({ team: [] })
    const zeroHp = stubState({
      team: [stubWizard({ maxHp: 80, currentHp: 0 }), stubWizard({ maxHp: 120, currentHp: 0 })],
    })
    expect(scoreForEndlessRun(fullHpAbsent)).toBeGreaterThan(scoreForEndlessRun(noTeam))
    expect(scoreForEndlessRun(fullHpAbsent)).toBeGreaterThan(scoreForEndlessRun(zeroHp))
  })
})
