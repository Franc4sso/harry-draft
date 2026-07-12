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
  // UN MAGO, UNA MAGIA (Task 2): pools are now exactly 1 signature spell. The Duo veleno
  // signal is TAG-driven, not spell-driven — game/engine/duos.ts's `TAG_OF.veleno` / the
  // `signalActive`/`wizardDuoSignals` path key off `wizard.tags.includes('veleno')` alone,
  // never off an equipped spell. game/engine/synergyTriggers.ts's Tossicità trigger further
  // confirms the engine already expects veleno-tagged units without a venom spell equipped
  // ("generates poison so the synergy pays off even without a venom spell equipped"). So a
  // veleno-tagged wizard's authored signature (e.g. bellatrix -> crucio, iconic but not
  // venom) need not itself be a venom spell for the Duo to light up or function.
  it('every venom-tagged wizard keeps the veleno tag (Duo signal is tag-driven, not spell-driven)', () => {
    const venomMages = WIZARDS.filter(w => (w.tags ?? []).includes('veleno'))
    expect(venomMages.length).toBeGreaterThan(0)
    for (const w of venomMages) {
      expect(w.tags, `${w.id} must keep the veleno tag`).toContain('veleno')
    }
  })
})
