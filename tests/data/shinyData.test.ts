import { describe, it, expect } from 'vitest'
import { TRAITS, SHINY_TRAIT_IDS } from '@/data/traits'
import { WIZARDS } from '@/data/wizards'

describe('shiny data integrity', () => {
  it('every trait has masculine and feminine epithets', () => {
    for (const t of TRAITS) {
      expect(t.epithet?.m, `${t.id} epithet.m`).toBeTruthy()
      expect(t.epithet?.f, `${t.id} epithet.f`).toBeTruthy()
    }
  })
  it('SHINY_TRAIT_IDS lists all 16 trait ids', () => {
    expect(SHINY_TRAIT_IDS).toHaveLength(16)
    expect(new Set(SHINY_TRAIT_IDS).size).toBe(16)
  })
  it('every wizard has a gender', () => {
    for (const w of WIZARDS) expect(w.gender, `${w.id} gender`).toMatch(/^[mf]$/)
  })
})
