import { describe, it, expect } from 'vitest'
import { houseEffects } from '@/game/engine/houseEffects'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveSynergy, DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const S: Stats = { hp: 100, atk: 10, def: 10, spd: 10 }
const syn = (id: string, family: string): ActiveSynergy => ({ synergy: { id, name: id, kind: 'house', family, requires: {}, bonus: {} }, memberIds: [] })

// Find real wizards per house to build house-active teams.
const gryff = WIZARDS.find(w => w.house === 'Grifondoro')!.id
const raven = WIZARDS.find(w => w.house === 'Corvonero')!.id
const huff = WIZARDS.find(w => w.house === 'Tassorosso')!.id
const slyth = WIZARDS.find(w => w.house === 'Serpeverde')!.id

describe('houseEffects', () => {
  it('no house synergy → empty', () => {
    expect(houseEffects([mk(gryff, S)], [])).toEqual({})
  })
  it('Grifondoro active → its members get dodgeBonus', () => {
    const m = houseEffects([mk(gryff, S)], [syn('gryffindor2', 'house:Grifondoro')])
    expect(m[gryff]?.dodgeBonus).toBeGreaterThan(0)
  })
  it('Corvonero active → critBonus', () => {
    const m = houseEffects([mk(raven, S)], [syn('ravenclaw2', 'house:Corvonero')])
    expect(m[raven]?.critBonus?.chance).toBeGreaterThan(0)
    expect(m[raven]?.critBonus?.mult).toBeGreaterThan(0)
  })
  it('Tassorosso active → damageReduction', () => {
    const m = houseEffects([mk(huff, S)], [syn('hufflepuff2', 'house:Tassorosso')])
    expect(m[huff]?.damageReduction).toBeGreaterThan(0)
  })
  it('Serpeverde active → cunning', () => {
    const m = houseEffects([mk(slyth, S)], [syn('slytherin2', 'house:Serpeverde')])
    expect(m[slyth]?.cunning?.bonus).toBeGreaterThan(0)
    expect(m[slyth]?.cunning?.threshold).toBeGreaterThan(0)
  })
  it('tiers scale: 4-member synergy gives a bigger dodge than 2-member', () => {
    const lo = houseEffects([mk(gryff, S)], [syn('gryffindor2', 'house:Grifondoro')])
    const hi = houseEffects([mk(gryff, S)], [syn('gryffindor4', 'house:Grifondoro')])
    expect(hi[gryff]!.dodgeBonus!).toBeGreaterThan(lo[gryff]!.dodgeBonus!)
  })
  it('each wizard gets ONLY its own house effect (mixed team)', () => {
    const m = houseEffects(
      [mk(gryff, S), mk(slyth, S)],
      [syn('gryffindor2', 'house:Grifondoro'), syn('slytherin2', 'house:Serpeverde')],
    )
    expect(m[gryff]?.dodgeBonus).toBeGreaterThan(0)
    expect(m[gryff]?.cunning).toBeUndefined()
    expect(m[slyth]?.cunning?.bonus).toBeGreaterThan(0)
    expect(m[slyth]?.dodgeBonus).toBeUndefined()
  })
})
