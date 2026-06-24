import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID } from '@/data/traits'
import type { BattleUnit, HookCtx } from '@/types'

const STUB_SPELL = { id: 'stub', name: 'Stub', desc: '', type: 'Attacco' as const, hitChance: 1 }

function u(over: Partial<BattleUnit['buffedStats']> = {}, hp = 100, maxHp = 100): BattleUnit {
  const stats = { hp: 100, atk: 30, def: 20, spd: 25, ...over }
  return { wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
    ranges: { hp: [100,100], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: [] },
    stats, maxHp, hp, spell: STUB_SPELL, side: 'left', cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true } as BattleUnit
}

describe('damage-modifier traits', () => {
  it('Esecuzione boosts damage only against sub-30% targets', () => {
    const t = TRAIT_BY_ID['esecuzione']!.trigger
    if (t.kind !== 'modifier') throw new Error('expected modifier')
    const low: HookCtx = { turn: 1, actor: u(), target: u({}, 20, 100), side: 'left', flags: [] }
    const high: HookCtx = { turn: 1, actor: u(), target: u({}, 80, 100), side: 'left', flags: [] }
    expect(t.apply(100, low)).toBeGreaterThan(100)
    expect(t.apply(100, high)).toBe(100)
  })

  it('Furia scales damage with the attacker missing HP', () => {
    const t = TRAIT_BY_ID['furia']!.trigger
    if (t.kind !== 'modifier') throw new Error('expected modifier')
    const full: HookCtx = { turn: 1, actor: u({}, 100, 100), side: 'left', flags: [] }
    const hurt: HookCtx = { turn: 1, actor: u({}, 10, 100), side: 'left', flags: [] }
    expect(t.apply(100, full)).toBe(100)
    expect(t.apply(100, hurt)).toBeGreaterThan(100)
  })

  it('Roccia reduces incoming damage', () => {
    const t = TRAIT_BY_ID['roccia']!.trigger
    if (t.kind !== 'modifier') throw new Error('expected modifier')
    expect(t.apply(100, { turn: 1, actor: u(), target: u(), side: 'left', flags: [] })).toBeLessThan(100)
  })
})
