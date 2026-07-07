import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'
import { HOUSES } from '@/data/houses'

describe('balance constants', () => {
  it('has sane combat values', () => {
    expect(BALANCE.combat.turnCap).toBe(100)
    expect(BALANCE.combat.minDamage).toBeGreaterThanOrEqual(1)
    expect(BALANCE.draft.teamSize).toBe(5)
    expect(BALANCE.draft.screenSize).toBe(3)
    expect(BALANCE.draft.maxTier1PerScreen).toBe(1)
  })
  it('tier weights favor lower tiers', () => {
    const w = BALANCE.draft.tierWeights
    expect(w[4]).toBeGreaterThan(w[1])
    expect(w[3]).toBeGreaterThan(w[2])
  })
  it('defines all four houses with colors', () => {
    expect(Object.keys(HOUSES)).toHaveLength(4)
    expect(HOUSES.Grifondoro.color).toBeTruthy()
  })
})
