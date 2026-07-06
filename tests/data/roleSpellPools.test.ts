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

  it('serpensortia (an Attacco) is banned ONLY on Supporto', () => {
    expect(isSpellAllowedForRole('Supporto', 'serpensortia')).toBe(false)
    // serpensortia is a direct Attacco → legit on the offensive/bruiser roles.
    expect(isSpellAllowedForRole('Tank', 'serpensortia')).toBe(true)
    expect(isSpellAllowedForRole('Controllo', 'serpensortia')).toBe(true)
    expect(isSpellAllowedForRole('Attaccante', 'serpensortia')).toBe(true)
  })

  it('confundo (a Controllo) is banned on a pure Attaccante', () => {
    expect(isSpellAllowedForRole('Attaccante', 'confundo')).toBe(false)
    expect(isSpellAllowedForRole('Controllo', 'confundo')).toBe(true)
  })
})
