import { describe, it, expect } from 'vitest'
import { pickSpell, ROLE_SPELL_TYPES } from '@/game/engine/statRoll'
import { SPELL_IS_VENOM, SPELL_BY_ID } from '@/data/spells'
import { WIZARDS } from '@/data/wizards'
import { createRng } from '@/game/engine/rng'

// A venom mage whose ROLE is Attaccante (venom IS in-role — serpensortia is an Attacco).
const venomAttacker = WIZARDS.find(w => (w.tags ?? []).includes('veleno') && w.role === 'Attaccante')!
// A venom mage whose ROLE is NOT Attaccante (Controllo/Tank): venom would be OUT of role.
const venomOffRole = WIZARDS.find(w => (w.tags ?? []).includes('veleno') && w.role !== 'Attaccante')!
const plainMage = WIZARDS.find(w => !(w.tags ?? []).includes('veleno'))!

describe('pickSpell venom vs role', () => {
  // The venom guarantee holds ONLY when venom fits the mage's role. A venom Attaccante
  // (dolohov/blaise) always equips serpensortia — that IS its job (damage-over-time attacker).
  it('a venom ATTACCANTE always equips a venom spell, across many seeds', () => {
    for (let i = 0; i < 50; i++) {
      const spell = pickSpell(createRng(`s${i}`), venomAttacker)
      expect(SPELL_IS_VENOM.has(spell.id), `seed ${i} → ${spell.id}`).toBe(true)
    }
  })

  // A venom Controllo/Tank (bellatrix/pansy/theodore/greyback) must play its ROLE, not turn
  // into a poison attacker. serpensortia is an Attacco → it must NOT be forced when the mage
  // has an in-role spell. This is the fix for "the Controllo goes on the attack" bug.
  it('a venom CONTROLLO/TANK equips an in-role spell, never a forced venom attack', () => {
    const roleTypes = ROLE_SPELL_TYPES[venomOffRole.role]
    const hasInRole = venomOffRole.spellPool.some(id => roleTypes.includes(SPELL_BY_ID[id]!.type))
    expect(hasInRole, `${venomOffRole.id} has an in-role spell`).toBe(true)
    for (let i = 0; i < 50; i++) {
      const spell = pickSpell(createRng(`v${i}`), venomOffRole)
      expect(roleTypes.includes(spell.type), `seed ${i} → ${spell.id} (${spell.type})`).toBe(true)
    }
  })

  it('a non-venom mage picks from its normal pool', () => {
    const spell = pickSpell(createRng('x'), plainMage)
    expect(plainMage.spellPool).toContain(spell.id)
  })
  it('is deterministic for a given seed', () => {
    expect(pickSpell(createRng('k'), venomOffRole).id).toBe(pickSpell(createRng('k'), venomOffRole).id)
  })
})
