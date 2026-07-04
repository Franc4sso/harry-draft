import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
const bias = { teamSize: 3, teamMax: 5 }
describe('event node placement', () => {
  it('events appear across a sample of areas (not never, not always)', () => {
    let withEvent = 0
    for (let i = 0; i < 40; i++) {
      const nodes = generateArea(createRng(`ev-${i}`).fork(1), `ev-${i}`, 1, bias)
      if (nodes.some(n => n.type === 'event')) withEvent++
    }
    expect(withEvent).toBeGreaterThan(0)   // events do generate
    expect(withEvent).toBeLessThan(40)     // not on literally every area
  })
  it('the guaranteed nodes still exist in every area (infirmary, elite, relic, boss)', () => {
    for (let i = 0; i < 20; i++) {
      const nodes = generateArea(createRng(`g-${i}`).fork(1), `g-${i}`, 1, bias)
      expect(nodes.some(n => n.type === 'infirmary')).toBe(true)
      expect(nodes.some(n => n.type === 'elite')).toBe(true)
      expect(nodes.some(n => n.type === 'relic')).toBe(true)
      expect(nodes.some(n => n.type === 'boss')).toBe(true)
    }
  })
  it('event nodes carry no battle package', () => {
    for (let i = 0; i < 20; i++) {
      const nodes = generateArea(createRng(`b-${i}`).fork(1), `b-${i}`, 1, bias)
      for (const n of nodes.filter(x => x.type === 'event')) expect(n.battle).toBeUndefined()
    }
  })
})
