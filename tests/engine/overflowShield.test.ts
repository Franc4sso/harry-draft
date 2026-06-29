import { describe, it, expect } from 'vitest'
import { tickStatuses } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

function fullHpUnit(rate?: number): BattleUnit {
  return {
    wizard: { id: 'cedric' }, side: 'left', hp: 100, maxHp: 100, alive: true,
    cooldowns: {}, buffedStats: { hp: 100, atk: 10, def: 10, spd: 10 },
    statusEffects: [{ kind: 'regen', statusId: 'regen', remaining: 10, stacks: 1 }],
    shieldConvert: rate === undefined ? undefined : { rate },
  } as unknown as BattleUnit
}
const shieldOf = (u: BattleUnit) => u.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft ?? 0

describe('regen overflow → shield', () => {
  it('with no shieldConvert, the full-HP overflow is wasted (no shield)', () => {
    const u = fullHpUnit(undefined)
    tickStatuses(1, u)
    expect(u.hp).toBe(100)           // capped, no healing
    expect(shieldOf(u)).toBe(0)      // overflow lost, as today
  })
  it('with shieldConvert, the overflow becomes shield at `rate`', () => {
    const u = fullHpUnit(0.5)        // regen tickHeal=12, all of it overflows at full HP
    tickStatuses(1, u)
    expect(u.hp).toBe(100)           // still capped
    expect(shieldOf(u)).toBe(6)      // round(12 overflow * 0.5)
  })
  it('refreshes (does not accumulate) across ticks', () => {
    const u = fullHpUnit(0.5)
    tickStatuses(1, u)
    tickStatuses(2, u)
    expect(shieldOf(u)).toBe(6)      // second tick replaces, not 12
  })
})
