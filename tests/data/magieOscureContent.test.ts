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
  it('at least 3 wizards carry the magieOscure tag (magieOscure-fueled kits are draftable)', () => {
    expect(WIZARDS.filter(w => (w.tags ?? []).includes('magieOscure')).length).toBeGreaterThanOrEqual(3)
  })
  it('3 magieOscure wizards do NOT activate a team synergy (Oscurità was removed)', () => {
    // The Oscurità group synergy was removed from SYNERGIES (2026-07-21) along with the
    // other 8 team synergies; magieOscure now reaches wizards only via marchio-nero
    // (relic, assigned per-carrier) — see teamDarkMagic below. detectSynergies must NOT
    // report an 'oscurita' id anymore, and teamDarkMagic with no relics must be empty.
    const team = WIZARDS.filter(w => (w.tags ?? []).includes('magieOscure')).slice(0, 3).map(w => mk(w.id, { hp: 100, atk: 10, def: 10, spd: 10 }))
    const syn = detectSynergies(team)
    expect(syn.map(a => a.synergy.id)).not.toContain('oscurita')
    const m = teamDarkMagic(team, [], syn)
    expect(Object.keys(m)).toHaveLength(0)
  })
})
