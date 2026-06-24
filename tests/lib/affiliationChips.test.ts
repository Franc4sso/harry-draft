import { describe, it, expect } from 'vitest'
import { affiliationChips } from '@/lib/affiliationChips'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('affiliationChips', () => {
  it('puts a name-only house chip first, never the raw synergy name with a count', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    expect(chips[0]!.kind).toBe('house')
    expect(chips[0]!.label).toBe('Grifondoro')
    // No chip label may start with a digit ("3 Grifondoro" etc.)
    for (const c of chips) expect(/^\d/.test(c.label)).toBe(false)
  })
  it('includes a role chip with the role name', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    const role = chips.find(c => c.kind === 'role')
    expect(role).toBeTruthy()
    expect(role!.label).toBe(WIZARD_BY_ID['harry']!.role)
  })
  it('adds a special chip for group synergies (Golden Trio) carrying its synergyId', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    const trio = chips.find(c => c.kind === 'special' && c.synergyId === 'goldenTrio')
    expect(trio).toBeTruthy()
    expect(trio!.label).toBe('Golden Trio')
  })
  it('does not emit a special chip for house/role-kind synergies', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    const specials = chips.filter(c => c.kind === 'special')
    // every special must be a group/origin synergy, never "3 Grifondoro"/"3 Attaccanti"
    for (const s of specials) expect(/^\d/.test(s.label)).toBe(false)
  })
  it('has no duplicate chip ids', () => {
    const chips = affiliationChips(WIZARD_BY_ID['hermione']!)
    expect(new Set(chips.map(c => c.id)).size).toBe(chips.length)
  })
})
