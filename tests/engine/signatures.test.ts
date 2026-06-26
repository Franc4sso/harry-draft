import { describe, it, expect } from 'vitest'
import type { BattleUnit, Signature, Wizard } from '@/types'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerSignatures } from '@/game/engine/signatures'

function unit(id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3, ranges: { hp: [1, 1], atk: [1, 1], def: [1, 1], spd: [1, 1] }, spellPool: [] } as Wizard
  const stats = { hp: 100, atk: 20, def: 10, spd: 20 }
  return {
    wizard, stats, maxHp: 100, spell: { id: 's', name: 's', desc: '', type: 'Attacco', hitChance: 1 },
    side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over,
  }
}

describe('registerSignatures', () => {
  it('applies a modifier only to the owning unit', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const other = unit('b')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [{ kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v * 2 }] },
    }
    registerSignatures(bus, [owner, other], catalog)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: owner, side: 'left', flags: [] })).toBe(20)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: other, side: 'left', flags: [] })).toBe(10)
  })

  it('collects reactive effects only for the owning unit', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const other = unit('b')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [{ kind: 'reactive', hook: 'onTurnStart', owner: 'actor', effects: () => [{ kind: 'shield', amount: 5 }] }] },
    }
    registerSignatures(bus, [owner, other], catalog)
    expect(bus.collectReactive('onTurnStart', { turn: 1, actor: owner, side: 'left', flags: [] })).toHaveLength(1)
    expect(bus.collectReactive('onTurnStart', { turn: 1, actor: other, side: 'left', flags: [] })).toHaveLength(0)
  })

  it('registers every trigger of a multi-trigger signature', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [
        { kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v + 1 },
        { kind: 'reactive', hook: 'onHit', owner: 'actor', effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'stun' }] },
      ] },
    }
    registerSignatures(bus, [owner], catalog)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: owner, side: 'left', flags: [] })).toBe(11)
    expect(bus.collectReactive('onHit', { turn: 1, actor: owner, target: owner, side: 'left', flags: [] })).toHaveLength(1)
  })
})
