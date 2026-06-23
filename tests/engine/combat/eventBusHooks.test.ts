import { describe, it, expect } from 'vitest'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerRelicTriggers } from '@/game/engine/relics'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { ActiveRelic, DraftedWizard, Relic } from '@/types'

const team: DraftedWizard[] = [{
  wizard: { id: 'h', name: 'h', house: 'Grifondoro', role: 'Attaccante' } as any,
  stats: { hp: 100, atk: 30, def: 10, spd: 10 }, maxHp: 100,
  spell: { id: 's', name: 's', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
}]

it('modifyOutgoingDamage trigger registers and doubles via fold', () => {
  const relic: Relic = { id: 'x', name: 'x', desc: '', rarity: 'epica',
    triggers: [{ hook: 'modifyOutgoingDamage', modifier: { mult: 2 } }] }
  const bus = createEventBus()
  registerRelicTriggers(bus, team, [{ relic, stageObtained: 0 }] as ActiveRelic[])
  expect(bus.emitModifier('modifyOutgoingDamage', 50, { turn: 1, actor: {} as any, side: 'left', flags: [] })).toBe(100)
})

it('onHeal trigger registers as reactive', () => {
  const relic: Relic = { id: 'y', name: 'y', desc: '', rarity: 'epica',
    triggers: [{ hook: 'onHeal', effects: [{ kind: 'shield', amount: 5 }] }] }
  const bus = createEventBus()
  registerRelicTriggers(bus, team, [{ relic, stageObtained: 0 }] as ActiveRelic[])
  expect(bus.collectReactive('onHeal', { turn: 1, actor: {} as any, side: 'left', flags: [] }))
    .toEqual([{ kind: 'shield', amount: 5 }])
})

// --- Discriminating ordering test (carried from Task 4 review) ---------------
//
// onBattleStart applies its collected EffectSpecs in effect-outer / unit-inner
// order: for each spec, for each left unit. This relic carries TWO rng-consuming
// applyStatus effects (chance < 1 ⇒ each draws one rng), applied across TWO left
// units. The rng draw sequence therefore is:
//   spec0(unitA), spec0(unitB), spec1(unitA), spec1(unitB)   [effect-outer]
// A regression that swapped the nesting to unit-outer / effect-inner would draw:
//   spec0(unitA), spec1(unitA), spec0(unitB), spec1(unitB)   [unit-outer]
// Because each draw consumes the same rng stream, swapping the nesting reorders
// which draw lands on which unit AND shifts every subsequent draw in the battle,
// so the snapshotted log diverges and this test fails. The two pre-existing relic
// snapshots cannot catch this: pietra-resurrezione's onBattleStart has a single
// zero-rng shield effect, so effect/unit nesting is unobservable there.
function ounit(id: string): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp: 100, atk: 30, def: 10, spd: 10 }, maxHp: 100,
    spell: { id: 'jinx', name: 'Jinx', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

it('onBattleStart applies effects effect-outer/unit-inner (rng order locked)', () => {
  const relic: Relic = {
    id: 'ord', name: 'ord', desc: '', rarity: 'epica',
    triggers: [{
      hook: 'onBattleStart',
      effects: [
        { kind: 'applyStatus', target: 'self', chance: 0.5, statusId: 'shield' },
        { kind: 'applyStatus', target: 'self', chance: 0.5, statusId: 'shield' },
      ],
    }],
  }
  const relics: ActiveRelic[] = [{ relic, stageObtained: 0 }]
  const res = simulateBattle(
    [ounit('a'), ounit('b')],
    [ounit('z')],
    createRng('ordering-seed').fork(2),
    { leftRelics: relics },
  )
  expect({ winner: res.winner, turns: res.turns, log: res.log }).toMatchSnapshot()
})
