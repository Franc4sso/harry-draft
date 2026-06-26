import { describe, it, expect } from 'vitest'
import { resolveAction, tickStatuses, effectiveStats } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import type { Rng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { BALANCE } from '@/data/constants'

function unit(id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 120, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('resolve', () => {
  it('attack reduces target hp', () => {
    const a = unit('a'); const b = unit('b', { side: 'right' })
    const before = b.hp
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['expelliarmus']!)
    expect(b.hp).toBeLessThan(before)
  })
  it('damage is at least minDamage', () => {
    const a = unit('a', { buffedStats: { hp: 1, atk: 1, def: 1, spd: 1 } })
    const b = unit('b', { side: 'right', buffedStats: { hp: 999, atk: 1, def: 999, spd: 1 } })
    const before = b.hp
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['expelliarmus']!)
    expect(before - b.hp).toBeGreaterThanOrEqual(1)
  })
  it('heal increases ally hp without exceeding max', () => {
    const healer = unit('h'); const ally = unit('ally', { hp: 10 })
    resolveAction(createRng(1), 1, healer, ally, SPELL_BY_ID['vulnera']!)
    expect(ally.hp).toBeGreaterThan(10)
    expect(ally.hp).toBeLessThanOrEqual(ally.maxHp)
  })
  it('debuff lowers effective stat', () => {
    const a = unit('a'); const b = unit('b', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['levicorpus']!)
    expect(effectiveStats(b).def).toBeLessThan(b.buffedStats.def)
  })
  it('dot deals damage on tick and decrements duration', () => {
    const a = unit('a', { statusEffects: [{ kind: 'dot', amount: 10, remaining: 2 }] })
    const before = a.hp
    const logs = tickStatuses(2, a)
    expect(a.hp).toBe(before - 10)
    expect(a.statusEffects[0]?.remaining).toBe(1)
    expect(logs.length).toBeGreaterThan(0)
  })
  it('sets cooldown after casting a spell with cooldown', () => {
    const a = unit('a'); const b = unit('b', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['sectumsempra']!)
    expect(a.cooldowns['sectumsempra']).toBe(SPELL_BY_ID['sectumsempra']!.cooldown)
  })

  it('crit multiplies damage by critMult', () => {
    // dodge check = first chance() call, crit check = second chance() call
    // Use a counter-based fake: 1st call → false (no dodge), 2nd call → true (crit)
    let callCount = 0
    const critRng: Rng = {
      next: () => 0,
      int: () => 0,
      chance: () => { callCount++; return callCount >= 2 },
      pick: <T>(a: readonly T[]) => a[0]!,
      shuffle: <T>(a: readonly T[]) => [...a],
      fork: () => critRng,
    }
    const noCritRng: Rng = {
      next: () => 0, int: () => 0, chance: () => false,
      pick: <T>(a: readonly T[]) => a[0]!,
      shuffle: <T>(a: readonly T[]) => [...a],
      fork: () => noCritRng,
    }
    const spell = SPELL_BY_ID['expelliarmus']!
    const a = unit('a'); const b1 = unit('b', { side: 'right' })
    const b2 = unit('b', { side: 'right' })
    const logNoCrit = resolveAction(noCritRng, 1, a, b2, spell)
    const logCrit = resolveAction(critRng, 1, a, b1, spell)
    expect(logCrit.flags).toContain('crit')
    expect(logNoCrit.flags).not.toContain('crit')
    // crit damage should be ~critMult × base damage (within rounding)
    const baseDmg = logNoCrit.value ?? 0
    const critDmg = logCrit.value ?? 0
    expect(critDmg).toBeGreaterThan(baseDmg)
    expect(critDmg).toBeCloseTo(baseDmg * BALANCE.combat.critMult, 0)
  })

  it('dodge leaves target hp unchanged and sets dodge flag', () => {
    // first chance() call (dodge) returns true → dodge happens
    const dodgeRng: Rng = {
      next: () => 0, int: () => 0, chance: () => true,
      pick: <T>(a: readonly T[]) => a[0]!,
      shuffle: <T>(a: readonly T[]) => [...a],
      fork: () => dodgeRng,
    }
    const a = unit('a'); const b = unit('b', { side: 'right' })
    const hpBefore = b.hp
    const log = resolveAction(dodgeRng, 1, a, b, SPELL_BY_ID['expelliarmus']!)
    expect(b.hp).toBe(hpBefore)
    expect(log.flags).toContain('dodge')
    expect(log.value).toBe(0)
  })

  it('stupeficium pushes stun effect onto target', () => {
    const noChanceRng: Rng = {
      next: () => 0, int: () => 0, chance: () => false,
      pick: <T>(a: readonly T[]) => a[0]!,
      shuffle: <T>(a: readonly T[]) => [...a],
      fork: () => noChanceRng,
    }
    const a = unit('a'); const b = unit('b', { side: 'right' })
    resolveAction(noChanceRng, 1, a, b, SPELL_BY_ID['stupeficium']!)
    expect(b.statusEffects.some(e => e.kind === 'stun')).toBe(true)
  })

  it('crucio applies both damage and dual effects (dot + debuff)', () => {
    const noChanceRng: Rng = {
      next: () => 0, int: () => 0, chance: () => false,
      pick: <T>(a: readonly T[]) => a[0]!,
      shuffle: <T>(a: readonly T[]) => [...a],
      fork: () => noChanceRng,
    }
    const a = unit('a'); const b = unit('b', { side: 'right' })
    const hpBefore = b.hp
    resolveAction(noChanceRng, 1, a, b, SPELL_BY_ID['crucio']!)
    // damage path ran (power 0.8 > 0)
    expect(b.hp).toBeLessThan(hpBefore)
    // both effects were pushed
    expect(b.statusEffects.some(e => e.kind === 'dot')).toBe(true)
    expect(b.statusEffects.some(e => e.kind === 'debuff')).toBe(true)
  })
})
