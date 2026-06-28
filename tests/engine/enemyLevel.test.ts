import { describe, it, expect } from 'vitest'
import { enemyLevelFor, menaceForLevel } from '@/game/engine/resolvers/combat'
import { BALANCE } from '@/data/constants'

describe('enemyLevelFor', () => {
  it('scales the displayed level by area and node kind', () => {
    // normal → 1,3,5 · elite → 3,5,7 · area-boss → 4,6,8
    expect(enemyLevelFor(0, 'normal', false)).toBe(1)
    expect(enemyLevelFor(1, 'normal', false)).toBe(3)
    expect(enemyLevelFor(2, 'normal', false)).toBe(5)

    expect(enemyLevelFor(0, 'elite', false)).toBe(3)
    expect(enemyLevelFor(1, 'elite', false)).toBe(5)
    expect(enemyLevelFor(2, 'elite', false)).toBe(7)

    expect(enemyLevelFor(0, 'boss', false)).toBe(4)
    expect(enemyLevelFor(1, 'boss', false)).toBe(6)
    expect(enemyLevelFor(2, 'boss', false)).toBe(8)
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
  it('derives menace from level so a higher level is a tougher foe', () => {
    expect(menaceForLevel(1)).toBeCloseTo(BALANCE.campaignB.menaceOffset)
    expect(menaceForLevel(3)).toBeCloseTo(BALANCE.campaignB.menaceOffset + 2 * BALANCE.campaignB.menacePerLevel)
    expect(menaceForLevel(5)).toBeGreaterThan(menaceForLevel(3))
  })
})
