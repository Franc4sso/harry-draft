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
    // Il blur è il TERZO valore di ogni ombra (`offsetX offsetY blur [spread] rgba(…)`).
    // La prima versione di questo test prendeva il numero adiacente a `rgba(`: funziona
    // solo finché nessuna ombra usa lo spread, perché in quel caso catturerebbe lo
    // spread e lascerebbe passare un blur enorme. Qui si scompone ogni ombra e si
    // legge la posizione giusta. (Difetto segnalato in review, 2026-09-15.)
    for (const t of TIERS) {
      const shadows = tierFrame(t).boxShadow.split(/,(?![^(]*\))/)
      for (const shadow of shadows) {
        const nums = [...shadow.matchAll(/(-?[\d.]+)px/g)].map(m => Number(m[1]))
        const blur = nums[2]
        if (blur === undefined) continue
        expect(blur, `tier ${t}, ombra "${shadow.trim()}"`).toBeLessThanOrEqual(20)
      }
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
