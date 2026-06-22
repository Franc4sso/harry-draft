import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import type { BattleUnit, DraftedWizard, LogFlag } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import type { Rng } from '@/game/engine/rng'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
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
