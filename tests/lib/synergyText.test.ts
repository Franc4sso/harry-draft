import { describe, it, expect } from 'vitest'
import { synergyBonusText } from '@/lib/glossary'
import { SYNERGIES } from '@/data/synergies'

const byId = (id: string) => SYNERGIES.find(s => s.id === id)!

describe('synergyBonusText with full Synergy', () => {
  it('role synergy: stat bonus unchanged', () => {
    expect(synergyBonusText(byId('attackers3'))).toEqual(['+15 ATK'])
  })
  it('house synergy (empty bonus): shows the derived house effect', () => {
    expect(synergyBonusText(byId('gryffindor3'))).toEqual(['Schivata +8%'])
    expect(synergyBonusText(byId('ravenclaw3'))).toEqual(['Critico 26% (×2.0)'])
  })
  it('Tassorosso: shows BOTH regen (bonus) and damage reduction (house effect)', () => {
    expect(synergyBonusText(byId('hufflepuff3'))).toEqual(['Rigenera 12/turno', 'Riduzione danno 16%'])
  })
  it('group synergy with allPct: unchanged', () => {
    expect(synergyBonusText(byId('goldenTrio'))).toEqual(['+15% a tutte le statistiche'])
  })
})
