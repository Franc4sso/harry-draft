import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { areaRng } from '@/game/engine/runEngine'

const bias = { teamSize: 3, teamMax: 5 }

describe('Nodo Altare — generazione', () => {
  it('OGNI area (campaign) ha ESATTAMENTE un altare — garantito, su 300 aree', () => {
    for (let i = 0; i < 300; i++) {
      const nodes = generateArea(areaRng(`alt-${i}`, 0), `alt-${i}`, 0, bias)
      const n = nodes.filter(nd => nd.type === 'altare').length
      expect(n).toBe(1)
    }
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
