import { describe, it, expect } from 'vitest'
import type { Wizard, Spell, Synergy, DraftedWizard } from '@/types'
import type { StatusDef, EffectSpec, ActiveEffect } from '@/types'

describe('types', () => {
  it('compose into a valid drafted wizard shape', () => {
    const spell: Spell = { id: 's', name: 'S', desc: '', type: 'Attacco', power: 1, hitChance: 1 }
    const wizard: Wizard = {
      id: 'w', name: 'W', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm',
      ranges: { hp: [10, 20], atk: [10, 20], def: [10, 20], spd: [10, 20] }, spellPool: ['s'],
    }
    const dw: DraftedWizard = { wizard, stats: { hp: 15, atk: 15, def: 15, spd: 15 }, maxHp: 15, spell }
    const syn: Synergy = { id: 'x', name: 'X', kind: 'house', requires: { house: 'Grifondoro', count: 3 }, bonus: { def: 20 } }
    expect(dw.maxHp).toBe(15)
    expect(syn.bonus.def).toBe(20)
  })
})

describe('status types', () => {
  it('ActiveEffect accepts legacy and extended shapes', () => {
    const legacy: ActiveEffect = { kind: 'dot', amount: 10, remaining: 2 }
    const extended: ActiveEffect = { kind: 'shield', remaining: 3, statusId: 'shield', absorbLeft: 60, sourceId: 'left:harry' }
    expect(legacy.kind).toBe('dot')
    expect(extended.absorbLeft).toBe(60)
  })
  it('EffectSpec union covers damage/heal/shield/applyStatus', () => {
    const specs: EffectSpec[] = [
      { kind: 'damage', power: 1.4, canCrit: true, canDodge: true },
      { kind: 'heal', amount: 20 },
      { kind: 'shield', amount: 40, duration: 3 },
      { kind: 'applyStatus', target: 'enemy', statusId: 'burn' },
    ]
    expect(specs).toHaveLength(4)
  })
  it('StatusDef shape is well-formed', () => {
    const def: StatusDef = { id: 'x', name: 'X', kind: 'dot', family: 'dot', defaultDuration: 2, stack: 'stack', priority: 10, removable: true }
    expect(def.id).toBe('x')
  })
})
