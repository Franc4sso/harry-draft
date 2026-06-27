import { describe, it, expect } from 'vitest'
import { runSummary } from '@/lib/runSummary'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'
import type { RunState } from '@/types'

describe('runSummary', () => {
  it('summarizes team size, average level and area', () => {
    const team = offerRecruits(createRng(1), { house: 'Corvonero', exclude: new Set() })
      .slice(0, 3).map(d => ({ ...recruitVia(d, 'iniziale'), level: 2 }))
    const s: RunState = { seed: 's', phase: 'area-cleared', team, activeSynergies: [], stage: 0,
      relics: [], area: 1, teamMax: 5 }
    const out = runSummary(s)
    expect(out.teamSize).toBe(3)
    expect(out.avgLevel).toBe(2)
    expect(out.areasCleared).toBe(2) // area index 1 cleared → 2 areas done
  })
})
