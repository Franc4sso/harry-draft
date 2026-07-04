import { describe, it, expect } from 'vitest'
import { RELIC_BY_ID, RULE_BREAKING_RELIC_IDS } from '@/data/relics'

describe('rule-breaking relic pool', () => {
  it('every id in the pool resolves to a real relic', () => {
    expect(RULE_BREAKING_RELIC_IDS.length).toBeGreaterThanOrEqual(3)
    for (const id of RULE_BREAKING_RELIC_IDS) expect(RELIC_BY_ID[id]).toBeDefined()
  })
  it('the pool relics use only existing hook shapes (no unknown mechanic fields)', () => {
    for (const id of RULE_BREAKING_RELIC_IDS) {
      const r = RELIC_BY_ID[id]!
      const usesKnown = !!(r.triggers || r.grantsDarkMagic || r.bonus || r.keywordMult)
      expect(usesKnown).toBe(true)
    }
  })
})
