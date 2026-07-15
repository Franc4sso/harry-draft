import { describe, it, expect } from 'vitest'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'
import { RELICS, JOKER_RELIC_IDS, SACRIFICE_RELIC_IDS } from '@/data/relics'
import type { ActiveRelic } from '@/types'

const owned = (ids: string[]): ActiveRelic[] =>
  ids.map(id => ({ relic: RELICS.find(r => r.id === id)!, stageObtained: 0 }))

describe('offerRelics', () => {
  it('returns 3 distinct relics', () => {
    const offer = offerRelics(createRng('s').fork(3).fork(0), [], 0)
    expect(offer).toHaveLength(3)
    expect(new Set(offer.map(r => r.id)).size).toBe(3)
  })
  it('never offers an owned relic', () => {
    const ownedIds = RELICS.slice(0, 5).map(r => r.id)
    const offer = offerRelics(createRng('s').fork(3).fork(1), owned(ownedIds), 1)
    for (const r of offer) expect(ownedIds).not.toContain(r.id)
  })
  it('is deterministic for the same rng seed/stage', () => {
    const a = offerRelics(createRng('zzz').fork(3).fork(2), [], 2).map(r => r.id)
    const b = offerRelics(createRng('zzz').fork(3).fork(2), [], 2).map(r => r.id)
    expect(a).toEqual(b)
  })
  it('returns all remaining when pool < 3', () => {
    // Leave the last 2 offerRelics-eligible relics unowned (jokers and sacrifices are excluded
    // from the pool entirely by offerRelics, so leaving them unowned would starve it).
    const available = RELICS.filter(r => !JOKER_RELIC_IDS.includes(r.id) && !SACRIFICE_RELIC_IDS.includes(r.id))
    const ownedIds = RELICS
      .filter(r => JOKER_RELIC_IDS.includes(r.id) || SACRIFICE_RELIC_IDS.includes(r.id) || available.slice(0, available.length - 2).includes(r))
      .map(r => r.id)
    const offer = offerRelics(createRng('s').fork(3).fork(0), owned(ownedIds), 0)
    expect(offer).toHaveLength(2)
    expect(new Set(offer.map(r => r.id)).size).toBe(2)
  })
  it('weights common above epic over many draws', () => {
    let commons = 0, epics = 0
    for (let i = 0; i < 200; i++) {
      const offer = offerRelics(createRng('w').fork(3).fork(i), [], i)
      for (const r of offer) {
        if (r.rarity === 'comune') commons++
        if (r.rarity === 'epica') epics++
      }
    }
    expect(commons).toBeGreaterThan(epics)
  })
})
