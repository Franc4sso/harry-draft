import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { ActiveRelic, DraftedWizard, Relic } from '@/types'

// High def so minDamage doesn't floor; spd 0 so no crit/dodge noise on a fixed seed.
function unit(id: string, atk: number, hp = 1000, def = 10, spd = 0): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp, atk, def, spd }, maxHp: hp,
    spell: { id: 'jinx', name: 'Jinx', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

describe('modifier listeners are LEFT-side gated', () => {
  // A LEFT relic that halves incoming damage. Must only protect LEFT units; a RIGHT
  // (enemy) unit hit by the left team must take FULL damage.
  const halveIncoming: Relic = {
    id: 'half-in', name: 'half', desc: '', rarity: 'epica',
    triggers: [{ hook: 'modifyIncomingDamage', modifier: { mult: 0.5 } }],
  }

  it('LEFT unit takes reduced incoming damage, RIGHT unit takes full', () => {
    const relics: ActiveRelic[] = [{ relic: halveIncoming, stageObtained: 0 }]
    const seed = () => createRng('mod-gate').fork(2)

    // Baseline (no relic): record first-hit damage dealt to each side.
    const base = simulateBattle([unit('L', 40)], [unit('R', 40)], seed())
    const withRelic = simulateBattle([unit('L', 40)], [unit('R', 40)], seed(), { leftRelics: relics })

    // First damaging entry against the RIGHT unit (left attacks right).
    const rightDmgBase = base.log.find(e => e.targetSide === 'right' && typeof e.value === 'number' && e.value! > 0)!
    const rightDmgRelic = withRelic.log.find(e => e.targetSide === 'right' && typeof e.value === 'number' && e.value! > 0)!
    // RIGHT unit must NOT be protected by the left relic: full damage.
    expect(rightDmgRelic.value).toBe(rightDmgBase.value)

    // First damaging entry against the LEFT unit (right attacks left).
    const leftDmgBase = base.log.find(e => e.targetSide === 'left' && typeof e.value === 'number' && e.value! > 0)!
    const leftDmgRelic = withRelic.log.find(e => e.targetSide === 'left' && typeof e.value === 'number' && e.value! > 0)!
    // LEFT unit IS protected: reduced damage.
    expect(leftDmgRelic.value!).toBeLessThan(leftDmgBase.value!)
  })
})
