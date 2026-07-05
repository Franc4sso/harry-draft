import { describe, it, expect } from 'vitest'
import { computeDamage } from '@/game/engine/combat/effects'
import { createRng } from '@/game/engine/rng'
import { mkUnit } from './_roleTestUtils'

// A deterministic rng where chance() never crits (so we read the base number).
const noCrit = { ...createRng('x'), chance: () => false } as never

describe('role damage matrix', () => {
  it('an Attaccante deals +25% to a Supporto (its prey) vs a neutral role', () => {
    const atk = mkUnit({ id: 'att', role: 'Attaccante', side: 'left', stats: { hp: 100, atk: 50, def: 10, spd: 10 } })
    const prey = mkUnit({ id: 'sup', role: 'Supporto', stats: { hp: 100, atk: 10, def: 10, spd: 10 } })
    const neutral = mkUnit({ id: 'ctl', role: 'Controllo', stats: { hp: 100, atk: 10, def: 10, spd: 10 } })
    const dPrey = computeDamage(noCrit, atk, prey, 1, [])
    const dNeutral = computeDamage(noCrit, atk, neutral, 1, [])
    expect(dPrey).toBeGreaterThan(dNeutral)
    expect(dPrey / dNeutral).toBeCloseTo(1.25, 1)
  })
})
