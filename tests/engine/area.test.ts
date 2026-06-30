import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const bias = { teamSize: 2, teamMax: 5 }

describe('generateArea', () => {
  it('parseAreaNodeId round-trips', () => {
    expect(parseAreaNodeId('a1f3n2')).toEqual({ area: 1, floor: 3, idx: 2 })
  })
  it('produces floorsPerArea floors with a single entry and single boss', () => {
    const nodes = generateArea(createRng(1), 'test', 0, bias)
    const floors = new Set(nodes.map(n => parseAreaNodeId(n.id).floor))
    expect(floors.size).toBe(BALANCE.map.floorsPerArea)
    expect(nodes.filter(n => parseAreaNodeId(n.id).floor === 0)).toHaveLength(1)
    expect(nodes.filter(n => n.type === 'boss')).toHaveLength(1)
  })
  it('tags every node with the correct area in its id', () => {
    const nodes = generateArea(createRng(5), 'test', 2, bias)
    expect(nodes.every(n => parseAreaNodeId(n.id).area === 2)).toBe(true)
  })
  it('is fully connected: every non-boss node has at least one outgoing edge', () => {
    const nodes = generateArea(createRng(3), 'test', 0, bias)
    const last = BALANCE.map.floorsPerArea - 1
    for (const n of nodes) {
      if (parseAreaNodeId(n.id).floor === last) continue
      expect(n.next.length).toBeGreaterThan(0)
    }
  })
  it('every edge points to an existing node on the next floor', () => {
    const nodes = generateArea(createRng(8), 'test', 1, bias)
    const byId = new Map(nodes.map(n => [n.id, n]))
    for (const n of nodes) {
      const f = parseAreaNodeId(n.id).floor
      for (const t of n.next) {
        expect(byId.has(t)).toBe(true)
        expect(parseAreaNodeId(t).floor).toBe(f + 1)
      }
    }
  })
  it('is deterministic per (seed, area, bias)', () => {
    const a = generateArea(createRng(7), 'test', 1, bias).map(n => `${n.id}:${n.type}:${n.next.join(',')}`)
    const b = generateArea(createRng(7), 'test', 1, bias).map(n => `${n.id}:${n.type}:${n.next.join(',')}`)
    expect(a).toEqual(b)
  })
})
