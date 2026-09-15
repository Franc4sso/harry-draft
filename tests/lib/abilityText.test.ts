import { describe, it, expect } from 'vitest'
import { abilityText } from '@/lib/abilityText'
import { SIGNATURES } from '@/data/signatures'

describe('abilityText', () => {
  it('un mago senza firma non ha testo', () => {
    expect(abilityText('goyle')).toBeUndefined()
  })

  it('ogni firma del catalogo ha un testo riscritto', () => {
    for (const sig of SIGNATURES) {
      const t = abilityText(sig.id)
      expect(t, `manca il testo per la firma "${sig.id}"`).toBeDefined()
      expect(t!.name).toBe(sig.name)
      expect(t!.lines.length).toBeGreaterThan(0)
    }
  })

  it('ogni riga apre con un numero', () => {
    for (const sig of SIGNATURES) {
      for (const line of abilityText(sig.id)!.lines) {
        expect(line.value, `firma "${sig.id}"`).toMatch(/[0-9]/)
      }
    }
  })

  it('nessuna riga usa "possono" — le probabilità sono numeri', () => {
    for (const sig of SIGNATURES) {
      for (const line of abilityText(sig.id)!.lines) {
        expect(line.what).not.toMatch(/possono|può/i)
      }
    }
  })

  it('Voldemort ha due righe: esecuzione e terrore', () => {
    const t = abilityText('voldemort')!
    expect(t.lines).toEqual([
      { value: '+50%', what: 'danni sotto il 40% di vita' },
      { value: '35%', what: 'semina terrore (−ATT)' },
    ])
  })
})
