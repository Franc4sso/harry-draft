import { describe, it, expect } from 'vitest'
import { generateMap, nodeDepth, mapRngChannel } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

describe('map: guaranteed Infermeria before the boss', () => {
  it('the floor before the boss is Infermeria-only (width 1) and leads to the boss', () => {
    for (const seed of ['m0', 'm1', 'm2', 'm3', 'm4']) {
      const nodes = generateMap(createRng(seed).fork(mapRngChannel))
      const boss = nodes.find(n => n.type === 'boss')!
      // the pre-boss floor = all nodes whose `next` includes the boss id
      const preBoss = nodes.filter(n => n.next.includes(boss.id))
      expect(preBoss.length, `seed ${seed}: pre-boss floor should have nodes`).toBeGreaterThan(0)
      expect(
        preBoss.every(n => n.type === 'infirmary'),
        `seed ${seed}: all pre-boss nodes should be infirmary`,
      ).toBe(true)
      // every pre-boss node leads to the boss → any path hits an Infermeria
      expect(
        preBoss.every(n => n.next.includes(boss.id)),
        `seed ${seed}: every pre-boss node must lead to the boss`,
      ).toBe(true)
      // pre-boss floor is width 1 (funnels every path through a single Infermeria)
      const last = BALANCE.map.floors - 1
      const preBossFloorNodes = nodes.filter(n => nodeDepth(n.id) === last - 1)
      expect(preBossFloorNodes, `seed ${seed}: pre-boss floor is width 1`).toHaveLength(1)
      expect(preBossFloorNodes[0]!.type).toBe('infirmary')
    }
  })
})
