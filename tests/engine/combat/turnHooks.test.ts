import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { ActiveRelic, DraftedWizard, Relic } from '@/types'

function unit(id: string, atk = 30, hp = 1000, def = 10, spd = 10): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp, atk, def, spd }, maxHp: hp,
    spell: { id: 'jinx', name: 'Jinx', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

describe('onTurnStart / onTurnEnd emission', () => {
  const onTurnStartRelic: Relic = {
    id: 'tstart', name: 'tstart', desc: '', rarity: 'epica',
    triggers: [{ hook: 'onTurnStart', effects: [{ kind: 'heal', amount: 1 }] }],
  }

  it('onTurnStart fires once per LEFT unit each turn, never for RIGHT', () => {
    const relics: ActiveRelic[] = [{ relic: onTurnStartRelic, stageObtained: 0 }]
    // Two left units, one right. Make it survive several turns (high hp).
    const res = simulateBattle(
      [unit('La'), unit('Lb')],
      [unit('Rz', 20)],
      createRng('turn-seed').fork(2),
      { leftRelics: relics },
    )

    // Reliquia heal entries (value 1) — must all target LEFT units.
    const relicEntries = res.log.filter(e =>
      e.action === 'Reliquia' && e.type === 'system' && e.flags.includes('heal'),
    )
    expect(relicEntries.length).toBeGreaterThan(0)
    expect(relicEntries.every(e => e.targetSide === 'left')).toBe(true)
    // Never a right-side target.
    expect(relicEntries.some(e => e.targetSide === 'right')).toBe(false)

    // Count per turn: for each turn where both left units are alive, expect 2 onTurnStart fires.
    // At minimum turn 1 (all alive) must produce exactly 2 left fires.
    const turn1 = relicEntries.filter(e => e.turn === 1)
    expect(turn1.length).toBe(2)
    expect(new Set(turn1.map(e => e.targetId))).toEqual(new Set(['La', 'Lb']))
  })
})
