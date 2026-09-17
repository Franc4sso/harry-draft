// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { rowOf, colOf, adjacent, front, behind, leftOf, rightOf } from '@/game/engine/rt/grid'

describe('grid 3x2', () => {
  it('righe e colonne', () => {
    expect([0, 1, 2, 3, 4, 5].map(rowOf)).toEqual([0, 0, 0, 1, 1, 1])
    expect([0, 1, 2, 3, 4, 5].map(colOf)).toEqual([0, 1, 2, 0, 1, 2])
  })
  it('adiacenza ortogonale, niente diagonali', () => {
    expect(adjacent(1).sort()).toEqual([0, 2, 4])
    expect(adjacent(0).sort()).toEqual([1, 3])
    expect(adjacent(4).sort()).toEqual([1, 3, 5])
  })
  it('davanti/dietro/sinistra/destra', () => {
    expect(front(4)).toBe(1); expect(front(1)).toBeNull()
    expect(behind(1)).toBe(4); expect(behind(4)).toBeNull()
    expect(leftOf(1)).toBe(0); expect(leftOf(0)).toBeNull()
    expect(rightOf(1)).toBe(2); expect(rightOf(2)).toBeNull()
  })
})
