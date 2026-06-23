import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

// Minimal 1v1 team factory — adapt to existing test helpers if present (check teamGen.test.ts).
function unit(id: string, atk = 30, hp = 100): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp, atk, def: 10, spd: 10 }, maxHp: hp,
    spell: { id: 'jinx', name: 'Jinx', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

describe('event bus wiring parity', () => {
  it('startOfBattle shield relic still grants shield (block flag in log turn 0)', () => {
    const relics: ActiveRelic[] = [{ relic: RELIC_BY_ID['pietra-resurrezione']!, stageObtained: 0 }]
    const res = simulateBattle([unit('a')], [unit('z')], createRng('seed').fork(2), { leftRelics: relics })
    expect(res.log.some(e => e.turn === 0 && e.flags.includes('block'))).toBe(true)
  })

  it('same seed produces identical log with and after refactor (snapshot)', () => {
    const relics: ActiveRelic[] = [{ relic: RELIC_BY_ID['boccino-doro']!, stageObtained: 0 }]
    const res = simulateBattle([unit('a')], [unit('z')], createRng('fixed').fork(2), { leftRelics: relics })
    expect({ winner: res.winner, turns: res.turns, logLen: res.log.length }).toMatchSnapshot()
  })
})
