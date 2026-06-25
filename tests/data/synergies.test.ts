import { describe, it, expect } from 'vitest'
import { SYNERGIES } from '@/data/synergies'
import { BOSSES } from '@/data/bosses'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('synergies data', () => {
  it('has house, role and group synergies', () => {
    const kinds = SYNERGIES.map(s => s.kind)
    // 4 houses × 3 tiers (2/3/4) = 12 house entries; same for roles
    expect(kinds.filter(k => k === 'house').length).toBe(12)
    expect(kinds.filter(k => k === 'role').length).toBe(12)
    expect(kinds.filter(k => k === 'group').length).toBeGreaterThanOrEqual(5)
  })
  it('group synergies reference existing wizards', () => {
    for (const s of SYNERGIES) {
      for (const id of s.requires.ids ?? []) expect(WIZARD_BY_ID[id], id).toBeTruthy()
    }
  })
  it('has a golden trio +15% all', () => {
    const trio = SYNERGIES.find(s => s.id === 'goldenTrio')
    expect(trio?.bonus.allPct).toBeCloseTo(0.15)
  })
  it('defines at least one boss', () => {
    expect(BOSSES.length).toBeGreaterThanOrEqual(1)
    expect(BOSSES[0]?.hpMult).toBeGreaterThan(1)
  })
})
