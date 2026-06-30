import { describe, it, expect } from 'vitest'
import { pickSpell } from '@/game/engine/statRoll'
import { SPELL_IS_VENOM } from '@/data/spells'
import { WIZARDS } from '@/data/wizards'
import { createRng } from '@/game/engine/rng'

const venomMage = WIZARDS.find(w => (w.tags ?? []).includes('veleno'))!
const plainMage = WIZARDS.find(w => !(w.tags ?? []).includes('veleno'))!

describe('pickSpell venom guarantee', () => {
  it('a venom mage always gets a venom spell, across many seeds', () => {
    for (let i = 0; i < 50; i++) {
      const spell = pickSpell(createRng(`s${i}`), venomMage)
      expect(SPELL_IS_VENOM.has(spell.id), `seed ${i} → ${spell.id}`).toBe(true)
    }
  })
  it('a non-venom mage picks from its normal pool', () => {
    const spell = pickSpell(createRng('x'), plainMage)
    expect(plainMage.spellPool).toContain(spell.id)
  })
  it('is deterministic for a given seed', () => {
    expect(pickSpell(createRng('k'), venomMage).id).toBe(pickSpell(createRng('k'), venomMage).id)
  })
})
