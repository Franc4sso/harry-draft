import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import type { ActiveSynergy, DraftedWizard } from '@/types'

function stubTeam(): DraftedWizard[] {
  return [{
    wizard: { id: 'w1', name: 'W1', house: 'Grifondoro', baseStats: { hp: 100, atk: 10, def: 5, spd: 5 }, spellIds: [], tags: [] },
    stats: { hp: 100, atk: 10, def: 5, spd: 5 },
    spell: { id: 's', name: 's', type: 'Attacco', hitChance: 1, cooldown: 0, spec: [{ kind: 'damage', power: 1 }] },
    level: 1,
  } as unknown as DraftedWizard]
}

// A single Tassorosso wizard, presented as a 4-member Tassorosso house synergy so
// houseEffects() grants damageReduction: HUFF_REDUCE[2] = 0.24 (see game/engine/houseEffects.ts).
// This is the only public way to preset a nonzero pre-wall damageReduction on a unit built by
// toBattleUnits (the field itself can't be set directly — it's computed inside that function).
function stubHuffTeam(): DraftedWizard[] {
  return [{
    wizard: { id: 'h1', name: 'H1', house: 'Tassorosso', baseStats: { hp: 100, atk: 10, def: 5, spd: 5 }, spellIds: [], tags: [] },
    stats: { hp: 100, atk: 10, def: 5, spd: 5 },
    spell: { id: 's', name: 's', type: 'Attacco', hitChance: 1, cooldown: 0, spec: [{ kind: 'damage', power: 1 }] },
    level: 1,
  } as unknown as DraftedWizard]
}

const huffSynergy4: ActiveSynergy = {
  synergy: {
    id: 'hufflepuff4', name: '4 Tassorosso', kind: 'house', family: 'house:Tassorosso',
    requires: { house: 'Tassorosso', count: 4 }, bonus: {},
  },
  memberIds: ['h1'],
}

describe('wall damageReduction application', () => {
  it('applies the wall value to units when no house effect present', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0, 0.4)
    expect(units[0]!.damageReduction).toBe(0.4)
  })
  it('takes the MAX of existing and wall, not the sum, when wall > existing', () => {
    // Tassorosso 4-tier house effect presets damageReduction = 0.24 before the wall is applied.
    const units = toBattleUnits(stubHuffTeam(), 'right', [huffSynergy4], [], 0, 0.4)
    expect(units[0]!.damageReduction).toBe(Math.max(0.24, 0.4))
    expect(units[0]!.damageReduction).toBe(0.4) // would be 0.64 if additive
  })
  it('takes the MAX of existing and wall, not the sum, when existing > wall', () => {
    // Existing house dr (0.24) exceeds a smaller wall (0.1) — result must stay at the existing value.
    const units = toBattleUnits(stubHuffTeam(), 'right', [huffSynergy4], [], 0, 0.1)
    expect(units[0]!.damageReduction).toBe(Math.max(0.24, 0.1))
    expect(units[0]!.damageReduction).toBe(0.24) // would be 0.34 if additive
  })
  it('is undefined/absent when no wall passed and no house effect', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0)
    expect(units[0]!.damageReduction ?? 0).toBe(0)
  })
})
