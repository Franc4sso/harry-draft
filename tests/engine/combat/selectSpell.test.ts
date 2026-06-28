import { describe, it, expect } from 'vitest'
import { selectSpell } from '@/game/engine/combat/selectSpell'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit } from '@/types'

function unit(spellId: string, cd = 0, statuses: BattleUnit['statusEffects'] = []): BattleUnit {
  return {
    wizard: { id: 'w', name: 'W', house: 'Grifondoro', role: 'Attaccante' } as any,
    side: 'left', hp: 100, maxHp: 100, alive: true,
    buffedStats: { hp: 100, atk: 50, def: 30, spd: 20 },
    spell: SPELL_BY_ID[spellId]!, cooldowns: { [spellId]: cd }, statusEffects: statuses,
  } as unknown as BattleUnit
}

describe('selectSpell', () => {
  it('returns the spell when ready (cooldown 0)', () => {
    expect(selectSpell(unit('stupeficium', 0))?.id).toBe('stupeficium')
  })
  it('returns null (WAIT) when the spell is on cooldown', () => {
    expect(selectSpell(unit('stupeficium', 1))).toBeNull()
  })
  it('falls back to base_attack when silenced (cannot cast), not WAIT', () => {
    const silenced = unit('stupeficium', 0, [{ kind: 'silence', statusId: 'silence', remaining: 2 } as any])
    expect(selectSpell(silenced)?.id).toBe('base_attack')
  })
})
