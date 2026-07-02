import { describe, it, expect } from 'vitest'
import { SPELLS, SPELL_BY_ID } from '@/data/spells'

describe('spells data', () => {
  it('has at least 30 spells', () => { expect(SPELLS.length).toBeGreaterThanOrEqual(30) })
  it('has unique ids', () => {
    expect(new Set(SPELLS.map(s => s.id)).size).toBe(SPELLS.length)
  })
  it('covers all spell types', () => {
    const types = new Set(SPELLS.map(s => s.type))
    expect(types).toEqual(new Set(['Attacco', 'Difesa', 'Cura', 'Controllo']))
  })
  it('hitChance within [0,1] and attack spells deal power', () => {
    for (const s of SPELLS) {
      expect(s.hitChance).toBeGreaterThan(0)
      expect(s.hitChance).toBeLessThanOrEqual(1)
      if (s.type === 'Attacco') {
        const hasPower = (s.power ?? 0) > 0
        const hasSpecDamage = s.spec?.some(e => e.kind === 'damage' && e.power > 0) ?? false
        expect(hasPower || hasSpecDamage).toBe(true)
      }
      if (s.type === 'Cura') {
        const hasHeal = (s.heal ?? 0) > 0
        const hasSpecHeal = s.spec?.some(e => e.kind === 'heal' && e.amount > 0) ?? false
        expect(hasHeal || hasSpecHeal).toBe(true)
      }
    }
  })
  it('exposes a base attack and a lookup map', () => {
    expect(SPELL_BY_ID['base_attack']).toBeTruthy()
    expect(SPELL_BY_ID['base_attack']?.cooldown ?? 0).toBe(0)
  })
})
