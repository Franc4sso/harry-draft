import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const S: Stats = { hp: 200, atk: 20, def: 20, spd: 20 }
const marchio = (carrier: string): ActiveRelic => ({ relic: { id: 'marchio-nero', name: 'Marchio', desc: '', rarity: 'rara', keywords: ['magieOscure'], assignable: true, grantsDarkMagic: { bonus: 0.5, recoil: 0.2 } }, stageObtained: 0, assignedTo: carrier })

describe('toBattleUnits stamps darkMagic', () => {
  const team = [mk('voldemort', S), mk('snape', S)]
  it('is undefined with no dark source', () => {
    expect(toBattleUnits(team, 'left', [], []).every(u => u.darkMagic === undefined)).toBe(true)
  })
  it('stamps only the assigned carrier', () => {
    const units = toBattleUnits(team, 'left', [], [marchio('voldemort')])
    const vold = units.find(u => u.wizard.id === 'voldemort')!
    const snape = units.find(u => u.wizard.id === 'snape')!
    expect(vold.darkMagic).toEqual({ bonus: 0.5, recoil: 0.2 })
    expect(snape.darkMagic).toBeUndefined()
  })
})
