import { describe, it, expect } from 'vitest'
import type { Wizard, Spell, Synergy, DraftedWizard } from '@/types'

describe('types', () => {
  it('compose into a valid drafted wizard shape', () => {
    const spell: Spell = { id: 's', name: 'S', desc: '', type: 'Attacco', power: 1, hitChance: 1 }
    const wizard: Wizard = {
      id: 'w', name: 'W', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [10, 20], atk: [10, 20], def: [10, 20], spd: [10, 20] }, spellPool: ['s'],
    }
    const dw: DraftedWizard = { wizard, stats: { hp: 15, atk: 15, def: 15, spd: 15 }, maxHp: 15, spell }
    const syn: Synergy = { id: 'x', name: 'X', kind: 'house', requires: { house: 'Grifondoro', count: 3 }, bonus: { def: 20 } }
    expect(dw.maxHp).toBe(15)
    expect(syn.bonus.def).toBe(20)
  })
})
