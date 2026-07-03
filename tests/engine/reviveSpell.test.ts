import { it, expect, describe } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { normalizeSpell } from '@/game/engine/combat/normalizeSpell'
import { deadToRaise } from '@/game/engine/combat/targeting'
import type { BattleUnit, Spell } from '@/types'

function u(id: string, hp: number, maxHp = 100): BattleUnit {
  return {
    wizard: { id }, side: 'left', hp, maxHp, alive: hp > 0,
    statusEffects: [], cooldowns: {}, buffedStats: { hp: maxHp, atk: 10, def: 10, spd: 10 },
  } as unknown as BattleUnit
}

describe('revive effect', () => {
  it('raises a fallen ally to a fraction of max HP and marks it alive', () => {
    const dead = u('d', 0)
    const flags: string[] = []
    const ctx = { rng: {} as any, turn: 1, actor: dead, target: dead, flags: flags as any }
    const r = EFFECT_HANDLERS.revive(ctx as any, { kind: 'revive', fraction: 0.2 } as any)
    expect(dead.alive).toBe(true)
    expect(dead.hp).toBe(20)
    expect(r.value).toBe(20)
    expect(flags).toContain('revive')
  })

  it('never tops up a living unit (revive only works on the fallen)', () => {
    const alive = u('a', 50)
    const flags: string[] = []
    const ctx = { rng: {} as any, turn: 1, actor: alive, target: alive, flags: flags as any }
    const r = EFFECT_HANDLERS.revive(ctx as any, { kind: 'revive', fraction: 0.2 } as any)
    expect(alive.hp).toBe(50)
    expect(r.value).toBe(0)
    expect(flags).not.toContain('revive')
  })

  it('revives to at least 1 HP even when the fraction rounds to zero', () => {
    const dead = u('tiny', 0, 2) // 2 * 0.2 = 0.4 → rounds to 0, but must stay alive
    const flags: string[] = []
    const ctx = { rng: {} as any, turn: 1, actor: dead, target: dead, flags: flags as any }
    EFFECT_HANDLERS.revive(ctx as any, { kind: 'revive', fraction: 0.2 } as any)
    expect(dead.alive).toBe(true)
    expect(dead.hp).toBeGreaterThanOrEqual(1)
  })
})

describe('deadToRaise', () => {
  it('returns undefined when every ally is alive', () => {
    expect(deadToRaise([u('a', 50), u('b', 100)])).toBeUndefined()
  })

  it('returns a fallen ally when one exists (never a living one)', () => {
    const picked = deadToRaise([u('alive', 60), u('fallen', 0)])
    expect(picked?.wizard.id).toBe('fallen')
  })
})

describe('normalizeSpell — revive', () => {
  it('maps a revive spell to a single revive effect (not a heal)', () => {
    const spell = { id: 'rennervate', name: 'Rennervate', type: 'Cura', revive: 0.2, cooldown: 2, hitChance: 1 } as unknown as Spell
    expect(normalizeSpell(spell)).toEqual([{ kind: 'revive', fraction: 0.2 }])
  })
})
