import { describe, it, expect } from 'vitest'
import { SPELLS, SPELL_BY_ID, SPELL_IS_VENOM } from '@/data/spells'
import { WIZARDS } from '@/data/wizards'

describe('venom spells', () => {
  it('serpensortia is the canonical venom spell and applies status veleno', () => {
    const s = SPELL_BY_ID['serpensortia']
    expect(s).toBeDefined()
    const applies = (s!.spec ?? []).some(e => e.kind === 'applyStatus' && e.statusId === 'veleno')
    expect(applies, 'serpensortia applies veleno').toBe(true)
  })
  it('SPELL_IS_VENOM contains exactly the spells whose spec applies veleno', () => {
    const expected = SPELLS.filter(s => (s.spec ?? []).some(e => e.kind === 'applyStatus' && e.statusId === 'veleno')).map(s => s.id)
    expect([...SPELL_IS_VENOM].sort()).toEqual(expected.sort())
    expect(SPELL_IS_VENOM.has('serpensortia')).toBe(true)
  })
  it('every venom-tagged wizard has >=1 venom spell in its pool', () => {
    const venomMages = WIZARDS.filter(w => (w.tags ?? []).includes('veleno'))
    expect(venomMages.length).toBeGreaterThan(0)
    for (const w of venomMages) {
      const has = w.spellPool.some(id => SPELL_IS_VENOM.has(id))
      expect(has, `${w.id} has a venom spell`).toBe(true)
    }
  })
})
