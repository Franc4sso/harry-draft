import { describe, it, expect } from 'vitest'
import { applyStatus, effectiveStats, tickStatuses } from '@/game/engine/status'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Harness copied from tests/engine/status.test.ts.
function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 120, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('permanent + cumulative stat buffs/debuffs', () => {
  it('(a) a stat debuff applied once does not expire after its old duration', () => {
    const u = unit()
    applyStatus(u, 'slow', { duration: 2 })
    for (let turn = 1; turn <= 20; turn++) tickStatuses(turn, u)
    const slows = u.statusEffects.filter(e => e.statusId === 'slow')
    expect(slows).toHaveLength(1)
    expect(effectiveStats(u).spd).toBe(25) // 40 - 15, still active many turns later
  })

  it('(b) applying the same stat debuff twice stacks (lower than one application)', () => {
    const u = unit()
    applyStatus(u, 'slow')
    const afterOne = effectiveStats(u).spd
    applyStatus(u, 'slow')
    const afterTwo = effectiveStats(u).spd
    expect(afterTwo).toBeLessThan(afterOne)
    expect(u.statusEffects.filter(e => e.statusId === 'slow')).toHaveLength(2)
  })

  it('(c) the cap holds — applications beyond maxStacks do not exceed the cap effect', () => {
    const u = unit()
    const cap = 3
    for (let i = 0; i < cap + 10; i++) applyStatus(u, 'slow')
    expect(u.statusEffects.filter(e => e.statusId === 'slow')).toHaveLength(cap)
    const cappedSpd = effectiveStats(u).spd
    // one more application must not change anything further
    applyStatus(u, 'slow')
    expect(u.statusEffects.filter(e => e.statusId === 'slow')).toHaveLength(cap)
    expect(effectiveStats(u).spd).toBe(cappedSpd)
  })

  it('(d) control effect (stun) still expires on its timer — permanence did not leak', () => {
    const u = unit()
    applyStatus(u, 'stun', { duration: 1 })
    tickStatuses(1, u)
    expect(u.statusEffects.filter(e => e.statusId === 'stun')).toHaveLength(0)
  })

  it('(e) dot (veleno) still ticks and expires as before', () => {
    const u = unit()
    applyStatus(u, 'veleno', { duration: 2 })
    const hpBeforeTick = u.hp
    tickStatuses(1, u)
    expect(u.hp).toBeLessThan(hpBeforeTick)
    expect(u.statusEffects.find(e => e.statusId === 'veleno')?.remaining).toBe(1)
    tickStatuses(2, u)
    expect(u.statusEffects.filter(e => e.statusId === 'veleno')).toHaveLength(0)
  })
})
