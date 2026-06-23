import { describe, it, expect } from 'vitest'
import { toBattleUnits, simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { DraftedWizard } from '@/types'

function dw(id: string, maxHp = 100, currentHp?: number): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp: maxHp, atk: 20, def: 10, spd: 10 }, maxHp, currentHp,
    spell: { id: 's', name: 's', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

describe('toBattleUnits HP seeding', () => {
  it('starts a unit at its persisted currentHp', () => {
    const [u] = toBattleUnits([dw('a', 100, 40)], 'left', [], [])
    expect(u!.hp).toBe(40)
    expect(u!.maxHp).toBe(100)
  })
  it('absent currentHp starts full', () => {
    const [u] = toBattleUnits([dw('a', 100)], 'left', [], [])
    expect(u!.hp).toBe(u!.maxHp)
  })
  it('clamps currentHp into the buffed max (never above maxHp)', () => {
    const [u] = toBattleUnits([dw('a', 100, 9999)], 'left', [], [])
    expect(u!.hp).toBe(u!.maxHp)
  })
})

it('a 2-wizard player team fights a 5-enemy team to a decided result', () => {
  const left = [dw('p1'), dw('p2')]
  const right = ['e1', 'e2', 'e3', 'e4', 'e5'].map(id => dw(id))
  const res = simulateBattle(left, right, createRng('small-team').fork(2))
  expect(['left', 'right']).toContain(res.winner)
  expect(res.finalSnapshot.length).toBe(7)
})
