import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'

describe('relic balance constants', () => {
  it('defines an offer count of 3', () => {
    expect(BALANCE.relics.offerCount).toBe(3)
  })
  it('weights common relics higher than epic', () => {
    const w = BALANCE.relics.rarityWeights
    expect(w['comune']).toBeGreaterThan(w['epica'])
    expect(w['rara']).toBeGreaterThan(w['epica'])
    expect(w['non-comune']).toBeGreaterThan(w['rara'])
  })
})
