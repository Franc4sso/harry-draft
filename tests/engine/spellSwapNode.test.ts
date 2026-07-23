import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { areaRng } from '@/game/engine/runEngine'

describe('spellSwap node generation', () => {
  it('can appear in campaign areas across many seeds', () => {
    let sawSpellSwap = false
    for (let area = 1; area <= 20; area++) {
      const map = generateArea(areaRng('spellswap-campaign-mapgen', area), 'spellswap-campaign-mapgen', area,
        { teamSize: 3, teamMax: 5 }, false) // endless=false (campaign)
      if (map.some(n => n.type === 'spellSwap')) sawSpellSwap = true
    }
    expect(sawSpellSwap).toBe(true)
  })

  it('never appears in endless areas, across many seeds', () => {
    for (let area = 1; area <= 20; area++) {
      const map = generateArea(areaRng('spellswap-endless-mapgen', area), 'spellswap-endless-mapgen', area,
        { teamSize: 3, teamMax: 5 }, true) // endless=true
      for (const n of map) {
        expect(n.type).not.toBe('spellSwap')
      }
    }
  })
})
