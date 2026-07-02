import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'

describe('BALANCE.map', () => {
  it('defines map generation tunables', () => {
    const m = BALANCE.map
    expect(m.floors).toBeGreaterThanOrEqual(4)
    expect(Array.isArray(m.eliteFloors)).toBe(true)
    expect(m.eliteBudgetMult).toBeGreaterThan(1)
  })
  it('elite floors are middle floors (not 0, not last)', () => {
    const m = BALANCE.map
    for (const f of m.eliteFloors) {
      expect(f).toBeGreaterThan(0)
      expect(f).toBeLessThan(m.floors - 1)
    }
  })
})
