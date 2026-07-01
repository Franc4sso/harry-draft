import { describe, it, expect } from 'vitest'
import { spellEffectDetails } from '@/lib/glossary'
import type { Spell } from '@/types/spell'
import { SPELL_BY_ID } from '@/data/spells'

const spdDebuff: Spell = {
  id: 'x', name: 'X', desc: 'd', type: 'Controllo', hitChance: 0.9, cooldown: 1,
  effects: [{ kind: 'debuff', stat: 'spd', amount: 15, duration: 2 }],
}

const stunSpell: Spell = {
  id: 'y', name: 'Y', desc: 'd', type: 'Controllo', hitChance: 0.88, cooldown: 1,
  effects: [{ kind: 'stun', duration: 1 }],
}

const atkSpell: Spell = {
  id: 'z', name: 'Z', desc: 'd', type: 'Attacco', power: 1.4, hitChance: 0.9, cooldown: 1,
}

describe('spellEffectDetails', () => {
  it('describes an inline stat debuff with the stat name, magnitude, and "permanente"/"cumulativo" (not "per N turni")', () => {
    const lines = spellEffectDetails(spdDebuff)
    expect(lines.length).toBeGreaterThan(0)
    const line = lines.join(' | ')
    expect(line).toMatch(/vel|velocit/i)
    expect(line).toContain('15')
    expect(line).toMatch(/permanente/i)
    expect(line).toMatch(/cumulativo/i)
    expect(line).not.toMatch(/per\s+\d+\s+turni/i)
  })

  it('describes a stun effect as timed: "Stordisce ... per N turni"', () => {
    const lines = spellEffectDetails(stunSpell)
    expect(lines.length).toBeGreaterThan(0)
    const line = lines.join(' | ')
    expect(line).toMatch(/stordisc/i)
    expect(line).toMatch(/per\s+1\s+turn/i)
  })

  it('gives a non-empty phrase for statusId-based control spells (regression: silencio used to show nothing)', () => {
    const silencio = SPELL_BY_ID['silencio']!
    const lines = spellEffectDetails(silencio)
    expect(lines.length).toBeGreaterThan(0)
    const line = lines.join(' | ')
    expect(line).toMatch(/silenz/i)
    expect(line).toMatch(/per\s+\d+\s+turni/i)
  })

  it('gives a non-empty phrase for glacius (statusId: freeze)', () => {
    const glacius = SPELL_BY_ID['glacius']!
    const lines = spellEffectDetails(glacius)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.join(' | ')).toMatch(/congel/i)
  })

  it('leaves attack spells with no effect lines (unaffected)', () => {
    expect(spellEffectDetails(atkSpell)).toEqual([])
  })
})
