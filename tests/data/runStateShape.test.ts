import { describe, it, expect } from 'vitest'
import type { RunState, RunPhase } from '@/types'

describe('RunState additive shape', () => {
  it('accepts the new optional fields without requiring them', () => {
    const minimal: RunState = {
      seed: 's', phase: 'menu', team: [], activeSynergies: [], stage: 0, relics: [],
    }
    expect(minimal.house).toBeUndefined()
    const full: RunState = {
      ...minimal, house: 'Tassorosso', area: 0, log: [], pendingLevelUps: [], teamMax: 5,
    }
    expect(full.area).toBe(0)
  })
  it('RunPhase includes the new phases', () => {
    const phases: RunPhase[] = ['house', 'starter', 'recruit-node', 'relic-node', 'area-cleared']
    expect(phases).toHaveLength(5)
  })
})
