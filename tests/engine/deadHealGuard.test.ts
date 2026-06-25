import { it, expect } from 'vitest'
import { mostWounded } from '@/game/engine/combat/targeting'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import type { BattleUnit } from '@/types'

function u(id: string, hp: number, maxHp = 100): BattleUnit {
  return {
    wizard: { id }, side: 'left', hp, maxHp, alive: hp > 0,
    statusEffects: [], cooldowns: {}, buffedStats: { hp: maxHp, atk: 10, def: 10, spd: 10 },
  } as unknown as BattleUnit
}

it('mostWounded never returns a dead unit', () => {
  const dead = u('dead', 0)
  const hurt = u('hurt', 40)
  expect(mostWounded([dead, hurt])?.wizard.id).toBe('hurt')
})

it('mostWounded returns undefined when only dead units are wounded', () => {
  expect(mostWounded([u('d1', 0), u('d2', 0)])).toBeUndefined()
})

it('heal is a no-op on a dead target (no revive, no heal flag)', () => {
  const dead = u('dead', 0)
  const flags: string[] = []
  const ctx = { rng: {} as any, turn: 1, actor: dead, target: dead, flags: flags as any }
  const r = EFFECT_HANDLERS.heal(ctx as any, { kind: 'heal', amount: 28 } as any)
  expect(dead.hp).toBe(0)
  expect(r.value).toBe(0)
  expect(flags).not.toContain('heal')
})

it('heal still works on a living wounded target', () => {
  const hurt = u('hurt', 40)
  const flags: string[] = []
  const ctx = { rng: {} as any, turn: 1, actor: hurt, target: hurt, flags: flags as any }
  EFFECT_HANDLERS.heal(ctx as any, { kind: 'heal', amount: 28 } as any)
  expect(hurt.hp).toBe(68)
  expect(flags).toContain('heal')
})
