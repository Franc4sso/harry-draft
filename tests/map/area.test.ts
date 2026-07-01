import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const bias = { teamSize: 3, teamMax: 5 }

describe('area floor widths', () => {
  it('middle floors (incl. pre-boss) are always width 3', () => {
    for (let seed = 0; seed < 30; seed++) {
      const nodes = generateArea(createRng(`s${seed}`), `s${seed}`, 0, bias)
      const byFloor = new Map<number, number>()
      for (const n of nodes) {
        const f = Number(/f(\d+)n/.exec(n.id)![1])
        byFloor.set(f, (byFloor.get(f) ?? 0) + 1)
      }
      const last = BALANCE.map.floorsPerArea - 1
      for (const [f, w] of byFloor) {
        if (f === 0 || f === last) continue // entry/boss stay width 1
        expect(w, `seed ${seed} floor ${f}`).toBe(3)
      }
    }
  })

  it('the pre-boss floor (last-1) is width 3', () => {
    const last = BALANCE.map.floorsPerArea - 1
    for (let seed = 0; seed < 30; seed++) {
      const nodes = generateArea(createRng(`p${seed}`), `p${seed}`, 0, bias)
      const preBossCount = nodes.filter(n => {
        const f = Number(/f(\d+)n/.exec(n.id)![1])
        return f === last - 1
      }).length
      expect(preBossCount, `seed ${seed}`).toBe(3)
    }
  })
})

describe('area filler dedup', () => {
  it('no middle floor is entirely one node type when 3-wide', () => {
    for (let seed = 0; seed < 60; seed++) {
      const nodes = generateArea(createRng(`d${seed}`), `d${seed}`, 0, bias)
      const byFloor = new Map<number, string[]>()
      for (const n of nodes) {
        const f = Number(/f(\d+)n/.exec(n.id)![1])
        byFloor.set(f, [...(byFloor.get(f) ?? []), n.type])
      }
      const last = BALANCE.map.floorsPerArea - 1
      for (const [f, types] of byFloor) {
        if (f === 0 || f === last) continue
        if (types.length < 3) continue
        const allSame = types.every(t => t === types[0])
        expect(allSame, `seed ${seed} floor ${f} all ${types[0]}`).toBe(false)
      }
    }
  })
})

describe('area pre-boss infirmary guarantee', () => {
  it('exactly one infirmary node exists per area, and it is on the pre-boss floor', () => {
    const last = BALANCE.map.floorsPerArea - 1
    for (let seed = 0; seed < 60; seed++) {
      const nodes = generateArea(createRng(`i${seed}`), `i${seed}`, 0, bias)
      const infirmaries = nodes.filter(n => n.type === 'infirmary')
      expect(infirmaries, `seed ${seed}: exactly one infirmary`).toHaveLength(1)
      const f = Number(/f(\d+)n/.exec(infirmaries[0]!.id)![1])
      expect(f, `seed ${seed}: infirmary must be on pre-boss floor`).toBe(last - 1)
    }
  })

  it('the pre-boss floor is not all-identical (dedup holds with infirmary present)', () => {
    const last = BALANCE.map.floorsPerArea - 1
    for (let seed = 0; seed < 60; seed++) {
      const nodes = generateArea(createRng(`u${seed}`), `u${seed}`, 0, bias)
      const preBossTypes = nodes
        .filter(n => Number(/f(\d+)n/.exec(n.id)![1]) === last - 1)
        .map(n => n.type)
      expect(preBossTypes, `seed ${seed}`).toHaveLength(3)
      const allSame = preBossTypes.every(t => t === preBossTypes[0])
      expect(allSame, `seed ${seed}: pre-boss floor ${preBossTypes.join(',')}`).toBe(false)
    }
  })

  it('area guarantees still hold: 1 elite not on pre-boss floor, >=1 recruit, >=1 relic', () => {
    const last = BALANCE.map.floorsPerArea - 1
    for (let seed = 0; seed < 60; seed++) {
      const nodes = generateArea(createRng(`g${seed}`), `g${seed}`, 0, bias)
      const elites = nodes.filter(n => n.type === 'elite')
      expect(elites, `seed ${seed}: exactly one elite`).toHaveLength(1)
      const eliteFloor = Number(/f(\d+)n/.exec(elites[0]!.id)![1])
      expect(eliteFloor, `seed ${seed}: elite not on pre-boss floor`).not.toBe(last - 1)
      expect(nodes.filter(n => n.type === 'recruit').length, `seed ${seed}: recruit`).toBeGreaterThanOrEqual(1)
      expect(nodes.filter(n => n.type === 'relic').length, `seed ${seed}: relic`).toBeGreaterThanOrEqual(1)
    }
  })
})
