import { describe, it, expect } from 'vitest'
import type { LogEntry, LogFlag } from '@/types'
import {
  HEAT, HEAT_ZERO, heatNext, heatAt, heatSeries, heatAmp,
} from '@/lib/vfx/crescendo'

function e(flags: LogFlag[], value = 20, over: Partial<LogEntry> = {}): LogEntry {
  return { turn: 1, actorId: 'a', action: 'Colpo base', targetId: 'b', type: 'Attacco', value, flags, ...over }
}

const sys = (): LogEntry => e([], 0, { type: 'system', action: 'Reliquia' })

describe('crescendo — modello del calore', () => {
  it('parte da zero', () => {
    expect(HEAT_ZERO.heat).toBe(0)
    expect(heatAt([], 0)).toBe(0)
  })

  it('una streak di uccisioni fa salire il calore in modo monotòno fino al clamp', () => {
    const entries = [e(['kill']), e(['kill']), e(['kill']), e(['kill'])]
    const series = heatSeries(entries)
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!).toBeGreaterThanOrEqual(series[i - 1]!)
    }
    expect(series.at(-1)!).toBe(1)
  })

  it('due-tre beat drammatici bastano per arrivare incandescenti', () => {
    const entries = [e(['crit']), e(['duo']), e(['kill'])]
    expect(heatAt(entries, 2)).toBeGreaterThan(0.8)
  })

  it('una pausa dopo la tempesta raffredda verso zero', () => {
    const entries = [e(['kill']), e(['kill']), e(['kill']), e(['wait'], 0), e(['wait'], 0), e(['wait'], 0)]
    const hot = heatAt(entries, 2)
    const cool = heatAt(entries, 5)
    expect(hot).toBeGreaterThan(0.9)
    expect(cool).toBeLessThan(hot * 0.3)
  })

  it('le righe di sistema non scaldano (lasciano decadere)', () => {
    const streak = [e(['kill']), e(['kill'])]
    const withSystem = [...streak, sys(), sys()]
    expect(heatAt(withSystem, 3)).toBeLessThan(heatAt(streak, 1))
  })

  it('schivate e parate sono fizzle: zero contributo', () => {
    expect(heatAt([e(['dodge'])], 0)).toBe(0)
    expect(heatAt([e(['block'])], 0)).toBe(0)
    expect(heatAt([e(['wait'], 0)], 0)).toBe(0)
  })

  it('un colpo piatto scalda molto meno di una esecuzione', () => {
    expect(heatAt([e([])], 0)).toBeLessThan(heatAt([e(['kill'])], 0))
  })

  it('resta sempre dentro [0,1], anche con flag accumulati e valori enormi', () => {
    const entries = Array.from({ length: 12 }, () => e(['kill', 'crit', 'duo', 'shatter', 'pen'], 9999))
    for (const h of heatSeries(entries)) {
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(1)
    }
  })

  it('un frame senza entry (stato pre-combattimento) non scalda', () => {
    expect(heatAt([null], 0)).toBe(0)
    expect(heatNext({ heat: 0.8, valueMax: 40 }, null).heat).toBeCloseTo(0.8 * HEAT.decay, 10)
  })

  it('è deterministico: stessa coppia (entries, index) → stesso valore', () => {
    const entries = [e(['crit']), e(['kill'], 55), e([], 12), e(['duo'], 30)]
    for (let i = 0; i < entries.length; i++) {
      expect(heatAt(entries, i)).toBe(heatAt(entries, i))
    }
  })

  it('heatAt(entries, i) coincide col fold di heatNext su [0..i]', () => {
    const entries = [e(['crit']), e(['kill'], 55), sys(), e([], 12), e(['duo'], 30), e(['dodge'], 0)]
    let s = HEAT_ZERO
    for (let i = 0; i < entries.length; i++) {
      s = heatNext(s, entries[i]!)
      expect(heatAt(entries, i)).toBe(s.heat)
    }
  })

  it('heatSeries coincide con heatAt su ogni indice', () => {
    const entries = [e(['kill']), e([], 8), e(['crit'], 44), sys(), e(['duo'], 70)]
    heatSeries(entries).forEach((h, i) => expect(h).toBe(heatAt(entries, i)))
  })

  it('il massimo mobile di value normalizza senza dipendere da maxHp', () => {
    // Lo stesso valore assoluto pesa di più quando è il più grosso visto finora.
    const first = heatNext(HEAT_ZERO, e([], 30))
    expect(first.valueMax).toBe(30)
    const afterBig = heatNext({ heat: 0, valueMax: 300 }, e([], 30))
    expect(afterBig.heat).toBeLessThan(first.heat)
  })

  it('indici fuori range sono innocui', () => {
    const entries = [e(['kill'])]
    expect(heatAt(entries, -5)).toBe(0)
    expect(heatAt(entries, 99)).toBe(heatAt(entries, 0))
  })
})

describe('crescendo — mapping intensità → parametri', () => {
  it('a intensità 0 non amplifica nulla', () => {
    const a = heatAmp(0)
    expect(a.bloom).toBe(1)
    expect(a.particles).toBe(1)
    expect(a.shock).toBe(1)
    expect(a.tint).toBe(1)
    expect(a.room).toBe(0)
    expect(a.hitStopMs).toBe(0)
  })

  it('a intensità 1 amplifica, ma dentro i tetti', () => {
    const a = heatAmp(1)
    expect(a.bloom).toBeGreaterThan(1)
    expect(a.particles).toBeGreaterThan(1)
    expect(a.room).toBeGreaterThan(0)
    expect(a.room).toBeLessThanOrEqual(0.12)
    expect(a.dim).toBeLessThanOrEqual(1)
  })

  it('è monotòno e clampato: nessun NaN, nessun overshoot ai bordi', () => {
    const inputs = [-3, -0.001, 0, 0.5, 1, 1.001, 42, NaN, Infinity, -Infinity]
    for (const i of inputs) {
      const a = heatAmp(i)
      for (const v of Object.values(a)) {
        expect(Number.isFinite(v)).toBe(true)
      }
      expect(a.room).toBeGreaterThanOrEqual(0)
      expect(a.room).toBeLessThanOrEqual(0.12)
      expect(a.bloom).toBeGreaterThanOrEqual(1)
      expect(a.particles).toBeGreaterThanOrEqual(1)
    }
    expect(heatAmp(NaN).bloom).toBe(1)
    expect(heatAmp(2).bloom).toBe(heatAmp(1).bloom)
    expect(heatAmp(-2).bloom).toBe(heatAmp(0).bloom)
    expect(heatAmp(0.7).bloom).toBeGreaterThan(heatAmp(0.3).bloom)
  })

  it("l'hit-stop è spento di default (costante a 0) e resta implementato dietro di essa", () => {
    expect(HEAT.hitStopMax).toBe(0)
    expect(heatAmp(1).hitStopMs).toBe(0)
    expect(heatAmp(1, { ...HEAT, hitStopMax: 90 }).hitStopMs).toBeCloseTo(90, 10)
    expect(heatAmp(0, { ...HEAT, hitStopMax: 90 }).hitStopMs).toBe(0)
  })
})
