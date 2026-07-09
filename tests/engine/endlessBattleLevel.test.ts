import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { BALANCE } from '@/data/constants'

// Deep area/floor so the uncapped endless curve clearly exceeds levelMax.
const DEEP_AREA = 20
const DEEP_FLOOR = 3

describe('endless battle enemy level', () => {
  it('uses the uncapped endless level (exceeds levelMax) when endless=true', () => {
    const pkg = buildBattlePackage('ebl-seed', DEEP_AREA, DEEP_FLOOR, 'battle', [], true)
    expect(pkg.battle.enemyLevel).toBeGreaterThan(BALANCE.leveling.levelMax)
  })

  it('stays clamped to the campaign enemyLevelFor curve when endless is false/omitted', () => {
    const pkgExplicitFalse = buildBattlePackage('ebl-seed', DEEP_AREA, DEEP_FLOOR, 'battle', [], false)
    const pkgOmitted = buildBattlePackage('ebl-seed', DEEP_AREA, DEEP_FLOOR, 'battle')
    expect(pkgExplicitFalse.battle.enemyLevel).toBeLessThanOrEqual(BALANCE.leveling.levelMax)
    expect(pkgOmitted.battle.enemyLevel).toBeLessThanOrEqual(BALANCE.leveling.levelMax)
    expect(pkgExplicitFalse.battle.enemyLevel).toBe(pkgOmitted.battle.enemyLevel)
  })
})
