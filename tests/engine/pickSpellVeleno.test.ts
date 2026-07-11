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
  // UN MAGO, UNA MAGIA (Task 2) collapsed every spellPool to exactly 1 signature. dolohov/
  // blaise (venom Attaccante) were authored with their most iconic Attacco (sectumsempra)
  // rather than serpensortia — the Duo veleno signal is TAG-driven (game/engine/duos.ts's
  // signalActive/wizardDuoSignals key off wizard.tags, never off the equipped spell), so
  // this is an intentional data choice (see tests/data/velenoSpells.test.ts). pickSpell
  // itself is UNCHANGED in this task (Task 3 scope) — its "venom guarantee" candidate
  // restriction (statRoll.ts) simply becomes a no-op once spellPool has no venom candidate:
  // the sole signature is always returned regardless of the venom tag. Task 3 should
  // revisit whether pickSpell's now-dead venom-guarantee branch should be removed.
  it('a venom ATTACCANTE with a non-venom signature deterministically equips that signature (guarantee is now a no-op)', () => {
    expect(SPELL_IS_VENOM.has(venomAttacker.spellPool[0]!)).toBe(false)
    for (let i = 0; i < 50; i++) {
      const spell = pickSpell(createRng(`s${i}`), venomAttacker)
      expect(spell.id, `seed ${i} → ${spell.id}`).toBe(venomAttacker.spellPool[0])
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
