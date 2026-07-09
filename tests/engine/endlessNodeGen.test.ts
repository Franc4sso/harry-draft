import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { areaRng } from '@/game/engine/runEngine'

describe('endless map generation', () => {
  it('never generates shop or spellForge nodes across many endless areas', () => {
    for (let area = 1; area <= 20; area++) {
      const map = generateArea(areaRng('endless-mapgen', area), 'endless-mapgen', area,
        { teamSize: 3, teamMax: 5 }, true) // endless=true
      for (const n of map) {
        expect(n.type).not.toBe('shop')
        expect(n.type).not.toBe('spellForge')
      }
    }
  })
})
