import { describe, it, expect } from 'vitest'
import { teamDarkMagic } from '@/game/engine/darkMagic'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats, tags: string[] = ['magieOscure']): DraftedWizard => ({ wizard: { ...WIZARDS.find(w => w.id === id)!, tags }, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const S: Stats = { hp: 100, atk: 10, def: 10, spd: 10 }
// voldemort is magieOscure-tagged after Task 5; for the helper test we only rely on the tag, so
// build the team from wizards we will tag. Use ids that Task 5 tags: voldemort, bellatrix, snape.
const darkTeam = ['voldemort', 'bellatrix', 'snape'].map(id => mk(id, S))

const marchio = (carrier: string): ActiveRelic => ({ relic: { id: 'marchio-nero', name: 'Marchio', desc: '', rarity: 'rara', keywords: ['magieOscure'], assignable: true, grantsDarkMagic: { bonus: 0.5, recoil: 0.2 } }, stageObtained: 0, assignedTo: carrier })
const diadema: ActiveRelic = { relic: { id: 'diadema-corrotto', name: 'Diadema', desc: '', rarity: 'non-comune', keywords: ['magieOscure'], keywordMult: { magieOscure: 0.5 } }, stageObtained: 0 }
const oscurita: ActiveSynergy = { synergy: { id: 'oscurita', name: 'Oscurità', kind: 'origin', requires: { tag: 'magieOscure', count: 3 }, bonus: {} }, memberIds: [] }

describe('teamDarkMagic', () => {
  it('is empty with no source', () => {
    expect(teamDarkMagic(darkTeam, [], [])).toEqual({})
  })
  it('the Oscurità synergy gives every dark caster bonus, no recoil', () => {
    const m = teamDarkMagic(darkTeam, [], [oscurita])
    expect(m['voldemort']).toEqual({ bonus: 0.3, recoil: 0 })
    expect(m['snape']).toEqual({ bonus: 0.3, recoil: 0 })
  })
  it('an assigned Marchio adds bonus + recoil to the carrier only', () => {
    const m = teamDarkMagic(darkTeam, [marchio('voldemort')], [])
    expect(m['voldemort']).toEqual({ bonus: 0.5, recoil: 0.2 })
    expect(m['snape']).toBeUndefined()    // no synergy, no relic → no entry
  })
  it('synergy + Marchio stack on the carrier (bonus adds, recoil from relic)', () => {
    const m = teamDarkMagic(darkTeam, [marchio('voldemort')], [oscurita])
    expect(m['voldemort']).toEqual({ bonus: 0.8, recoil: 0.2 })  // 0.3 syn + 0.5 relic
    expect(m['snape']).toEqual({ bonus: 0.3, recoil: 0 })
  })
  it('diadema scales bonus only, not recoil', () => {
    const m = teamDarkMagic(darkTeam, [marchio('voldemort'), diadema], [oscurita])
    // voldemort: (0.3 + 0.5) * 1.5 = 1.2 bonus; recoil stays 0.2
    expect(m['voldemort']!.bonus).toBeCloseTo(1.2)
    expect(m['voldemort']!.recoil).toBe(0.2)
    // snape: 0.3 * 1.5 = 0.45 bonus, no recoil
    expect(m['snape']!.bonus).toBeCloseTo(0.45)
    expect(m['snape']!.recoil).toBe(0)
  })
  it('a Marchio assigned to a NON-dark-tagged wizard still grants that carrier (relic-only entry)', () => {
    const mixed = [mk('harry', S, []), ...darkTeam]   // harry is not magieOscure-tagged
    const m = teamDarkMagic(mixed, [marchio('harry')], [])
    expect(m['harry']).toEqual({ bonus: 0.5, recoil: 0.2 })
  })
})
