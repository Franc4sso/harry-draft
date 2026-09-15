import { describe, it, expect } from 'vitest'
import { tierFrame } from '@/lib/theme'
import type { Tier } from '@/types'

const TIERS: Tier[] = [1, 2, 3, 4]

describe('tierFrame — cornici sobrie', () => {
  it('nessuna cornice usa un gradiente metallico a più di due stop', () => {
    for (const t of TIERS) {
      const stops = (tierFrame(t).background.match(/#[0-9a-f]{3,8}/gi) ?? []).length
      expect(stops, `tier ${t} ha ${stops} colori nel background`).toBeLessThanOrEqual(2)
    }
  })

  it('nessun alone supera i 20px', () => {
    for (const t of TIERS) {
      const blurs = [...tierFrame(t).boxShadow.matchAll(/(\d+)px\s+rgba/g)].map(m => Number(m[1]))
      for (const b of blurs) expect(b, `tier ${t}`).toBeLessThanOrEqual(20)
    }
  })

  it('le rarità basse non hanno alcun alone colorato', () => {
    for (const t of [3, 4] as Tier[]) {
      expect(tierFrame(t).boxShadow).not.toMatch(/rgba\((?!0,\s*0,\s*0)/)
    }
  })

  it('ogni rarità ha un numero di tacche crescente', () => {
    expect(tierFrame(4).pips).toBe(1)
    expect(tierFrame(3).pips).toBe(2)
    expect(tierFrame(2).pips).toBe(3)
    expect(tierFrame(1).pips).toBe(4)
  })

  it('ogni rarità ha una keyline diversa dalle altre', () => {
    const keys = TIERS.map(t => tierFrame(t).keyline)
    expect(new Set(keys).size).toBe(4)
  })
})
