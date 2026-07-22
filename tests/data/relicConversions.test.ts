import { describe, it, expect } from 'vitest'
import { RELIC_BY_ID, JOKER_RELIC_IDS } from '@/data/relics'
import { STARTER_RELICS } from '@/data/unlocks'

describe('conversione reliquie flat', () => {
  it('giratempo è un carrier +30 SPD (assignable, niente bonus team)', () => {
    const r = RELIC_BY_ID['giratempo']!
    expect(r.assignable).toBe(true)
    expect(r.carrierBonus).toEqual({ spd: 30 })
    expect(r.bonus).toBeUndefined()
  })
  it('mantello-invisibilita è un carrier +26 DEF (assignable, niente bonus team)', () => {
    const r = RELIC_BY_ID['mantello-invisibilita']!
    expect(r.assignable).toBe(true)
    expect(r.carrierBonus).toEqual({ def: 26 })
    expect(r.bonus).toBeUndefined()
  })
  it('pensatoio è drawback +35 ATK / -18 DEF ed è un JOKER', () => {
    const r = RELIC_BY_ID['pensatoio']!
    expect(r.bonus).toEqual({ atk: 35 })
    expect(r.drawback).toEqual({ def: -18 })
    expect(JOKER_RELIC_IDS).toContain('pensatoio')
    expect(STARTER_RELICS).toContain('pensatoio')
  })
  it('bacchetta-sambuco è +20% condizionale su ≥3 Grifondoro', () => {
    const r = RELIC_BY_ID['bacchetta-sambuco']!
    expect(r.bonus).toEqual({ allPct: 0.20 })
    expect(r.condition).toEqual({ house: 'Grifondoro', count: 3 })
  })
})
