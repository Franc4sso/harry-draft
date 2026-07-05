import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

describe('shop node generation', () => {
  it('shop nodes can be placed across seeds', () => {
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      for (let area = 0; area < BALANCE.map.areas; area++) {
        const nodes = generateArea(createRng(`run-${i}`).fork(4).fork(area), `run-${i}`, area, { teamSize: 3, teamMax: 5 })
        if (nodes.some(n => n.type === 'shop')) found = true
      }
    }
    expect(found).toBe(true)
  })
})
