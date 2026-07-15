import { describe, it, expect } from 'vitest'
import { effectiveStats, tickStatuses, applyStatus, applyInlineEffect, absorbDamage, canAct, canCastSpell, canAttack } from '@/game/engine/status'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
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
  it('refresh stack policy resets duration, no duplicate (control effects still use it)', () => {
    const u = unit()
    applyStatus(u, 'silence', { duration: 1 })
    applyStatus(u, 'silence', { duration: 3 })
    const sil = u.statusEffects.filter(e => e.statusId === 'silence')
    expect(sil).toHaveLength(1)
    expect(sil[0]?.remaining).toBe(3)
  })
  it('stat debuffs (slow) are now stack policy: re-apply adds a new permanent instance', () => {
    const u = unit()
    applyStatus(u, 'slow', { duration: 1 })
    applyStatus(u, 'slow', { duration: 3 })
    const slows = u.statusEffects.filter(e => e.statusId === 'slow')
    expect(slows).toHaveLength(2) // cumulative, not refreshed
  })
  it('burn ACCUMULATES into one instance — stacks grow, duration refreshes (like veleno)', () => {
    // Burn is now a single accumulating DoT: re-igniting bumps the stack count (up to the cap)
    // rather than pushing separate instances — so the portrait shows ONE flame icon, not N.
    // stack: 'accumulate'.
    const u = unit()
    applyStatus(u, 'burn', { duration: 2 })
    applyStatus(u, 'burn', { duration: 2 })
    applyStatus(u, 'burn', { duration: 2 })
    const burns = u.statusEffects.filter(e => e.statusId === 'burn')
    expect(burns).toHaveLength(1)          // one instance, never multiple
    expect(burns[0]!.stacks).toBe(3)       // 3 re-applies = 3 doses
    expect(burns[0]!.remaining).toBe(2)    // refreshed, not extended
  })
  it('burn caps at 8 stacks', () => {
    const u = unit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'burn', { duration: 2 })
    expect(u.statusEffects.find(e => e.statusId === 'burn')?.stacks).toBe(8)
  })
  it('tickStatuses scales burn damage by stacks and regen tickHeal', () => {
    const u = unit({ hp: 90 })
    applyStatus(u, 'burn', { duration: 2 }) // stacks 1
    applyStatus(u, 'burn', { duration: 2 }) // stacks 2
    applyStatus(u, 'regen', { duration: 2 })
    const logs = tickStatuses(1, u)
    expect(u.hp).toBe(90 - 8 * 2 + 12) // burn tickDamage 8 × 2 stacks, then +12 regen
    expect(logs.length).toBe(2) // one burn (dot) log + one regen (heal) log
  })
  it('burn carries a per-spell tickAmount overriding the def tickDamage', () => {
    // Spell DoTs (fiendfyre dmg 12 vs incendio dmg 8) must keep their own per-tick damage even
    // though they now all funnel through statusId 'burn'. applyStatus takes a tickAmount override.
    const u = unit({ hp: 90 })
    applyStatus(u, 'burn', { duration: 2, tickAmount: 12 })
    tickStatuses(1, u)
    expect(u.hp).toBe(90 - 12) // uses the override, not the def's 8
  })
  it('burn tickAmount override scales by stacks too', () => {
    const u = unit({ hp: 90 })
    applyStatus(u, 'burn', { duration: 2, tickAmount: 12 }) // stacks 1
    applyStatus(u, 'burn', { duration: 2, tickAmount: 12 }) // stacks 2
    tickStatuses(1, u)
    expect(u.hp).toBe(90 - 12 * 2)
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

describe('status guards', () => {
  it('shield absorbs damage before hp', () => {
    const u = unit()
    applyStatus(u, 'shield', { duration: 3 }) // absorb 50
    const residual = absorbDamage(u, 30)
    expect(residual).toBe(0)
    expect(u.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft).toBe(20)
    const residual2 = absorbDamage(u, 30)
    expect(residual2).toBe(10) // 30 - 20 remaining
  })
  it('stun blocks action, allows nothing extra', () => {
    const u = unit(); applyStatus(u, 'stun')
    expect(canAct(u)).toBe(false)
  })
  it('legacy inline stun also blocks action', () => {
    const u = unit({ statusEffects: [{ kind: 'stun', remaining: 1 }] })
    expect(canAct(u)).toBe(false)
  })
  it('silence blocks spells but not action', () => {
    const u = unit(); applyStatus(u, 'silence')
    expect(canCastSpell(u)).toBe(false)
    expect(canAct(u)).toBe(true)
  })
  it('disarm blocks attacks but not spells', () => {
    const u = unit(); applyStatus(u, 'disarm')
    expect(canAttack(u)).toBe(false)
    expect(canCastSpell(u)).toBe(true)
  })
})
