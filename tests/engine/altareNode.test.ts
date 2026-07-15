import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { areaRng } from '@/game/engine/runEngine'

const bias = { teamSize: 3, teamMax: 5 }

describe('Nodo Altare — generazione', () => {
  it('~30% delle aree ha ESATTAMENTE un altare (mai 2+), banda [15%, 45%] su 300 aree', () => {
    let with1 = 0
    for (let i = 0; i < 300; i++) {
      const nodes = generateArea(areaRng(`alt-${i}`, 0), `alt-${i}`, 0, bias)
      const n = nodes.filter(nd => nd.type === 'altare').length
      expect(n).toBeLessThanOrEqual(1)
      if (n === 1) with1++
    }
    expect(with1 / 300).toBeGreaterThan(0.15)
    expect(with1 / 300).toBeLessThan(0.45)
  })
  it("l'altare non ruba MAI i garantiti: infermeria pre-boss, elite, >=1 relic restano", () => {
    for (let i = 0; i < 100; i++) {
      const nodes = generateArea(areaRng(`alt-${i}`, 0), `alt-${i}`, 0, bias)
      expect(nodes.filter(n => n.type === 'infirmary')).toHaveLength(1)
      expect(nodes.filter(n => n.type === 'elite')).toHaveLength(1)
      expect(nodes.filter(n => n.type === 'relic').length).toBeGreaterThanOrEqual(1)
    }
  })
  it('endless: MAI un altare (evita il soft-lock del controller endless)', () => {
    for (let i = 0; i < 100; i++) {
      const nodes = generateArea(areaRng(`alt-${i}`, 0), `alt-${i}`, 0, bias, true)
      expect(nodes.filter(n => n.type === 'altare')).toHaveLength(0)
    }
  })
  it('deterministico: stesso seed → stessa mappa', () => {
    const a = generateArea(areaRng('alt-det', 1), 'alt-det', 1, bias)
    const b = generateArea(areaRng('alt-det', 1), 'alt-det', 1, bias)
    expect(a.map(n => n.type)).toEqual(b.map(n => n.type))
  })
})
