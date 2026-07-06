import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { ROLE_SPELL_WHITELIST, isSpellAllowedForRole } from '@/lib/roleSpellPools'
import { SPELL_BY_ID } from '@/data/spells'

describe('role spell whitelist', () => {
  it('every wizard spell is allowed for its role', () => {
    const bad: string[] = []
    for (const w of WIZARDS) {
      for (const s of w.spellPool ?? []) {
        if (!isSpellAllowedForRole(w.role, s)) bad.push(`${w.id} (${w.role}) has out-of-role spell ${s}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('Supporto carries ZERO direct-attack spells (no Attacco/Controllo)', () => {
    const offenders: string[] = []
    for (const s of ROLE_SPELL_WHITELIST.Supporto) {
      const type = SPELL_BY_ID[s]?.type
      if (type === 'Attacco' || type === 'Controllo') offenders.push(`${s} is ${type}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('serpensortia is not allowed for Supporto, Tank, or Controllo', () => {
    expect(isSpellAllowedForRole('Supporto', 'serpensortia')).toBe(false)
    expect(isSpellAllowedForRole('Tank', 'serpensortia')).toBe(false)
    expect(isSpellAllowedForRole('Controllo', 'serpensortia')).toBe(false)
    expect(isSpellAllowedForRole('Attaccante', 'serpensortia')).toBe(true)
  })
})
