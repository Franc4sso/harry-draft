import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'

describe('shop constants', () => {
  it('prices are all positive and categoryWeights includes shop', () => {
    const s = BALANCE.shop
    for (const p of Object.values(s.relicByRarity)) expect(p).toBeGreaterThan(0)
    expect(s.heal).toBeGreaterThan(0)
    expect(s.removeWizard).toBeGreaterThan(0)
    expect(s.reroll).toBeGreaterThan(0)
    expect(BALANCE.map.categoryWeights.shop).toBeGreaterThan(0)
  })
})
