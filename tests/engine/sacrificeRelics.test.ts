import { describe, it, expect } from 'vitest'
import { RELICS, RELIC_BY_ID, SACRIFICE_RELIC_IDS, JOKER_RELIC_IDS } from '@/data/relics'
import { offerRelics, offerJokers, offerSacrifices, selectEnemyRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

describe('Reliquie del Sacrificio — pool', () => {
  it('le 5 reliquie esistono, epiche, con sacrificeCost e non assignable', () => {
    expect(SACRIFICE_RELIC_IDS).toHaveLength(5)
    for (const id of SACRIFICE_RELIC_IDS) {
      const r = RELIC_BY_ID[id]!
      expect(r.rarity).toBe('epica')
      expect(r.sacrificeCost).toBeDefined()
      expect(r.assignable).toBeUndefined()
      expect(JOKER_RELIC_IDS).not.toContain(id)
    }
  })
  it('offerRelics non offre MAI una reliquia sacrificio (200 draw)', () => {
    for (let i = 0; i < 200; i++) {
      const ids = offerRelics(createRng(`s-${i}`), [], 0).map(r => r.id)
      for (const id of ids) expect(SACRIFICE_RELIC_IDS).not.toContain(id)
    }
  })
  it('selectEnemyRelics non arma MAI un nemico con una sacrificio (200 draw)', () => {
    for (let i = 0; i < 200; i++) {
      const ids = selectEnemyRelics(createRng(`e-${i}`), 3).map(a => a.relic.id)
      for (const id of ids) expect(SACRIFICE_RELIC_IDS).not.toContain(id)
    }
  })
  it('offerSacrifices offre 2-3 sacrificio distinte non possedute', () => {
    const out = offerSacrifices(createRng('alt-0'), [])
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(out.length).toBeLessThanOrEqual(3)
    expect(new Set(out.map(r => r.id)).size).toBe(out.length)
    for (const r of out) expect(SACRIFICE_RELIC_IDS).toContain(r.id)
  })
})
