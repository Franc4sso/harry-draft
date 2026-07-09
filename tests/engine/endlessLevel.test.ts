import { describe, it, expect } from 'vitest'
import { endlessEnemyLevel } from '@/game/engine/combat/threat'
import { BALANCE } from '@/data/constants'

describe('endlessEnemyLevel', () => {
  it('starts at the endless base level at floor 0', () => {
    expect(endlessEnemyLevel(0)).toBe(BALANCE.endless.normalLevelBase)
  })

  it('rises linearly with floor', () => {
    const b = BALANCE.endless.normalLevelBase
    const k = BALANCE.endless.levelPerFloor
    expect(endlessEnemyLevel(5)).toBe(b + 5 * k)
  })

  it('is UNCAPPED — exceeds levelMax past the clamp point', () => {
    expect(endlessEnemyLevel(50)).toBeGreaterThan(BALANCE.leveling.levelMax)
  })
})
