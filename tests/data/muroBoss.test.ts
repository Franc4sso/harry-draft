import { describe, it, expect } from 'vitest'
import { MURO, type BossDef } from '@/data/bosses'

describe('Muro boss def', () => {
  it('is pinned to area 0 with a soft wall value', () => {
    expect(MURO.id).toBe('muro_boss')
    expect(MURO.name).toBe('Il Muro')
    expect(MURO.pinnedArea).toBe(0)
    expect(MURO.unitDamageReduction).toBeGreaterThan(0)
    expect(MURO.unitDamageReduction).toBeLessThan(0.7) // soft wall, not hard-gate
  })
  it('BossDef exposes optional wall fields', () => {
    const d: BossDef = { id: 'x', name: 'x', budget: 1, hpMult: 1, unitDamageReduction: 0.3, pinnedArea: 0 }
    expect(d.unitDamageReduction).toBe(0.3)
    expect(d.pinnedArea).toBe(0)
  })
})
