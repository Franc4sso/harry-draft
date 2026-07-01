import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId, mapRngChannel } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

// This test exercises the LIVE path: generateArea → assignAreaCategories.
// Every assertion here proves the guaranteed Infermeria exists in the actual game,
// as ONE of the pre-boss floor's 3 nodes (not a whole-floor funnel anymore — every
// step, including the pre-boss floor, always offers 3 nodes; see task 16).
describe('map: guaranteed Infermeria before the boss (live path: generateArea)', () => {
  it('the floor before the boss has width 3 and contains exactly one Infermeria that leads to the boss', () => {
    for (const seed of ['m0', 'm1', 'm2', 'm3', 'm4']) {
      const rng = createRng(seed).fork(mapRngChannel)
      // Use area 0, bias: full team so no recruit-boost distortion.
      const bias = { teamSize: 5, teamMax: 5 }
      const nodes = generateArea(rng.fork(0), 'test', 0, bias)

      const last = BALANCE.map.floorsPerArea - 1
      const boss = nodes.find(n => n.type === 'boss')!
      expect(boss, `seed ${seed}: boss node must exist`).toBeTruthy()

      // Pre-boss floor = all nodes directly connected to the boss.
      const preBoss = nodes.filter(n => n.next.includes(boss.id))
      expect(preBoss.length, `seed ${seed}: pre-boss floor should have nodes`).toBeGreaterThan(0)
      // Every pre-boss node leads to the boss → whichever node the player picks, it borders the boss.
      expect(
        preBoss.every(n => n.next.includes(boss.id)),
        `seed ${seed}: every pre-boss node must lead to the boss`,
      ).toBe(true)

      // Pre-boss floor is now width 3, with EXACTLY one Infermeria among its nodes.
      const preBossFloorNodes = nodes.filter(n => {
        const { floor } = parseAreaNodeId(n.id)
        return floor === last - 1
      })
      expect(preBossFloorNodes, `seed ${seed}: pre-boss floor is width 3`).toHaveLength(3)
      expect(
        preBossFloorNodes.filter(n => n.type === 'infirmary'),
        `seed ${seed}: exactly one infirmary on the pre-boss floor`,
      ).toHaveLength(1)
    }
  })
})
