import { describe, it, expect } from 'vitest'
import { effectiveStats, tickStatuses, applyStatus, applyInlineEffect } from '@/game/engine/status'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 120, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('status core', () => {
  it('applyStatus(atkUp) raises effective atk via def statMod', () => {
    const u = unit()
    applyStatus(u, 'atkUp')
    expect(effectiveStats(u).atk).toBe(100) // 80 + 20
  })
  it('applyStatus(slow) lowers effective spd', () => {
    const u = unit()
    applyStatus(u, 'slow')
    expect(effectiveStats(u).spd).toBe(25) // 40 - 15
  })
  it('refresh stack policy resets duration, no duplicate', () => {
    const u = unit()
    applyStatus(u, 'slow', { duration: 1 })
    applyStatus(u, 'slow', { duration: 3 })
    const slows = u.statusEffects.filter(e => e.statusId === 'slow')
    expect(slows).toHaveLength(1)
    expect(slows[0]?.remaining).toBe(3)
  })
  it('stack policy (burn) adds instances up to maxStacks', () => {
    const u = unit()
    applyStatus(u, 'burn'); applyStatus(u, 'burn'); applyStatus(u, 'burn'); applyStatus(u, 'burn')
    expect(u.statusEffects.filter(e => e.statusId === 'burn')).toHaveLength(3)
  })
  it('tickStatuses applies burn tickDamage and regen tickHeal', () => {
    const u = unit({ hp: 50 })
    applyStatus(u, 'burn', { duration: 2 })
    applyStatus(u, 'regen', { duration: 2 })
    const logs = tickStatuses(1, u)
    expect(u.hp).toBe(50 - 8 + 12)
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })
  it('legacy inline dot still ticks (back-compat)', () => {
    const u = unit({ statusEffects: [{ kind: 'dot', amount: 10, remaining: 2 }] })
    tickStatuses(1, u)
    expect(u.hp).toBe(110)
    expect(u.statusEffects[0]?.remaining).toBe(1)
  })
  it('applyInlineEffect pushes legacy-shaped effect', () => {
    const u = unit()
    applyInlineEffect(u, { kind: 'debuff', stat: 'def', amount: 20, duration: 2 })
    expect(u.statusEffects[0]).toMatchObject({ kind: 'debuff', stat: 'def', amount: 20, remaining: 2 })
  })
})
