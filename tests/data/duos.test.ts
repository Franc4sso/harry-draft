import { describe, it, expect } from 'vitest'
import { DUOS, DUO_BY_ID, SIGNAL_LABEL } from '@/data/duos'

describe('DUOS data', () => {
  it('has 6 duos with unique ids and exactly 2 distinct signals each', () => {
    expect(DUOS).toHaveLength(6)
    expect(new Set(DUOS.map(d => d.id)).size).toBe(6)
    for (const d of DUOS) {
      expect(d.signals).toHaveLength(2)
      expect(d.signals[0]).not.toBe(d.signals[1])
      expect(d.name).toBeTruthy(); expect(d.desc).toBeTruthy()
    }
  })
  it('every signal has an Italian label', () => {
    for (const d of DUOS) for (const s of d.signals) expect(SIGNAL_LABEL[s]).toBeTruthy()
    expect(DUO_BY_ID['cancrena']?.name).toBe('Cancrena')
  })
})
