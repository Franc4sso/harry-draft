import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS, computeDamage } from '@/game/engine/combat/effects'
import { applyStatus, tickStatuses } from '@/game/engine/status'
import type { BattleUnit, DraftedWizard, LogFlag } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import type { Rng } from '@/game/engine/rng'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 120, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}
const noChance: Rng = { next: () => 0, int: () => 0, chance: () => false,
  pick: <T,>(a: readonly T[]) => a[0]!, shuffle: <T,>(a: readonly T[]) => [...a], fork: () => noChance }
const always: Rng = { ...noChance, chance: () => true, fork: () => always }

describe('EFFECT_HANDLERS', () => {
  it('damage reduces hp and returns value', () => {
    const a = unit(); const b = unit({ side: 'right' })
    const flags: LogFlag[] = []
    const r = EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor: a, target: b, flags }, { kind: 'damage', power: 1.4, canDodge: true, canCrit: true })
    expect(r.value).toBeGreaterThan(0)
    expect(b.hp).toBeLessThan(120)
  })
  it('damage dodge returns dodged and leaves hp', () => {
    const a = unit(); const b = unit({ side: 'right' })
    const flags: LogFlag[] = []
    const r = EFFECT_HANDLERS.damage({ rng: always, turn: 1, actor: a, target: b, flags }, { kind: 'damage', power: 1.4, canDodge: true })
    expect(r.dodged).toBe(true)
    expect(b.hp).toBe(120)
    expect(flags).toContain('dodge')
  })
  it('heal raises hp capped at max', () => {
    const a = unit(); const b = unit({ side: 'left', hp: 10 })
    const flags: LogFlag[] = []
    const r = EFFECT_HANDLERS.heal({ rng: noChance, turn: 1, actor: a, target: b, flags }, { kind: 'heal', amount: 30 })
    expect(b.hp).toBe(40); expect(r.value).toBe(30); expect(flags).toContain('heal')
  })
  it('shield pushes a shield status with absorbLeft', () => {
    const a = unit()
    const flags: LogFlag[] = []
    EFFECT_HANDLERS.shield({ rng: noChance, turn: 1, actor: a, target: a, flags }, { kind: 'shield', amount: 60, duration: 3 })
    expect(a.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft).toBe(60)
  })
  it('applyStatus(statusId) applies a def-driven status', () => {
    const a = unit(); const b = unit({ side: 'right' })
    EFFECT_HANDLERS.applyStatus({ rng: noChance, turn: 1, actor: a, target: b, flags: [] }, { kind: 'applyStatus', target: 'enemy', statusId: 'burn' })
    expect(b.statusEffects.some(e => e.statusId === 'burn')).toBe(true)
  })
  it('applyStatus(inline stun) pushes legacy stun + flag', () => {
    const a = unit(); const b = unit({ side: 'right' }); const flags: LogFlag[] = []
    EFFECT_HANDLERS.applyStatus({ rng: noChance, turn: 1, actor: a, target: b, flags }, { kind: 'applyStatus', target: 'enemy', effect: { kind: 'stun', duration: 1 } })
    expect(b.statusEffects.some(e => e.kind === 'stun')).toBe(true)
    expect(flags).toContain('stun')
  })
})

describe('armor penetration', () => {
  it('Attaccante deals more than a non-Attacker vs a high-DEF target', () => {
    const atkWiz = unit({ side: 'left' })            // role Attaccante (fixture default)
    const tankRole = unit({ side: 'left' })
    tankRole.wizard = { ...tankRole.wizard, role: 'Tank' }
    const target = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 60, spd: 40 } })

    const fa: LogFlag[] = []; const ft: LogFlag[] = []
    const dmgAtk = computeDamage(noChance, atkWiz, target, 1, fa)
    const dmgTank = computeDamage(noChance, tankRole, target, 1, ft)

    expect(dmgAtk).toBeGreaterThan(dmgTank)
    expect(fa).toContain('pen')
    expect(ft).not.toContain('pen')
  })

  it('penetration never drops damage below minDamage', () => {
    const atkWiz = unit({ side: 'left' })
    const target = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 9999, spd: 40 } })
    const f: LogFlag[] = []
    expect(computeDamage(noChance, atkWiz, target, 0.1, f)).toBeGreaterThanOrEqual(1)
  })

  it('Attaccante armor pen is 0.2 (halved from the old 0.4)', () => {
    const atkWiz = unit({ side: 'left' })
    const noPenActor = unit({ side: 'left' })
    noPenActor.wizard = { ...noPenActor.wizard, role: 'Tank' }
    const target = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 60, spd: 40 } })
    const f1: LogFlag[] = []; const f2: LogFlag[] = []

    const dmgPen = computeDamage(noChance, atkWiz, target, 1, f1)
    const dmgNoPen = computeDamage(noChance, noPenActor, target, 1, f2)

    // pen amount = def * pen * defenseK; expected extra damage over the no-pen case
    // equals def * 0.2 * defenseK (rounded), NOT def * 0.4 * defenseK (the old value).
    const def = 60
    const defenseK = 0.5
    const expectedExtraAt0_2 = Math.round(def * 0.2 * defenseK)
    const expectedExtraAt0_4 = Math.round(def * 0.4 * defenseK)
    expect(dmgPen - dmgNoPen).toBe(expectedExtraAt0_2)
    expect(dmgPen - dmgNoPen).not.toBe(expectedExtraAt0_4)
  })
})

describe('Controllo role damage multiplier', () => {
  it('a Controllo deals less damage to a Tank than to a non-tank backliner (same stats)', () => {
    const ctrl = unit({ side: 'left' })
    ctrl.wizard = { ...ctrl.wizard, role: 'Controllo' }
    const tank = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 30, spd: 40 } })
    tank.wizard = { ...tank.wizard, role: 'Tank' }
    const backliner = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 30, spd: 40 } })
    backliner.wizard = { ...backliner.wizard, role: 'Supporto' }

    const f1: LogFlag[] = []; const f2: LogFlag[] = []
    const dmgVsTank = computeDamage(noChance, ctrl, tank, 1, f1)
    const dmgVsBackline = computeDamage(noChance, ctrl, backliner, 1, f2)

    expect(dmgVsTank).toBeLessThan(dmgVsBackline)
  })

  it('a non-Controllo attacker deals equal damage regardless of the Controllo role multiplier', () => {
    const atkWiz = unit({ side: 'left' }) // Attaccante
    const tank = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 30, spd: 40 } })
    tank.wizard = { ...tank.wizard, role: 'Tank' }
    const backliner = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 30, spd: 40 } })
    backliner.wizard = { ...backliner.wizard, role: 'Supporto' }

    const f1: LogFlag[] = []; const f2: LogFlag[] = []
    const dmgVsTank = computeDamage(noChance, atkWiz, tank, 1, f1)
    const dmgVsBackline = computeDamage(noChance, atkWiz, backliner, 1, f2)

    expect(dmgVsTank).toBe(dmgVsBackline)
  })
})

describe('Controllo debuffs are weaker against a Tank', () => {
  it('a Controllo applying a stat debuff to a Tank does not land it (or lands it weaker)', () => {
    const ctrl = unit({ side: 'left' })
    ctrl.wizard = { ...ctrl.wizard, role: 'Controllo' }
    const tank = unit({ side: 'right' })
    tank.wizard = { ...tank.wizard, role: 'Tank' }
    const nonTank = unit({ side: 'right' })
    nonTank.wizard = { ...nonTank.wizard, role: 'Supporto' }

    EFFECT_HANDLERS.applyStatus(
      { rng: noChance, turn: 1, actor: ctrl, target: tank, flags: [] },
      { kind: 'applyStatus', target: 'enemy', statusId: 'weaken2' },
    )
    EFFECT_HANDLERS.applyStatus(
      { rng: noChance, turn: 1, actor: ctrl, target: nonTank, flags: [] },
      { kind: 'applyStatus', target: 'enemy', statusId: 'weaken2' },
    )

    const tankDebuff = tank.statusEffects.find(e => e.statusId === 'weaken2')
    const nonTankDebuff = nonTank.statusEffects.find(e => e.statusId === 'weaken2')

    expect(nonTankDebuff).toBeDefined()
    // Either the debuff never lands on the Tank, or it lands with a shorter duration.
    if (tankDebuff) {
      expect(tankDebuff.remaining).toBeLessThan(nonTankDebuff!.remaining)
    } else {
      expect(tankDebuff).toBeUndefined()
    }
  })
})

describe('freeze shatter', () => {
  it('a direct hit removes freeze and deals ~1.5x', () => {
    const actor = unit({ buffedStats: { hp: 120, atk: 40, def: 30, spd: 40 } })
    const frozen = unit({ side: 'right', hp: 999, maxHp: 999, buffedStats: { hp: 999, atk: 80, def: 10, spd: 40 } })
    applyStatus(frozen, 'freeze')
    const flags: LogFlag[] = []

    const plainActor = unit({ buffedStats: { hp: 120, atk: 40, def: 30, spd: 40 } })
    const plainTarget = unit({ side: 'right', hp: 999, maxHp: 999, buffedStats: { hp: 999, atk: 80, def: 10, spd: 40 } })
    const baseFlags: LogFlag[] = []
    const base = EFFECT_HANDLERS.damage(
      { rng: noChance, turn: 1, actor: plainActor, target: plainTarget, flags: baseFlags },
      { kind: 'damage', power: 1 },
    ).value!

    const res = EFFECT_HANDLERS.damage(
      { rng: noChance, turn: 1, actor, target: frozen, flags },
      { kind: 'damage', power: 1 },
    )

    expect(frozen.statusEffects.some(e => e.kind === 'freeze')).toBe(false) // freeze removed
    expect(flags).toContain('shatter')
    expect(res.value).toBe(Math.round(base * 1.5))
  })

  it('a DoT tick does not shatter freeze', () => {
    const u = unit({ side: 'right' })
    applyStatus(u, 'freeze')
    applyStatus(u, 'burn')
    tickStatuses(1, u)
    expect(u.statusEffects.some(e => e.kind === 'freeze')).toBe(true)
  })
})

describe('protego wards the carry', () => {
  it('wards the highest-ATK threatened ally over a more-wounded but low-value ally', () => {
    const caster = unit({ side: 'left' })
    // Carry: high ATK, took some damage (threatened, not full hp).
    const carry = unit({ side: 'left', hp: 100, buffedStats: { hp: 120, atk: 150, def: 30, spd: 40 } })
    // Low-value ally: much more wounded, but low ATK.
    const chaff = unit({ side: 'left', hp: 10, buffedStats: { hp: 120, atk: 20, def: 30, spd: 40 } })

    EFFECT_HANDLERS.protego(
      { rng: noChance, turn: 1, actor: caster, target: caster, flags: [], allies: [caster, carry, chaff] },
      { kind: 'protego', count: 1 },
    )

    expect(carry.statusEffects.some(e => e.statusId === 'protego')).toBe(true)
    expect(chaff.statusEffects.some(e => e.statusId === 'protego')).toBe(false)
  })
})
