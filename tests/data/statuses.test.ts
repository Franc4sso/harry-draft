import { describe, it, expect } from 'vitest'
import { STATUS_DEFS, STATUS_BY_ID } from '@/data/statuses'

describe('statuses data', () => {
  it('has unique ids', () => {
    expect(new Set(STATUS_DEFS.map(s => s.id)).size).toBe(STATUS_DEFS.length)
  })
  it('covers every family', () => {
    const fams = new Set(STATUS_DEFS.map(s => s.family))
    expect(fams).toEqual(new Set(['control', 'dot', 'regen', 'shield', 'buff', 'debuff']))
  })
  it('field coherence per family', () => {
    for (const d of STATUS_DEFS) {
      if (d.family === 'control') expect(d.prevents?.length).toBeGreaterThan(0)
      if (d.family === 'dot') expect(d.tickDamage ?? 0).toBeGreaterThan(0)
      if (d.family === 'regen') expect(d.tickHeal ?? 0).toBeGreaterThan(0)
      if (d.family === 'shield') expect(d.absorb ?? 0).toBeGreaterThan(0)
      if (d.family === 'buff' || d.family === 'debuff') expect(d.statMod).toBeTruthy()
      expect(d.defaultDuration).toBeGreaterThan(0)
    }
  })
  it('lookup map matches array', () => {
    expect(Object.keys(STATUS_BY_ID).length).toBe(STATUS_DEFS.length)
    expect(STATUS_BY_ID['burn']?.tickDamage).toBeGreaterThan(0)
  })
})
