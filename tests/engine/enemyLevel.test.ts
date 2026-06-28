import { describe, it, expect } from 'vitest'
import { deriveEnemyLevel } from '@/game/engine/resolvers/combat'
import { BALANCE } from '@/data/constants'

describe('deriveEnemyLevel', () => {
  it('maps menace onto the player growth curve', () => {
    expect(deriveEnemyLevel(0)).toBe(1)
    expect(deriveEnemyLevel(0.20)).toBe(3)   // 1 + 0.20/0.10
    expect(deriveEnemyLevel(0.50)).toBe(6)
  })
  it('clamps to [1, levelMax]', () => {
    expect(deriveEnemyLevel(-0.5)).toBe(1)
    expect(deriveEnemyLevel(99)).toBe(BALANCE.leveling.levelMax)
  })
})
