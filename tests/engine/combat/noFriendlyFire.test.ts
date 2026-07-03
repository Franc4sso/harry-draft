import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import type { BattleUnit } from '@/types'

function u(id: string, side: 'left' | 'right', hp = 100): BattleUnit {
  return {
    wizard: { id, name: id, role: 'Attaccante' }, side, hp, maxHp: 100, alive: hp > 0,
    statusEffects: [], cooldowns: {}, buffedStats: { hp: 100, atk: 10, def: 10, spd: 10 },
  } as unknown as BattleUnit
}

const noRng = { chance: () => false } as any

// A hard structural guarantee: friendly fire must NEVER happen, no matter what target the
// selection layer hands the effect resolver. These guard the effect handlers directly.
describe('no friendly fire (structural guard)', () => {
  it('a damage effect deals ZERO to a same-side unit', () => {
    const actor = u('att', 'left')
    const ally = u('mate', 'left', 100)
    const flags: string[] = []
    const ctx = { rng: noRng, turn: 1, actor, target: ally, flags: flags as any, allies: [actor, ally] }
    const r = EFFECT_HANDLERS.damage(ctx as any, { kind: 'damage', power: 5 } as any)
    expect(ally.hp).toBe(100)
    expect(r.value).toBe(0)
  })

  it('an enemy-targeted status never lands on a same-side unit', () => {
    const actor = u('att', 'left')
    const ally = u('mate', 'left')
    const ctx = { rng: { chance: () => true } as any, turn: 1, actor, target: ally, flags: [] as any }
    EFFECT_HANDLERS.applyStatus(ctx as any, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 } as any)
    expect(ally.statusEffects).toHaveLength(0)
  })

  it('still lets a damage effect strike an actual enemy', () => {
    const actor = u('att', 'left')
    const enemy = u('foe', 'right', 100)
    const ctx = { rng: noRng, turn: 1, actor, target: enemy, flags: [] as any, allies: [actor] }
    const r = EFFECT_HANDLERS.damage(ctx as any, { kind: 'damage', power: 5 } as any)
    expect(enemy.hp).toBeLessThan(100)
    expect(r.value ?? 0).toBeGreaterThan(0)
  })

  it('still lets an enemy status land on an actual enemy', () => {
    const actor = u('att', 'left')
    const enemy = u('foe', 'right')
    const ctx = { rng: { chance: () => true } as any, turn: 1, actor, target: enemy, flags: [] as any }
    EFFECT_HANDLERS.applyStatus(ctx as any, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 } as any)
    expect(enemy.statusEffects.length).toBeGreaterThan(0)
  })
})
