import { describe, it, expect } from 'vitest'
import { enemyLevelFor, menaceForLevel } from '@/game/engine/resolvers/combat'
import { BALANCE } from '@/data/constants'

describe('enemyLevelFor', () => {
  it('scales the displayed level by area and node kind', () => {
    // Lowered 2026-07-02 (urgent balance fix, menace-removal follow-up): bases
    // 2/4/6→1/2/3, perArea 2→1 — see data/constants.ts campaignB for the full
    // sweep/rationale. normal → 1,2,3 · elite → 2,3,4 · area-boss → 3,4,5 (clamped to levelMax)
    expect(enemyLevelFor(0, 'normal', false)).toBe(1)
    expect(enemyLevelFor(1, 'normal', false)).toBe(2)
    expect(enemyLevelFor(2, 'normal', false)).toBe(3)

    expect(enemyLevelFor(0, 'elite', false)).toBe(2)
    expect(enemyLevelFor(1, 'elite', false)).toBe(3)
    expect(enemyLevelFor(2, 'elite', false)).toBe(4)

    expect(enemyLevelFor(0, 'boss', false)).toBe(3)
    expect(enemyLevelFor(1, 'boss', false)).toBe(4)
    expect(enemyLevelFor(2, 'boss', false)).toBe(5)
  })

  it('elites and bosses outrank normals in the same area', () => {
    for (const area of [0, 1, 2]) {
      expect(enemyLevelFor(area, 'elite', false)).toBeGreaterThan(enemyLevelFor(area, 'normal', false))
      expect(enemyLevelFor(area, 'boss', false)).toBeGreaterThan(enemyLevelFor(area, 'elite', false))
    }
  })

  it('the final boss is the level cap', () => {
    expect(enemyLevelFor(2, 'boss', true)).toBe(BALANCE.leveling.levelMax)
  })

  it('clamps to [1, levelMax]', () => {
    expect(enemyLevelFor(0, 'normal', false)).toBeGreaterThanOrEqual(1)
    expect(enemyLevelFor(99, 'boss', false)).toBe(BALANCE.leveling.levelMax)
  })
})

describe('menaceForLevel', () => {
  // Menace removed (2026-07-01): enemy difficulty now comes only from level (real
  // per-level stat growth via leveledStats) + draft budget, not a stat-crushing
  // menace multiplier. menaceForLevel is kept as a no-op (always 0) so toBattleUnits'
  // generic menace parameter didn't need reshaping — see data/constants.ts campaignB
  // for the full removal rationale.
  it('always returns 0, regardless of level', () => {
    expect(menaceForLevel(1)).toBe(0)
    expect(menaceForLevel(3)).toBe(0)
    expect(menaceForLevel(5)).toBe(0)
    expect(menaceForLevel(10)).toBe(0)
  })
})
