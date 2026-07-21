import { describe, it, expect } from 'vitest'
import { SYNERGIES } from '@/data/synergies'
import { BOSSES } from '@/data/bosses'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('synergies data', () => {
  it('contiene solo Tossicità (stile veleno), nessuna sinergia di squadra', () => {
    expect(SYNERGIES.length).toBe(1)
    expect(SYNERGIES[0]!.id).toBe('tossicita')
    expect(SYNERGIES[0]!.bonus).toEqual({ keywordMult: { veleno: 0.5 } })
  })
  it('group synergies reference existing wizards', () => {
    for (const s of SYNERGIES) {
      for (const id of s.requires.ids ?? []) expect(WIZARD_BY_ID[id], id).toBeTruthy()
    }
  })
  it('defines at least one boss', () => {
    expect(BOSSES.length).toBeGreaterThanOrEqual(1)
    expect(BOSSES[0]?.hpMult).toBeGreaterThan(1)
  })
})
