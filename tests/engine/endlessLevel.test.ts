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
    // endlessEnemyLevel rounds to a whole level (Math.round) — match that, rather than
    // comparing against the unrounded formula, so this holds for any calibrated k.
    expect(endlessEnemyLevel(5)).toBe(Math.round(b + 5 * k))
  })

  it('is UNCAPPED — exceeds levelMax past the clamp point', () => {
    // Pick a floor far enough out to clear levelMax regardless of the calibrated
    // (possibly small) levelPerFloor, rather than hardcoding a floor tuned to one k.
    const floor = Math.ceil((BALANCE.leveling.levelMax + 1) / Math.max(BALANCE.endless.levelPerFloor, 0.01))
    expect(endlessEnemyLevel(floor)).toBeGreaterThan(BALANCE.leveling.levelMax)
  })
})
