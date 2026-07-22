import { describe, it, expect } from 'vitest'
import { RELICS, RELIC_BY_ID, JOKER_RELIC_IDS } from '@/data/relics'
import { STARTER_RELICS } from '@/data/unlocks'
import { selectEnemyRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

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

describe('invarianti pool dopo taglio+conversione', () => {
  it('le 3 reliquie tagliate non esistono più', () => {
    const ids = RELICS.map(r => r.id)
    expect(ids).not.toContain('occhio-moody')
    expect(ids).not.toContain('pozione-fortuna')
    expect(ids).not.toContain('bezoar')
  })

  it('selectEnemyRelics non ritorna mai un id in JOKER_RELIC_IDS (proprietà generale, copre pensatoio)', () => {
    // Firma reale: selectEnemyRelics(rng: Rng, count: number). Campiona su vari seed/count
    // per robustezza — nessuna fixture fragile, solo la proprietà di esclusione a livello di set.
    const jokerSet = new Set(JOKER_RELIC_IDS)
    for (let seed = 0; seed < 20; seed++) {
      const picked = selectEnemyRelics(createRng(`enemy-relics-${seed}`), 5)
      for (const { relic } of picked) {
        expect(jokerSet.has(relic.id)).toBe(false)
      }
    }
  })

  it('pensatoio in particolare non compare mai fra le reliquie nemiche', () => {
    for (let seed = 0; seed < 20; seed++) {
      const picked = selectEnemyRelics(createRng(`enemy-relics-pensatoio-${seed}`), 5)
      expect(picked.map(({ relic }) => relic.id)).not.toContain('pensatoio')
    }
  })
})
