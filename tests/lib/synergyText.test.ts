import { describe, it, expect } from 'vitest'
import { synergyBonusText } from '@/lib/glossary'
import { SYNERGIES } from '@/data/synergies'

const byId = (id: string) => SYNERGIES.find(s => s.id === id)!

describe('synergyBonusText with full Synergy', () => {
  it('group synergy: flat stat bonus', () => {
    expect(synergyBonusText(byId('deatheater'))).toEqual(['+25 ATK'])
  })
  it('origin synergy: flat stat bonus', () => {
    expect(synergyBonusText(byId('bastione'))).toEqual(['+8 DIF'])
  })
  it('group synergy with both regen and a flat stat', () => {
    expect(synergyBonusText(byId('weasley'))).toEqual(['+10 DIF', 'Rigenera 8/turno'])
  })
  it('group synergy with allPct: unchanged', () => {
    expect(synergyBonusText(byId('goldenTrio'))).toEqual(['+15% a tutte le statistiche'])
  })
})
