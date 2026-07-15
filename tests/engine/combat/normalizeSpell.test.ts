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
  it('defense buff (riddikulus) → spec applyStatus(self, atkUp), returned verbatim (capped status, not inline)', () => {
    expect(normalizeSpell(SPELL_BY_ID['riddikulus']!)).toEqual([
      { kind: 'applyStatus', target: 'self', statusId: 'atkUp' },
    ])
  })
  it('fianto (shield spec) → shield + applyStatus(self, defUp), returned verbatim', () => {
    expect(normalizeSpell(SPELL_BY_ID['fianto']!)).toEqual([
      { kind: 'shield', amount: 40, duration: 2 },
      { kind: 'applyStatus', target: 'self', statusId: 'defUp' },
    ])
  })
  it('attack with dot (incendio) → damage then applyStatus(enemy, burn) carrying per-spell tickAmount', () => {
    // The legacy inline {kind:'dot',amount} now funnels into statusId 'burn' so all fire DoTs
    // merge into ONE accumulating status (one flame icon) while keeping their own per-tick damage.
    expect(normalizeSpell(SPELL_BY_ID['incendio']!)).toEqual([
      { kind: 'damage', power: 1.2, canCrit: true, canDodge: true },
      { kind: 'applyStatus', target: 'enemy', statusId: 'burn', tickAmount: 8, duration: 2 },
    ])
  })
  it('dot funnels to burn but non-dot inline effects (crucio debuff) stay inline', () => {
    expect(normalizeSpell(SPELL_BY_ID['crucio']!)).toEqual([
      { kind: 'damage', power: 0.8, canCrit: true, canDodge: true },
      { kind: 'applyStatus', target: 'enemy', statusId: 'burn', tickAmount: 10, duration: 2 },
      { kind: 'applyStatus', target: 'enemy', effect: { kind: 'debuff', stat: 'atk', amount: 10, duration: 2 } },
    ])
  })
  it('spell.spec is returned verbatim', () => {
    const spec = [{ kind: 'shield', amount: 60, duration: 3 }] as const
    const fake = { id: 'x', name: 'X', desc: '', type: 'Difesa' as const, hitChance: 1, spec: [...spec] }
    expect(normalizeSpell({ ...fake })).toEqual([...spec])
  })
})
