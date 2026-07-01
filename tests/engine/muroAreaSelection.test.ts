import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { MURO } from '@/data/bosses'
import { BALANCE } from '@/data/constants'

describe('Muro area-0 boss selection', () => {
  it('area-0 boss carries the Muro wall + hint', () => {
    const { battle, preview } = buildBattlePackage('seed-a', 0, 3, 'boss')
    expect(battle.unitDamageReduction).toBe(MURO.unitDamageReduction)
    expect(preview.bossName).toBe('Il Muro')
    expect(preview.bossHint).toMatch(/veleno/i)
  })
  it('final-area boss (Voldemort) is unchanged — no wall', () => {
    const finalArea = BALANCE.map.areas - 1
    const { battle, preview } = buildBattlePackage('seed-a', finalArea, 3, 'boss')
    expect(battle.unitDamageReduction ?? 0).toBe(0)
    expect(preview.bossName).toBe('Lord Voldemort')
  })
  it('non-boss node carries no wall', () => {
    const { battle } = buildBattlePackage('seed-a', 0, 1, 'battle')
    expect(battle.unitDamageReduction ?? 0).toBe(0)
  })
})
