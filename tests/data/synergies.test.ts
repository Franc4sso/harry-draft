import { describe, it, expect } from 'vitest'
import { SYNERGIES } from '@/data/synergies'
import { BOSSES } from '@/data/bosses'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('synergies data', () => {
  it('contiene solo sinergie di archetipo (tossicita, spietatezza, bastione, oscurita), nessuna sinergia di squadra tradizionale', () => {
    // I 9 team synergies (house/role/id-list) restano rimossi (2026-07-21). Spietatezza
    // (archetipo Carnefice, tag:esecuzione) è stata VOLUTAMENTE riaccesa (2026-07-21/22,
    // vedi Task 1 del piano Carnefice). Bastione (archetipo Muro Riflettente, tag:scudirigen)
    // è stata riaccesa allo stesso modo (2026-07-23, Task 1 del piano Muro). Oscurità
    // (archetipo magieOscure, Patto Oscuro) è la quarta sinergia di archetipo, riaccesa
    // (2026-07-23, piano Patto Oscuro) — non è una regressione, è la nuova verità.
    expect(SYNERGIES.length).toBe(4)
    expect(SYNERGIES[0]!.id).toBe('tossicita')
    expect(SYNERGIES[0]!.bonus).toEqual({ keywordMult: { veleno: 0.5 } })
    expect(SYNERGIES[1]!.id).toBe('spietatezza')
    expect(SYNERGIES[1]!.bonus).toEqual({ keywordMult: { esecuzione: 0.5 } })
    expect(SYNERGIES[2]!.id).toBe('bastione')
    expect(SYNERGIES[2]!.bonus).toEqual({ keywordMult: { scudo: 0.5 } })
    expect(SYNERGIES[3]!.id).toBe('oscurita')
    expect(SYNERGIES[3]!.bonus).toEqual({ keywordMult: { magieOscure: 0.5 } })
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
