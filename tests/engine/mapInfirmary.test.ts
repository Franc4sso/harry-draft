import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId, mapRngChannel } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

// This test exercises the LIVE path: generateArea → assignAreaCategories.
// Every assertion here proves the Infermeria funnel exists in the actual game.
describe('map: guaranteed Infermeria before the boss (live path: generateArea)', () => {
  it('the floor before the boss is Infermeria-only (width 1) and leads to the boss', () => {
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
      expect(
        preBoss.every(n => n.type === 'infirmary'),
        `seed ${seed}: all pre-boss nodes should be infirmary`,
      ).toBe(true)
      // Every pre-boss node leads to the boss → any path funnels through an Infermeria.
      expect(
        preBoss.every(n => n.next.includes(boss.id)),
        `seed ${seed}: every pre-boss node must lead to the boss`,
      ).toBe(true)

      // Pre-boss floor is width 1 (single Infermeria choke point).
      const preBossFloorNodes = nodes.filter(n => {
        const { floor } = parseAreaNodeId(n.id)
        return floor === last - 1
      })
      expect(preBossFloorNodes, `seed ${seed}: pre-boss floor is width 1`).toHaveLength(1)
      expect(preBossFloorNodes[0]!.type).toBe('infirmary')
    }
  })
})
