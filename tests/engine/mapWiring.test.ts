import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

describe('area map wiring', () => {
  it('every non-entry node has at least one incoming edge (no orphans)', () => {
    for (let area = 0; area < BALANCE.map.areas; area++) {
      const map = generateArea(createRng(`w${area}`).fork(4).fork(area), area, { teamSize: 2, teamMax: 5 })
      const incoming = new Set(map.flatMap(n => n.next))
      const entryId = map.find(n => n.id.includes('f0n'))!.id
      for (const n of map) {
        if (n.id === entryId) continue
        expect(incoming.has(n.id), `orphan: ${n.id}`).toBe(true)
      }
    }
  })
  it('no dead ends before the last floor (every non-boss node has an outgoing edge)', () => {
    const map = generateArea(createRng('w').fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
    const bossId = map.find(n => n.type === 'boss')!.id
    for (const n of map) if (n.id !== bossId) expect(n.next.length).toBeGreaterThan(0)
  })
  it('interior nodes offer two nearby options where the next floor allows', () => {
    let twoEdgeNodes = 0, candidates = 0
    for (let s = 0; s < 40; s++) {
      const map = generateArea(createRng(`m${s}`).fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
      const byFloor = new Map<number, typeof map>()
      for (const n of map) {
        const f = parseAreaNodeId(n.id).floor
        byFloor.set(f, [...(byFloor.get(f) ?? []), n])
      }
      for (const n of map) {
        const f = parseAreaNodeId(n.id).floor
        const nextWidth = (byFloor.get(f + 1) ?? []).length
        if (nextWidth >= 2 && n.type !== 'boss') { candidates++; if (n.next.length >= 2) twoEdgeNodes++ }
      }
    }
    expect(twoEdgeNodes / candidates).toBeGreaterThan(0.95)
  })
})
