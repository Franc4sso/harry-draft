import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const bias = { teamSize: 3, teamMax: 5 }

describe('area floor widths', () => {
  it('middle floors are always width 3', () => {
    for (let seed = 0; seed < 30; seed++) {
      const nodes = generateArea(createRng(`s${seed}`), `s${seed}`, 0, bias)
      const byFloor = new Map<number, number>()
      for (const n of nodes) {
        const f = Number(/f(\d+)n/.exec(n.id)![1])
        byFloor.set(f, (byFloor.get(f) ?? 0) + 1)
      }
      const last = BALANCE.map.floorsPerArea - 1
      for (const [f, w] of byFloor) {
        if (f === 0 || f === last || f === last - 1) continue // entry/boss/infirmary funnel
        expect(w, `seed ${seed} floor ${f}`).toBe(3)
      }
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
        if (f === 0 || f === last || f === last - 1) continue
        if (types.length < 3) continue
        const allSame = types.every(t => t === types[0])
        expect(allSame, `seed ${seed} floor ${f} all ${types[0]}`).toBe(false)
      }
    }
  })
})
