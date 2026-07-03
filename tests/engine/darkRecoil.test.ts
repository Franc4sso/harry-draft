import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit, Spell } from '@/types'

// A deterministic dark spell: high power, 100% hit, no crit variance risk via a fixed seed.
const darkSpell: Spell = { id: 'test_dark', name: 'Test Oscuro', desc: '', type: 'Attacco', power: 2, hitChance: 1, keywords: ['magieOscure'] }
const plainSpell: Spell = { id: 'test_plain', name: 'Test', desc: '', type: 'Attacco', power: 2, hitChance: 1 }

function unit(id: string, hp: number, opts: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = WIZARDS.find(w => w.id === id)!
  return {
    wizard, spell: SPELL_BY_ID['base_attack']!, stats: { hp, atk: 50, def: 10, spd: 10 },
    maxHp: hp, side: 'left', buffedStats: { hp, atk: 50, def: 10, spd: 10 },
    hp, cooldowns: {}, statusEffects: [], alive: true, ...opts,
  } as unknown as BattleUnit
}

describe('dark amplify + recoil', () => {
  it('amplifies a dark spell and recoils the caster on damage dealt', () => {
    const caster = unit('voldemort', 300, { side: 'left', darkMagic: { bonus: 0.5, recoil: 0.2 } })
    const target = unit('harry', 1000, { side: 'right' })
    const entry = resolveAction(createRng('dr1'), 1, caster, target, darkSpell)
    const dealt = entry.value ?? 0
    expect(dealt).toBeGreaterThan(0)
    expect(entry.flags).toContain('recoil')
    expect(caster.hp).toBe(300 - Math.round(dealt * 0.2))   // recoil on damage DEALT
  })
  it('no recoil flag when the caster has no darkMagic', () => {
    const caster = unit('voldemort', 300, { side: 'left' })
    const target = unit('harry', 1000, { side: 'right' })
    const entry = resolveAction(createRng('dr1'), 1, caster, target, darkSpell)
    expect(entry.flags).not.toContain('recoil')
    expect(caster.hp).toBe(300)
  })
  it('no amplify/recoil when the spell is not dark (no keyword)', () => {
    const caster = unit('voldemort', 300, { side: 'left', darkMagic: { bonus: 0.5, recoil: 0.2 } })
    const target = unit('harry', 1000, { side: 'right' })
    const entry = resolveAction(createRng('dr1'), 1, caster, target, plainSpell)
    expect(entry.flags).not.toContain('recoil')
    expect(caster.hp).toBe(300)
  })
  it('a full shield absorbs the nuke → 0 dealt → NO recoil (loses-to-shields core)', () => {
    const caster = unit('voldemort', 300, { side: 'left', darkMagic: { bonus: 0.5, recoil: 0.2 } })
    const target = unit('harry', 1000, { side: 'right',
      statusEffects: [{ kind: 'shield', statusId: 'shield', remaining: 3, stacks: 1, sourceId: 's', absorbLeft: 100000 }] })
    const entry = resolveAction(createRng('dr1'), 1, caster, target, darkSpell)
    expect(entry.flags).not.toContain('recoil')
    expect(caster.hp).toBe(300)    // residual 0 → no recoil
  })
  it('recoil is lethal: a low-HP caster dies to its own nuke', () => {
    const caster = unit('voldemort', 5, { side: 'left', darkMagic: { bonus: 0.5, recoil: 0.2 } })
    const target = unit('harry', 1000, { side: 'right' })
    resolveAction(createRng('dr1'), 1, caster, target, darkSpell)
    expect(caster.hp).toBeLessThanOrEqual(0)
  })
  it('partial shield: recoil is proportional to the residual (damage that got through)', () => {
    // With seed 'dr1', darkMagic bonus 0.5 → dealt = 146.
    // Shield absorbs 30 → residual = 116, recoil = round(116 * 0.2) = 23.
    // Without shield: recoil = round(146 * 0.2) = 29. So 23 < 29.
    const caster = unit('voldemort', 300, { side: 'left', darkMagic: { bonus: 0.5, recoil: 0.2 } })
    const target = unit('harry', 1000, { side: 'right',
      statusEffects: [{ kind: 'shield', statusId: 'shield', remaining: 3, stacks: 1, sourceId: 's', absorbLeft: 30 }] })
    const entry = resolveAction(createRng('dr1'), 1, caster, target, darkSpell)
    // entry.value now reports HP actually removed (post-shield residual = 116), not the gross hit.
    const residual = entry.value ?? 0
    expect(residual).toBeGreaterThan(0)
    expect(entry.flags).toContain('recoil')
    // recoil = round(residual * 0.2)
    expect(caster.hp).toBe(300 - Math.round(residual * 0.2))
    // recoil with partial shield is strictly less than without shield (gross = residual + 30 absorbed)
    expect(300 - caster.hp).toBeLessThan(Math.round((residual + 30) * 0.2))
  })
})
