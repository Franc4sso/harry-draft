import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { MURO, BOSSES_BY_AREA } from '@/data/bosses'
import { BALANCE } from '@/data/constants'

// NOTE (Task 6, seeded boss pool): area 0/final-area boss selection now draws from
// BOSSES_BY_AREA[area] by seed, so a specific seed may land on either the default or
// its alt (they share the calibrated wall/no-wall mechanic — only name/leader differ).
// These assertions check pool membership rather than a hardcoded single name.
describe('Muro area-0 boss selection', () => {
  it('area-0 boss carries the Muro wall + hint', () => {
    const { battle, preview } = buildBattlePackage('seed-a', 0, 3, 'boss')
    expect(battle.unitDamageReduction).toBe(MURO.unitDamageReduction)
    expect(BOSSES_BY_AREA[0]!.map(b => b.name)).toContain(preview.bossName)
    expect(preview.bossHint).toMatch(/veleno/i)
  })
  it('final-area boss is unchanged — no wall', () => {
    const finalArea = BALANCE.map.areas - 1
    const { battle, preview } = buildBattlePackage('seed-a', finalArea, 3, 'boss')
    expect(battle.unitDamageReduction ?? 0).toBe(0)
    expect(BOSSES_BY_AREA[finalArea]!.map(b => b.name)).toContain(preview.bossName)
  })
  it('non-boss node carries no wall', () => {
    const { battle } = buildBattlePackage('seed-a', 0, 1, 'battle')
    expect(battle.unitDamageReduction ?? 0).toBe(0)
  })
})
