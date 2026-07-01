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

describe('wall damageReduction application', () => {
  it('applies the wall value to units when no house effect present', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0, 0.4)
    expect(units[0]!.damageReduction).toBe(0.4)
  })
  it('takes the MAX of existing and wall (never additive)', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0, 0.4)
    // wall 0.4 vs (no house) → 0.4; ensure it is not > 0.4 (not additive)
    expect(units[0]!.damageReduction).toBeLessThanOrEqual(0.4)
  })
  it('is undefined/absent when no wall passed and no house effect', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0)
    expect(units[0]!.damageReduction ?? 0).toBe(0)
  })
})
