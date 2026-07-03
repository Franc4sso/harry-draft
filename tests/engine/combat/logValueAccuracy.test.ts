import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import type { ActiveEffect, BattleUnit } from '@/types'

// The engine relies on an invariant: a log entry's `value` equals the ACTUAL HP delta, so
// buildReplay (which reconstructs HP purely from log deltas, with no shield model) stays in
// sync with the simulation. These lock that invariant for the damage and heal handlers.

function u(id: string, side: 'left' | 'right', over: Partial<{ hp: number; atk: number; def: number; statusEffects: ActiveEffect[] }> = {}): BattleUnit {
  const stats = { hp: 100, atk: over.atk ?? 10, def: over.def ?? 10, spd: 10 }
  return {
    wizard: { id, name: id, role: 'Attaccante' }, side,
    hp: over.hp ?? 100, maxHp: 100, alive: (over.hp ?? 100) > 0,
    statusEffects: over.statusEffects ?? [], cooldowns: {}, buffedStats: stats,
  } as unknown as BattleUnit
}

const noRng = { chance: () => false } as any

describe('log value = actual HP delta', () => {
  it('damage value reflects HP actually lost after a shield absorbs part of the hit', () => {
    const actor = u('att', 'left', { atk: 100 })
    const shield: ActiveEffect = { kind: 'shield', statusId: 'shield', remaining: 2, stacks: 1, sourceId: 'x', absorbLeft: 30 } as ActiveEffect
    const target = u('foe', 'right', { def: 0, statusEffects: [shield] })
    // Raw hit = atk*power - def*k = 100; shield eats 30, so HP should drop by 70.
    const r = EFFECT_HANDLERS.damage({ rng: noRng, turn: 1, actor, target, flags: [] as any } as any, { kind: 'damage', power: 1 } as any)
    expect(target.hp).toBe(30)
    expect(r.value).toBe(70)
  })

  it('heal value reflects HP actually restored, not the requested amount (no overheal inflation)', () => {
    const actor = u('sup', 'left')
    const ally = u('mate', 'left', { hp: 90 })
    const r = EFFECT_HANDLERS.heal({ rng: noRng, turn: 1, actor, target: ally, flags: [] as any } as any, { kind: 'heal', amount: 30 } as any)
    // Only 10 HP was missing; a 30-heal restores 10, not 30.
    expect(ally.hp).toBe(100)
    expect(r.value).toBe(10)
  })
})
