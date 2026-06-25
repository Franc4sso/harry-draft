import { describe, it, expect } from 'vitest'
import { applyStatus, effectiveStats } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

function unit(atk: number, def: number, spd: number): BattleUnit {
  return {
    buffedStats: { hp: 100, atk, def, spd },
    statusEffects: [], cooldowns: {},
  } as unknown as BattleUnit
}

describe('graded percentage debuffs', () => {
  it('weaken2 reduces atk by 25% of the unit\'s own atk', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'weaken2')
    expect(effectiveStats(u).atk).toBe(30) // 40 * 0.75
  })
  it('weaken3 reduces atk by 40%', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'weaken3')
    expect(effectiveStats(u).atk).toBe(24) // 40 * 0.6
  })
  it('expose2 reduces def by 25%', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'expose2')
    expect(effectiveStats(u).def).toBe(15) // 20 * 0.75
  })
  it('slow1 reduces spd by 15% (rounded)', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'slow1')
    expect(effectiveStats(u).spd).toBe(26) // round(30 * 0.85) = 25.5 → 26
  })
})
