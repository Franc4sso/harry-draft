import { describe, it, expect } from 'vitest'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { detectSynergies } from '@/game/engine/synergy'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import type { DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })

describe('Scudi-Rigen content', () => {
  it('egida-tassorosso grants shield conversion', () => {
    const r = RELICS.find(r => r.id === 'egida-tassorosso')!
    expect(r.grantsShieldConvert?.rate).toBeGreaterThan(0)
  })
  it('cuore-del-tasso scales scudo keyword', () => {
    const r = RELICS.find(r => r.id === 'cuore-del-tasso')!
    expect(r.keywordMult?.scudo).toBeGreaterThan(0)
  })
  it('at least 3 wizards carry the scudirigen tag (scudirigen-fueled kits are draftable)', () => {
    const tagged = WIZARDS.filter(w => (w.tags ?? []).includes('scudirigen'))
    expect(tagged.length).toBeGreaterThanOrEqual(3)
  })
  it('3 scudirigen-tagged wizards activate the Bastione archetype synergy (revived)', () => {
    // The Bastione group synergy was removed (2026-07-21) with the other 8 team synergies,
    // then DELIBERATELY revived (2026-07-23, Muro Riflettente Task 1) as an archetype
    // synergy — the twin of Spietatezza for the Carnefice. 3 scudirigen-tagged wizards
    // now DO activate it, and Bastione (keywordMult.scudo=0.5) drives teamShieldConvert
    // even with no relics equipped.
    const tagged = WIZARDS.filter(w => (w.tags ?? []).includes('scudirigen')).slice(0, 3)
    const team = tagged.map(w => mk(w.id, { hp: 100, atk: 10, def: 10, spd: 10 }))
    const syn = detectSynergies(team)
    expect(syn.map(a => a.synergy.id)).toContain('bastione')
    expect(teamShieldConvert(team, [], syn)).toBeDefined()
  })
})
