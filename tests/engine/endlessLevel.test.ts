import { describe, it, expect } from 'vitest'
import { endlessEnemyLevel } from '@/game/engine/combat/threat'
import { BALANCE } from '@/data/constants'

describe('endlessEnemyLevel', () => {
  it('starts at the endless base level at floor 0', () => {
    expect(endlessEnemyLevel(0)).toBe(BALANCE.endless.normalLevelBase)
  })

  it('rises with floor (linear term + quadratic catch-up term)', () => {
    const b = BALANCE.endless.normalLevelBase
    const k = BALANCE.endless.levelPerFloor
    const q = BALANCE.endless.levelPerFloorSq
    // endlessEnemyLevel rounds to a whole level (Math.round) — match that, rather than
    // comparing against the unrounded formula, so this holds for any calibrated k/q.
    expect(endlessEnemyLevel(5)).toBe(Math.round(b + 5 * k + 25 * q))
  })

  it('the quadratic term is negligible near the early-game floors but dominates deep', () => {
    // Regression guard (2026-07-09): the quadratic catch-up term exists specifically to
    // stop runs that escape the area-2 boss cliff (floor 14) from out-leveling the
    // uncapped-by-design player leveling curve indefinitely (see data/constants.ts's
    // `endless` block for the full incident writeup). It must stay small enough not to
    // perturb the early-game escape-the-wall dynamics the linear term alone calibrates.
    const b = BALANCE.endless.normalLevelBase
    const k = BALANCE.endless.levelPerFloor
    const q = BALANCE.endless.levelPerFloorSq
    const linearOnly14 = b + 14 * k
    const withQuad14 = b + 14 * k + 14 * 14 * q
    expect(withQuad14 - linearOnly14).toBeLessThan(2) // near floor 14, quadratic adds <2 levels
    const linearOnly500 = b + 500 * k
    const withQuad500 = b + 500 * k + 500 * 500 * q
    expect(withQuad500).toBeGreaterThan(linearOnly500 * 5) // deep, quadratic dominates
  })

  it('is UNCAPPED — exceeds levelMax past the clamp point', () => {
    // Pick a floor far enough out to clear levelMax regardless of the calibrated
    // (possibly small) levelPerFloor, rather than hardcoding a floor tuned to one k.
    const floor = Math.ceil((BALANCE.leveling.levelMax + 1) / Math.max(BALANCE.endless.levelPerFloor, 0.01))
    expect(endlessEnemyLevel(floor)).toBeGreaterThan(BALANCE.leveling.levelMax)
  })
})
