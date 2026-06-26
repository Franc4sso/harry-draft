import { describe, it, expect } from 'vitest'
import type { BattleUnit, Wizard } from '@/types'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerTraitTriggers } from '@/game/engine/traits'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = { id: 'a', name: 'A', house: 'Grifondoro', role: 'Attaccante', tier: 3, gender: 'm', ranges: { hp: [1,1], atk: [1,1], def: [1,1], spd: [1,1] }, spellPool: [] } as Wizard
  const stats = { hp: 100, atk: 20, def: 10, spd: 20 }
  return { wizard, stats, maxHp: 100, spell: { id: 's', name: 's', desc: '', type: 'Attacco', hitChance: 1 }, side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('registerTraitTriggers sources from shiny', () => {
  it('registers the shiny trait (roccia → -20% incoming)', () => {
    const bus = createEventBus()
    const u = unit({ shiny: { traitId: 'roccia' } })
    registerTraitTriggers(bus, [u])
    // roccia owner is 'target'; emit with this unit as the damage target.
    const out = bus.emitModifier('modifyIncomingDamage', 100, { turn: 1, actor: unit(), target: u, side: 'left', flags: [] })
    expect(out).toBeCloseTo(80)
  })

  it('registers nothing when not shiny', () => {
    const bus = createEventBus()
    const u = unit()
    registerTraitTriggers(bus, [u])
    const out = bus.emitModifier('modifyIncomingDamage', 100, { turn: 1, actor: unit(), target: u, side: 'left', flags: [] })
    expect(out).toBe(100)
  })
})
