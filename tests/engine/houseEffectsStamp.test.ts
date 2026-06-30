import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const S: Stats = { hp: 100, atk: 10, def: 10, spd: 10 }
// Three Grifondoro to trigger gryffindor3.
const gryffs = WIZARDS.filter(w => w.house === 'Grifondoro').slice(0, 3).map(w => w.id)

describe('toBattleUnits stamps house effects', () => {
  it('no synergy → no house fields', () => {
    const units = toBattleUnits([mk(gryffs[0]!, S)], 'left', [], [])
    expect(units[0]!.dodgeBonus).toBeUndefined()
  })
  it('Grifondoro trio → each unit has dodgeBonus', () => {
    const team = gryffs.map(id => mk(id, S))
    const units = toBattleUnits(team, 'left', detectSynergies(team), [])
    expect(units.every(u => (u.dodgeBonus ?? 0) > 0)).toBe(true)
  })
})
