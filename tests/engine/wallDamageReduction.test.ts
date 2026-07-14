import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import type { DraftedWizard } from '@/types'

function stubTeam(): DraftedWizard[] {
  return [{
    wizard: { id: 'w1', name: 'W1', house: 'Grifondoro', baseStats: { hp: 100, atk: 10, def: 5, spd: 5 }, spellIds: [], tags: [] },
    stats: { hp: 100, atk: 10, def: 5, spd: 5 },
    spell: { id: 's', name: 's', type: 'Attacco', hitChance: 1, cooldown: 0, spec: [{ kind: 'damage', power: 1 }] },
    level: 1,
  } as unknown as DraftedWizard]
}

// NOTE: the two former MAX-combine tests here relied on houseEffects() (deleted, dead code —
// 0 house synergies remain post house-power removal) to preset a nonzero damageReduction before
// the wall was applied. There is currently no live source that presets damageReduction on a
// BattleUnit, so that branch of toBattleUnits (base.damageReduction = Math.max(existing, wall))
// is presently untestable from the public API without a fixture from another mechanic. Coverage
// dropped to the two cases that remain live: wall alone, and neither present.
describe('wall damageReduction application', () => {
  it('applies the wall value to units when no house effect present', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0, 0.4)
    expect(units[0]!.damageReduction).toBe(0.4)
  })
  it('is undefined/absent when no wall passed and no house effect', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0)
    expect(units[0]!.damageReduction ?? 0).toBe(0)
  })
})
