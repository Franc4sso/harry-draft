import { describe, it, expect } from 'vitest'
import { earnCioccorane, evaluateMilestones, recordRunEnd, type RunEndSummary } from '@/lib/metaProgress'
import { defaultProfile } from '@/lib/metaStore'

const winSummary: RunEndSummary = {
  outcome: 'win', areasCleared: 3, bossesDefeated: 3,
  namedSynergiesActive: ['goldenTrio'], teamWizardIds: ['harry', 'ron', 'hermione'],
}
const lossSummary: RunEndSummary = {
  outcome: 'defeat', areasCleared: 1, bossesDefeated: 0,
  namedSynergiesActive: [], teamWizardIds: ['harry'],
}

describe('earnCioccorane', () => {
  it('a full win pays area + boss + first-win bonus', () => {
    // 3*15 + 3*20 + 60 = 165
    expect(earnCioccorane(winSummary)).toBe(165)
  })
  it('a loss still pays at least the loss floor', () => {
    expect(earnCioccorane(lossSummary)).toBeGreaterThanOrEqual(10)
  })
})

describe('evaluateMilestones', () => {
  it('fires matching milestones once and unlocks their targets', () => {
    const first = evaluateMilestones(defaultProfile(), winSummary)
    expect(first.unlocked.map(u => u.id).sort()).toEqual(
      ['dolohov', 'greyback', 'neville', 'molly', 'cuore-del-tasso'].sort(),
    )
    // Re-running with the already-updated profile fires nothing new.
    const second = evaluateMilestones(first.profile, winSummary)
    expect(second.unlocked).toEqual([])
  })
})

describe('recordRunEnd', () => {
  it('grants currency, applies unlocks, and updates stats', () => {
    const { profile, earned, unlocked } = recordRunEnd(defaultProfile(), winSummary)
    expect(earned).toBe(165)
    expect(profile.cioccorane).toBe(165)
    expect(profile.stats.runsPlayed).toBe(1)
    expect(profile.stats.runsWon).toBe(1)
    expect(profile.stats.bossesKilled).toBe(3)
    expect(profile.unlockedWizards).toEqual(
      expect.arrayContaining(['dolohov', 'greyback', 'neville', 'molly']),
    )
    expect(profile.unlockedRelics).toEqual(expect.arrayContaining(['cuore-del-tasso']))
    expect(unlocked.length).toBe(5)
  })
})
