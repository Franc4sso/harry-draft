import { describe, it, expect } from 'vitest'
import { offerRelics, offerJokers } from '@/game/engine/relics'
import { JOKER_RELIC_IDS } from '@/data/relics'
import { createRng } from '@/game/engine/rng'

describe('pool split', () => {
  it('offerRelics never offers a joker', () => {
    const jokerSet = new Set(JOKER_RELIC_IDS)
    for (let seed = 0; seed < 50; seed++) {
      const offer = offerRelics(createRng(seed), [], 0)
      expect(offer.every(r => !jokerSet.has(r.id))).toBe(true)
    }
  })
  it('offerJokers returns only jokers, distinct, not owned', () => {
    const offer = offerJokers(createRng(1), [])
    expect(offer.length).toBeGreaterThan(0)
    expect(offer.every(r => JOKER_RELIC_IDS.includes(r.id))).toBe(true)
    expect(new Set(offer.map(r => r.id)).size).toBe(offer.length)
  })
})
