import { describe, it, expect } from 'vitest'
import { assignAreaCategories } from '@/game/engine/nodeGen'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const widths = () => {
  // 5 floors: [1, 2, 3, 1, 1] (ingresso, medi, infermeria pre-boss, boss).
  // Floor last-1 is forced to width 1 by generateArea (guaranteed Infermeria funnel).
  return [1, 2, 3, 1, 1]
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
  it('guarantees at least one relic among middle nodes; recruit is rare and capped at 1', () => {
    // Recruit is DELIBERATELY not guaranteed (USER DIRECTIVE: recruit nodes must be
    // rare, some areas zero) — only relic remains a hard guarantee. Recruit is capped
    // at most 1 per area regardless of how many seeds roll it.
    for (let s = 0; s < 40; s++) {
      const cats = flat(assignAreaCategories(createRng(s), widths(), bias))
      expect(cats.filter(c => c === 'recruit').length).toBeLessThanOrEqual(1)
      expect(cats.filter(c => c === 'relic').length).toBeGreaterThanOrEqual(1)
    }
  })
  it('recruit nodes are rare across many areas (some zero, none exceed the cap)', () => {
    let areasWithRecruit = 0
    const N = 200
    for (let s = 0; s < N; s++) {
      const n = flat(assignAreaCategories(createRng(s), widths(), bias)).filter(c => c === 'recruit').length
      expect(n).toBeLessThanOrEqual(1)
      if (n === 1) areasWithRecruit++
    }
    // Some areas must have ZERO recruit nodes (rarity requirement).
    expect(areasWithRecruit).toBeLessThan(N)
    expect(areasWithRecruit).toBeGreaterThan(0)
  })
  it('is deterministic per seed', () => {
    const a = assignAreaCategories(createRng(9), widths(), bias)
    const b = assignAreaCategories(createRng(9), widths(), bias)
    expect(a).toEqual(b)
  })
  it('only emits Fase-1 categories', () => {
    const allowed = new Set(['battle', 'elite', 'boss', 'recruit', 'relic', 'infirmary', 'altare', 'event', 'shop', 'spellForge'])
    const cats = flat(assignAreaCategories(createRng(4), widths(), bias))
    expect(cats.every(c => allowed.has(c))).toBe(true)
  })
  it('recruit-bias branch: satisfies all guarantees when team is incomplete', () => {
    const biasBiased = { teamSize: 3, teamMax: 5 }
    for (let s = 0; s < 20; s++) {
      const cats = assignAreaCategories(createRng(s), widths(), biasBiased)
      expect(cats[0]).toEqual(['battle'])
      expect(cats[cats.length - 1]).toEqual(['boss'])
      const all = flat(cats)
      expect(all.filter(c => c === 'elite')).toHaveLength(1)
      // Recruit bias raises the ODDS of a recruit node but must never exceed the cap.
      expect(all.filter(c => c === 'recruit').length).toBeLessThanOrEqual(1)
      expect(all.filter(c => c === 'relic').length).toBeGreaterThanOrEqual(1)
    }
  })
  it('throws on bad widths array', () => {
    expect(() => assignAreaCategories(createRng(1), [1, 1], { teamSize: 5, teamMax: 5 })).toThrow()
    expect(() => assignAreaCategories(createRng(1), [2, 3, 1], { teamSize: 5, teamMax: 5 })).toThrow(/width 1/)
  })
})
