import { describe, it, expect } from 'vitest'
import { normalizeSpell } from '@/game/engine/combat/normalizeSpell'
import { SPELL_BY_ID } from '@/data/spells'

describe('normalizeSpell', () => {
  it('heal spell → single heal effect', () => {
    expect(normalizeSpell(SPELL_BY_ID['vulnera']!)).toEqual([{ kind: 'heal', amount: 48 }])
  })
  it('plain attack → damage with crit+dodge', () => {
    expect(normalizeSpell(SPELL_BY_ID['expelliarmus']!)).toEqual([
      { kind: 'damage', power: 1.4, canCrit: true, canDodge: true },
    ])
  })
  it('attack with stun → damage then applyStatus(enemy)', () => {
    expect(normalizeSpell(SPELL_BY_ID['stupeficium']!)).toEqual([
      { kind: 'damage', power: 1.6, canCrit: true, canDodge: true },
      { kind: 'applyStatus', target: 'enemy', effect: { kind: 'stun', stat: undefined, amount: undefined, duration: 1 } },
    ])
  })
  it('control with power 0 → only applyStatus, no damage', () => {
    expect(normalizeSpell(SPELL_BY_ID['imperio']!)).toEqual([
      { kind: 'applyStatus', target: 'enemy', effect: { kind: 'stun', stat: undefined, amount: undefined, duration: 2 } },
    ])
  })
  it('defense buff → applyStatus(self)', () => {
    expect(normalizeSpell(SPELL_BY_ID['fianto']!)).toEqual([
      { kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'def', amount: 30, duration: 2 } },
    ])
  })
  it('spell.spec is returned verbatim', () => {
    const spec = [{ kind: 'shield', amount: 60, duration: 3 }] as const
    const fake = { id: 'x', name: 'X', desc: '', type: 'Difesa' as const, hitChance: 1, spec: [...spec] }
    expect(normalizeSpell({ ...fake })).toEqual([...spec])
  })
})
