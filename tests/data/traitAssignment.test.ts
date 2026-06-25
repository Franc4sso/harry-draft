import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'

/** The trait pool each role may draw from (must match the design spec). */
const ROLE_POOLS: Record<string, string[]> = {
  Attaccante: ['esecuzione', 'furia', 'ferocia', 'crescendo', 'veleno', 'frantumazione'],
  Controllo: ['pietrificazione', 'bavaglio', 'disarmo', 'logoramento', 'sifone', 'anticipo', 'frantumazione', 'gelo'],
  Supporto: ['benedizione', 'rigenerazione'],
  Tank: ['roccia', 'vendetta'],
}

describe('trait assignment', () => {
  it('gives every wizard at least one trait', () => {
    const missing = WIZARDS.filter(w => !w.traits || w.traits.length === 0).map(w => w.id)
    expect(missing).toEqual([])
  })

  it('only references traits that exist in the catalog', () => {
    const unknown: string[] = []
    for (const w of WIZARDS) for (const t of w.traits ?? []) {
      if (!TRAIT_BY_ID[t]) unknown.push(`${w.id}:${t}`)
    }
    expect(unknown).toEqual([])
  })

  it('only assigns traits from the wizard role pool', () => {
    const offenders: string[] = []
    for (const w of WIZARDS) {
      const pool = ROLE_POOLS[w.role] ?? []
      for (const t of w.traits ?? []) {
        if (!pool.includes(t)) offenders.push(`${w.id}(${w.role}):${t}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('preserves the four pre-existing assignments exactly', () => {
    const byId = Object.fromEntries(WIZARDS.map(w => [w.id, w.traits]))
    expect(byId['voldemort']).toEqual(['esecuzione', 'furia'])
    expect(byId['bellatrix']).toEqual(['sifone'])
    expect(byId['mcgonagall']).toEqual(['roccia'])
    expect(byId['lupin']).toEqual(['benedizione'])
  })
})
