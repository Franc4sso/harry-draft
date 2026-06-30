import { describe, it, expect } from 'vitest'
import { generateArea, mapRngChannel } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'

// User request: the FIRST choice of a run is among 3 options; every later branch
// is among the 2 nearest. The entry node (floor 0, width 1) funnels into floor 1,
// which is forced to width 3 so the coverage pass wires all 3 into the entry's next[].
// Later floors keep the edge-wiring cap of 2 (Math.min(2, nxt.length)) → 2 nearest.
describe('map: first choice is among 3, later branches at most 2', () => {
  it('the entry node (floor 0) offers exactly 3 next nodes', () => {
    for (const seed of ['fc0', 'fc1', 'fc2', 'fc3', 'fc4']) {
      const nodes = generateArea(createRng(seed).fork(mapRngChannel), 'test', 0, { teamSize: 2, teamMax: 5 })
      const entry = nodes.find(n => n.id.endsWith('f0n0'))!
      expect(entry.next).toHaveLength(3)
    }
  })

  it('non-entry nodes offer at most 2 next nodes (2-nearest rule preserved)', () => {
    for (const seed of ['fc0', 'fc1', 'fc2', 'fc3', 'fc4']) {
      const nodes = generateArea(createRng(seed).fork(mapRngChannel), 'test', 0, { teamSize: 2, teamMax: 5 })
      const entry = nodes.find(n => n.id.endsWith('f0n0'))!
      for (const n of nodes) {
        if (n.id === entry.id) continue
        expect(n.next.length).toBeLessThanOrEqual(2)
      }
    }
  })
})
