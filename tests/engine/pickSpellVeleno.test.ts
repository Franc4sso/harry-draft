import { describe, it, expect } from 'vitest'
import { pickSpell } from '@/game/engine/statRoll'
import { SPELL_BY_ID } from '@/data/spells'
import { WIZARDS } from '@/data/wizards'
import { createRng } from '@/game/engine/rng'

// UN MAGO, UNA MAGIA (Task 2) collapsed every spellPool to exactly 1 signature, and
// Task 3 removed pickSpell's role/venom candidate-restriction logic (it was dead once the
// pool can no longer mix signatures). pickSpell now always resolves to the wizard's sole
// signature, regardless of seed, role, or the 'veleno' tag — it still burns exactly one
// rng.pick() per call so the draft's draw-count (and endless replay parity) is unchanged.
describe('pickSpell — pool-of-1', () => {
  it('always returns the wizard\'s single signature, for any wizard and any seed', () => {
    for (const w of WIZARDS) {
      for (const s of ['a', 'b', 'c']) {
        const spell = pickSpell(createRng(s), w)
        expect(spell.id, `${w.id} seed ${s} → ${spell.id}`).toBe(w.spellPool[0])
      }
    }
  })

  it('is deterministic for a given seed', () => {
    const w = WIZARDS[0]!
    expect(pickSpell(createRng('k'), w).id).toBe(pickSpell(createRng('k'), w).id)
  })

  it('throws if the signature id is not in the spell registry', () => {
    const bogus = { ...WIZARDS[0]!, spellPool: ['not_a_real_spell_id'] }
    expect(() => pickSpell(createRng('x'), bogus)).toThrow()
  })

  it('SPELL_BY_ID resolves every real wizard\'s signature', () => {
    for (const w of WIZARDS) {
      expect(SPELL_BY_ID[w.spellPool[0]!], `${w.id} → ${w.spellPool[0]}`).toBeTruthy()
    }
  })
})
