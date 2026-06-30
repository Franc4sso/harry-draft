import { describe, it, expect } from 'vitest'
import { registerSynergyTriggers, TOSSICITA_HIT_CHANCE } from '@/game/engine/synergyTriggers'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { SYNERGIES } from '@/data/synergies'
import type { BattleUnit } from '@/types'

const tossicita = SYNERGIES.find(s => s.id === 'tossicita')!
const unit = (id: string): BattleUnit => ({
  // minimal BattleUnit: only fields the trigger reads (wizard.id, side, alive)
  wizard: { id, name: id, house: 'Serpeverde', role: 'Attaccante', tier: 4, gender: 'm', ranges: { hp: [1,1], atk: [1,1], def: [1,1], spd: [1,1] }, spellPool: [] },
  stats: { hp: 10, atk: 1, def: 1, spd: 1 }, maxHp: 10, spell: { id: 'x', name: 'x', desc: '', type: 'Attacco', hitChance: 1 },
  side: 'left', cooldowns: {}, statusEffects: [], alive: true,
} as unknown as BattleUnit)

describe('registerSynergyTriggers — Tossicità on-hit poison', () => {
  it('registers an onHit reactive that poisons the enemy when Tossicità is active', () => {
    const bus = createEventBus()
    const u = unit('blaise')
    registerSynergyTriggers(bus, [u], [{ synergy: tossicita, memberIds: ['blaise'] }], 'left')
    const specs = bus.collectReactive('onHit', { turn: 1, actor: u, side: 'left', flags: [] } as any)
    const poison = specs.find(s => s.kind === 'applyStatus' && s.statusId === 'veleno')
    expect(poison).toBeDefined()
    expect((poison as any).chance).toBe(TOSSICITA_HIT_CHANCE)
    expect((poison as any).target).toBe('enemy')
  })
  it('registers nothing when Tossicità is not active', () => {
    const bus = createEventBus()
    const u = unit('blaise')
    registerSynergyTriggers(bus, [u], [], 'left')
    const specs = bus.collectReactive('onHit', { turn: 1, actor: u, side: 'left', flags: [] } as any)
    expect(specs.find(s => s.kind === 'applyStatus' && s.statusId === 'veleno')).toBeUndefined()
  })
  it('only fires for the actor that owns the trigger, on its own side', () => {
    const bus = createEventBus()
    const u = unit('blaise'); const other = unit('nott')
    registerSynergyTriggers(bus, [u], [{ synergy: tossicita, memberIds: ['blaise'] }], 'left')
    // a hit whose actor is a DIFFERENT unit → no poison from u's listener
    const specs = bus.collectReactive('onHit', { turn: 1, actor: other, side: 'left', flags: [] } as any)
    expect(specs.find(s => s.kind === 'applyStatus' && s.statusId === 'veleno')).toBeUndefined()
  })
})
