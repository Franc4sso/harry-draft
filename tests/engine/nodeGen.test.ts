import { describe, it, expect } from 'vitest'
import { assignAreaCategories } from '@/game/engine/nodeGen'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const widths = () => {
  // 5 floors: [1, 2, 3, 2, 1] (ingresso, medi, boss)
  return [1, 2, 3, 2, 1]
}
const flat = (cats: string[][]) => cats.flat()
const bias = { teamSize: 5, teamMax: 5 }

describe('assignAreaCategories', () => {
  it('floor 0 is battle, last floor is boss', () => {
    const cats = assignAreaCategories(createRng(1), widths(), bias)
    expect(cats[0]).toEqual(['battle'])
    expect(cats[cats.length - 1]).toEqual(['boss'])
  })
  it('matches the input widths', () => {
    const w = widths()
    const cats = assignAreaCategories(createRng(2), w, bias)
    expect(cats.map(f => f.length)).toEqual(w)
  })
  it('places exactly one elite, within the allowed floor band', () => {
    for (let s = 0; s < 40; s++) {
      const w = widths()
      const cats = assignAreaCategories(createRng(s), w, bias)
      expect(flat(cats).filter(c => c === 'elite')).toHaveLength(1)
      const eliteFloor = cats.findIndex(f => f.includes('elite'))
      expect(eliteFloor).toBeGreaterThanOrEqual(BALANCE.map.eliteMinFloor)
      expect(eliteFloor).toBeLessThanOrEqual(w.length - 2)
    }
  })
  it('guarantees at least one recruit and one relic among middle nodes', () => {
    for (let s = 0; s < 40; s++) {
      const cats = flat(assignAreaCategories(createRng(s), widths(), bias))
      expect(cats.filter(c => c === 'recruit').length).toBeGreaterThanOrEqual(1)
      expect(cats.filter(c => c === 'relic').length).toBeGreaterThanOrEqual(1)
    }
  })
  it('is deterministic per seed', () => {
    const a = assignAreaCategories(createRng(9), widths(), bias)
    const b = assignAreaCategories(createRng(9), widths(), bias)
    expect(a).toEqual(b)
  })
  it('only emits Fase-1 categories', () => {
    const allowed = new Set(['battle', 'elite', 'boss', 'recruit', 'relic'])
    const cats = flat(assignAreaCategories(createRng(4), widths(), bias))
    expect(cats.every(c => allowed.has(c))).toBe(true)
  })
})
