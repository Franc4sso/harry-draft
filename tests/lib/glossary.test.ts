import { describe, it, expect } from 'vitest'
import {
  SPELL_TYPE_META, EFFECT_META, spellTypeChip,
  formatSpellStats, spellEffectChips, synergyBonusText,
} from '@/lib/glossary'
import type { Spell } from '@/types/spell'
import type { Synergy, SynergyBonus } from '@/types/synergy'

const atk: Spell = { id: 'x', name: 'X', desc: 'd', type: 'Attacco', power: 1.4, hitChance: 0.9, cooldown: 1 }
const heal: Spell = { id: 'h', name: 'H', desc: 'd', type: 'Cura', heal: 28, hitChance: 1, cooldown: 1 }
const dotSpell: Spell = { id: 'i', name: 'I', desc: 'd', type: 'Attacco', power: 1.2, hitChance: 0.9, cooldown: 1, effects: [{ kind: 'dot', amount: 8, duration: 2 }] }
const multi: Spell = { id: 'c', name: 'C', desc: 'd', type: 'Controllo', power: 0.8, hitChance: 0.85, cooldown: 2, effects: [{ kind: 'dot', amount: 10, duration: 2 }, { kind: 'debuff', stat: 'atk', amount: 10, duration: 2 }] }

describe('metadata', () => {
  it('covers all spell types', () => {
    expect(Object.keys(SPELL_TYPE_META).sort()).toEqual(['Attacco', 'Controllo', 'Cura', 'Difesa'])
  })
  it('covers all effect kinds', () => {
    for (const k of ['buff','debuff','dot','stun','freeze','silence','disarm','regen','shield']) {
      expect(EFFECT_META[k], k).toBeTruthy()
    }
  })
  it('spellTypeChip returns color + icon for a type', () => {
    const c = spellTypeChip('Cura')
    expect(c.label).toBe('Cura')
    expect(c.color).toBe(SPELL_TYPE_META.Cura.color)
    expect(c.icon).toBe(SPELL_TYPE_META.Cura.icon)
  })
})

describe('formatSpellStats', () => {
  it('shows power as a multiplier and precision as a percent', () => {
    expect(formatSpellStats(atk)).toEqual([
      { label: 'Potenza', value: '×1.4' },
      { label: 'Precisione', value: '90%' },
      { label: 'Ricarica', value: '1' },
    ])
  })
  it('shows heal instead of power and omits absent fields', () => {
    expect(formatSpellStats(heal)).toEqual([
      { label: 'Cura', value: '28' },
      { label: 'Precisione', value: '100%' },
      { label: 'Ricarica', value: '1' },
    ])
  })
})

describe('spellEffectChips', () => {
  it('returns nothing when no effects', () => {
    expect(spellEffectChips(atk)).toEqual([])
  })
  it('maps a single effect to a chip', () => {
    const chips = spellEffectChips(dotSpell)
    expect(chips).toHaveLength(1)
    expect(chips[0]!.label).toBe(EFFECT_META.dot!.label)
    expect(chips[0]!.color).toBe(EFFECT_META.dot!.color)
  })
  it('maps and de-dups multiple effect kinds', () => {
    const chips = spellEffectChips(multi)
    expect(chips.map(c => c.label)).toEqual([EFFECT_META.dot!.label, EFFECT_META.debuff!.label])
  })
  it('also reads the new spec[] applyStatus effects', () => {
    const s: Spell = { id: 's', name: 'S', desc: 'd', type: 'Controllo', hitChance: 0.9, spec: [{ kind: 'applyStatus', target: 'enemy', effect: { kind: 'freeze' } }] }
    expect(spellEffectChips(s).map(c => c.label)).toEqual([EFFECT_META.freeze!.label])
  })
})

describe('EFFECT_META control blurbs', () => {
  it('describe each control distinctly', () => {
    expect(EFFECT_META.freeze!.blurb).toContain('infrange')
    expect(EFFECT_META.stun!.blurb.toLowerCase()).toContain('rimuovere')
    expect(EFFECT_META.silence!.blurb).toContain('Anti-magia')
    expect(EFFECT_META.disarm!.blurb).toContain('Anti-attacco')
  })
})

describe('synergyBonusText', () => {
  const syn = (bonus: SynergyBonus): Synergy => ({
    id: 't', name: 'Test', kind: 'role', requires: { role: 'Attaccante' }, bonus,
  })
  it('formats flat stats', () => {
    expect(synergyBonusText(syn({ atk: 10, def: 14 }))).toEqual(['+10 ATK', '+14 DIF'])
  })
  it('formats allPct as a percent of all stats', () => {
    expect(synergyBonusText(syn({ allPct: 0.15 }))).toEqual(['+15% a tutte le statistiche'])
  })
  it('formats regen', () => {
    expect(synergyBonusText(syn({ regen: 5 }))).toEqual(['Rigenera 5/turno'])
  })
  it('returns empty array for an empty bonus', () => {
    expect(synergyBonusText(syn({}))).toEqual([])
  })
})
