import { describe, it, expect } from 'vitest'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { detectSynergies } from '@/game/engine/synergy'
import { teamDarkMagic } from '@/game/engine/darkMagic'
import type { ActiveRelic, DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })

describe('Magie Oscure content', () => {
  it('avada, fiendfyre, sectumsempra carry the magieOscure keyword', () => {
    for (const id of ['avada', 'fiendfyre', 'sectumsempra']) {
      expect(SPELL_BY_ID[id]?.keywords).toContain('magieOscure')
    }
  })
  it('marchio-nero grants dark magic and is assignable', () => {
    const r = RELICS.find(r => r.id === 'marchio-nero')!
    expect(r.assignable).toBe(true)
    expect(r.grantsDarkMagic?.bonus).toBeGreaterThan(0)
    expect(r.grantsDarkMagic?.recoil).toBeGreaterThan(0)
  })
  it('diadema-corrotto scales the magieOscure keyword', () => {
    expect(RELICS.find(r => r.id === 'diadema-corrotto')!.keywordMult?.magieOscure).toBeGreaterThan(0)
  })
  it('at least 3 wizards carry the magieOscure tag (Oscurità is draftable)', () => {
    expect(WIZARDS.filter(w => (w.tags ?? []).includes('magieOscure')).length).toBeGreaterThanOrEqual(3)
  })
  it('Oscurità activates with 3 magieOscure wizards and gives them bonus (no recoil)', () => {
    const team = WIZARDS.filter(w => (w.tags ?? []).includes('magieOscure')).slice(0, 3).map(w => mk(w.id, { hp: 100, atk: 10, def: 10, spd: 10 }))
    const syn = detectSynergies(team)
    expect(syn.map(a => a.synergy.id)).toContain('oscurita')
    const m = teamDarkMagic(team, [], syn)
    expect(Object.values(m).every(e => e.bonus > 0 && e.recoil === 0)).toBe(true)
  })
})
