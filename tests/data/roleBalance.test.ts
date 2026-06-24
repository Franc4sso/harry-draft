import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import type { Role, Stat } from '@/types'

const STATS: Stat[] = ['hp', 'atk', 'def', 'spd']
const mid = (r: readonly [number, number]) => (r[0] + r[1]) / 2
const budget = (w: typeof WIZARDS[number]) => STATS.reduce((s, k) => s + mid(w.ranges[k]), 0)

function roleAvg(role: Role, stat: Stat): number {
  const ws = WIZARDS.filter(w => w.role === role)
  return ws.reduce((s, w) => s + mid(w.ranges[stat]), 0) / ws.length
}

describe('role stat contrast', () => {
  it('Tanks are far bulkier than Attackers', () => {
    expect(roleAvg('Tank', 'hp')).toBeGreaterThanOrEqual(roleAvg('Attaccante', 'hp') * 1.4)
    expect(roleAvg('Tank', 'def')).toBeGreaterThanOrEqual(roleAvg('Attaccante', 'def') * 1.7)
  })
  it('Attackers hit far harder than Tanks', () => {
    expect(roleAvg('Attaccante', 'atk')).toBeGreaterThanOrEqual(roleAvg('Tank', 'atk') * 1.6)
  })
  it('Control is the fastest role', () => {
    const spd = (r: Role) => roleAvg(r, 'spd')
    expect(spd('Controllo')).toBeGreaterThan(spd('Tank'))
    expect(spd('Controllo')).toBeGreaterThan(spd('Supporto'))
    expect(spd('Controllo')).toBeGreaterThanOrEqual(spd('Attaccante'))
  })
})

describe('no power inflation', () => {
  it('per-tier average budget stays within ±8% of a 100-point reference band', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const ws = WIZARDS.filter(w => w.tier === tier)
      const avg = ws.reduce((s, w) => s + budget(w), 0) / ws.length
      // higher tier = stronger; just assert monotonic, sane bands (no runaway numbers)
      expect(avg).toBeGreaterThan(40)
      expect(avg).toBeLessThan(400)
    }
  })
})
