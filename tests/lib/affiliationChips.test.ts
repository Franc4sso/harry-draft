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
  it('adds a special chip for the Tossicità origin synergy carrying its synergyId', () => {
    // Golden Trio (an id-list group synergy) was removed along with the other 8 team synergies
    // (2026-07-21) — Tossicità (origin, tag:veleno) is the only synergy left that can produce a
    // special chip. bellatrix carries the veleno tag (data/wizards.ts).
    const chips = affiliationChips(WIZARD_BY_ID['bellatrix']!)
    const tox = chips.find(c => c.kind === 'special' && c.synergyId === 'tossicita')
    expect(tox).toBeTruthy()
    expect(tox!.label).toBe('Tossicità')
  })
  it('emits no special chip for a wizard matching no remaining synergy (harry has no veleno tag)', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    expect(chips.filter(c => c.kind === 'special')).toHaveLength(0)
  })
  it('does not emit a special chip for house/role-kind synergies', () => {
    const chips = affiliationChips(WIZARD_BY_ID['bellatrix']!)
    const specials = chips.filter(c => c.kind === 'special')
    // every special must be a group/origin synergy, never "3 Grifondoro"/"3 Attaccanti"
    for (const s of specials) expect(/^\d/.test(s.label)).toBe(false)
  })
  it('has no duplicate chip ids', () => {
    const chips = affiliationChips(WIZARD_BY_ID['hermione']!)
    expect(new Set(chips.map(c => c.id)).size).toBe(chips.length)
  })
})
