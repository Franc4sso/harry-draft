import { describe, it, expect } from 'vitest'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerTraitTriggers } from '@/game/engine/traits'
import type { BattleUnit, Trait } from '@/types'

function unit(id: string, traits: string[]): BattleUnit {
  const stats = { hp: 100, atk: 30, def: 20, spd: 25 }
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [100,100], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: ['base_attack'], traits },
    stats, maxHp: 100, spell: { id: 'base_attack', name: 'x', desc: '', type: 'Attacco', hitChance: 1 },
    side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true,
  } as BattleUnit
}

// A test trait: +100% outgoing damage, owner = actor.
const DOUBLE: Trait = {
  id: 'double', name: 'Double', desc: 'x2',
  epithet: { m: 'x', f: 'x' },
  trigger: { kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v * 2 },
}

describe('registerTraitTriggers (owner gating)', () => {
  it('applies a trait only when its owner is the ctx actor', () => {
    const bus = createEventBus()
    const owner = unit('owner', ['double'])
    const other = unit('other', [])
    // Inject the test trait by id via a local map override:
    registerTraitTriggers(bus, [owner, other], { double: DOUBLE })
    const base = 10
    const boosted = bus.emitModifier('modifyOutgoingDamage', base, { turn: 1, actor: owner, side: 'left', flags: [] })
    const unboosted = bus.emitModifier('modifyOutgoingDamage', base, { turn: 1, actor: other, side: 'left', flags: [] })
    expect(boosted).toBe(20)
    expect(unboosted).toBe(10)
  })
})
