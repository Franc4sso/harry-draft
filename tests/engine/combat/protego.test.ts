import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { consumeWard } from '@/game/engine/status'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit } from '@/types'

function mk(side: 'left' | 'right', id: string, hp = 100): BattleUnit {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    side, hp, maxHp: 100, alive: true,
    buffedStats: { hp: 100, atk: 60, def: 20, spd: 20 },
    spell: SPELL_BY_ID['stupeficium']!, cooldowns: {}, statusEffects: [],
  } as unknown as BattleUnit
}

describe('Protego', () => {
  it('wards the caster: the next enemy spell is negated, then the ward is gone', () => {
    const caster = mk('left', 'a'); const enemy = mk('right', 'e')
    // cast protego (self-target → caster is its own most-threatened ally)
    resolveAction(createRng('s'), 1, caster, caster, SPELL_BY_ID['protego']!, [caster], undefined)
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(true)
    const hpBefore = caster.hp
    // enemy hits the warded caster → negated (no hp loss), ward consumed
    const e1 = resolveAction(createRng('s'), 2, enemy, caster, SPELL_BY_ID['sectumsempra']!, [enemy], undefined)
    expect(caster.hp).toBe(hpBefore)
    expect(e1.flags).toContain('block')
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(false)
    // a second enemy spell now lands
    resolveAction(createRng('s'), 3, enemy, caster, SPELL_BY_ID['sectumsempra']!, [enemy], undefined)
    expect(caster.hp).toBeLessThan(hpBefore)
  })

  it('does NOT ward basic attacks', () => {
    const caster = mk('left', 'a'); const enemy = mk('right', 'e')
    resolveAction(createRng('s'), 1, caster, caster, SPELL_BY_ID['protego']!, [caster], undefined)
    const hpBefore = caster.hp
    resolveAction(createRng('s'), 2, enemy, caster, SPELL_BY_ID['base_attack']!, [enemy], undefined)
    expect(caster.hp).toBeLessThan(hpBefore) // basic attack still lands
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(true) // ward intact
  })

  it('protego_maxima wards two allies', () => {
    const a = mk('left', 'a', 40); const b = mk('left', 'b', 50); const c = mk('left', 'c', 100)
    resolveAction(createRng('s'), 1, c, c, SPELL_BY_ID['protego_maxima']!, [a, b, c], undefined)
    const warded = [a, b, c].filter(u => u.statusEffects.some(e => e.statusId === 'protego'))
    expect(warded.length).toBe(2) // the two most-threatened (lowest hp): a and b
    expect(warded).toEqual(expect.arrayContaining([a, b]))
  })

  it('consumeWard returns false when no ward present', () => {
    expect(consumeWard(mk('left', 'x'))).toBe(false)
  })
})
