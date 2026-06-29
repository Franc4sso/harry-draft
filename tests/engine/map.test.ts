// tests/engine/map.test.ts
import { describe, it, expect } from 'vitest'
import { generateMap, nodeDepth, mapRngChannel } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const gen = (seed: string) => generateMap(createRng(seed).fork(mapRngChannel))

describe('generateMap', () => {
  it('is deterministic for a fixed seed', () => {
    expect(gen('alpha')).toEqual(gen('alpha'))
  })
  it('floor 0 is a single battle node; last floor a single boss node', () => {
    const map = gen('alpha')
    const floor0 = map.filter(n => nodeDepth(n.id) === 0)
    const last = map.filter(n => nodeDepth(n.id) === BALANCE.map.floors - 1)
    expect(floor0).toHaveLength(1)
    expect(floor0[0]!.type).toBe('battle')
    expect(last).toHaveLength(1)
    expect(last[0]!.type).toBe('boss')
  })
  it('middle floors have width in [minWidth,maxWidth] and elite floors are elite', () => {
    // floor last-1 is now a guaranteed width-1 Infermeria (pre-boss heal); skip it here
    const map = gen('beta')
    const last = BALANCE.map.floors - 1
    for (let f = 1; f < last; f++) {
      if (f === last - 1) {
        // pre-boss Infermeria floor: width 1, type infirmary
        const nodes = map.filter(n => nodeDepth(n.id) === f)
        expect(nodes).toHaveLength(1)
        expect(nodes[0]!.type).toBe('infirmary')
        continue
      }
      const nodes = map.filter(n => nodeDepth(n.id) === f)
      expect(nodes.length).toBeGreaterThanOrEqual(BALANCE.map.minWidth)
      expect(nodes.length).toBeLessThanOrEqual(BALANCE.map.maxWidth)
      const expectType = BALANCE.map.eliteFloors.includes(f) ? 'elite' : 'battle'
      for (const n of nodes) expect(n.type).toBe(expectType)
    }
  })
  it('only generates battle/elite/boss/infirmary types', () => {
    for (const n of gen('gamma')) expect(['battle', 'elite', 'boss', 'infirmary']).toContain(n.type)
  })
  it('every node is reachable from the start and only boss has empty next', () => {
    const map = gen('delta')
    const byId = new Map(map.map(n => [n.id, n]))
    const seen = new Set<string>()
    const stack = [map[0]!.id]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const nx of byId.get(id)!.next) stack.push(nx)
    }
    expect(seen.size).toBe(map.length) // full reachability, no orphans
    for (const n of map) {
      if (n.type === 'boss') expect(n.next).toHaveLength(0)
      else expect(n.next.length).toBeGreaterThan(0) // no dead ends
    }
  })
  it('edges only connect adjacent floors', () => {
    const map = gen('epsilon')
    const byId = new Map(map.map(n => [n.id, n]))
    for (const n of map) {
      for (const nx of n.next) {
        expect(nodeDepth(byId.get(nx)!.id)).toBe(nodeDepth(n.id) + 1)
      }
    }
  })
})

describe('nodeDepth', () => {
  it('parses the floor index from the id', () => {
    expect(nodeDepth('f0n0')).toBe(0)
    expect(nodeDepth('f3n1')).toBe(3)
    expect(nodeDepth('f12n0')).toBe(12)
  })
})
