import { describe, it, expect } from 'vitest'
import { tickStatuses } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

// A walled unit carrying a veleno stack. tickStatuses subtracts hp directly and
// never routes through effects.ts damageReduction — so the wall must NOT reduce the tick.
function walledUnit(): BattleUnit {
  return {
    wizard: { id: 'muro', name: 'Muro' },
    side: 'right', alive: true, hp: 1000, maxHp: 1000, damageReduction: 0.4,
    cooldowns: {}, buffedStats: { hp: 1000, atk: 0, def: 0, spd: 0 },
    statusEffects: [{ kind: 'dot', statusId: 'veleno', remaining: 3, stacks: 2 }],
  } as unknown as BattleUnit
}

describe('veleno bypasses the wall', () => {
  it('poison tick deals full damage despite damageReduction 0.4', () => {
    const u = walledUnit()
    const before = u.hp
    tickStatuses(1, u)
    const dealt = before - u.hp
    expect(dealt).toBeGreaterThan(0)
  })

  it('poison tick is identical with and without the wall', () => {
    const a = walledUnit(); a.damageReduction = 0
    const b = walledUnit(); b.damageReduction = 0.4
    const beforeA = a.hp, beforeB = b.hp
    tickStatuses(1, a); tickStatuses(1, b)
    expect(beforeA - a.hp).toBe(beforeB - b.hp)
  })
})
