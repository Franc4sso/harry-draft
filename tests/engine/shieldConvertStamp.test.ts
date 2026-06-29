import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const egida: ActiveRelic = { relic: { id: 'egida-tassorosso', name: 'Egida', desc: '', rarity: 'rara', grantsShieldConvert: { rate: 0.5 } }, stageObtained: 0 }

describe('toBattleUnits stamps shieldConvert', () => {
  const team = [mk('cedric', { hp: 200, atk: 20, def: 20, spd: 20 })]
  it('is undefined with no conversion source', () => {
    expect(toBattleUnits(team, 'left', [], []).every(u => u.shieldConvert === undefined)).toBe(true)
  })
  it('is stamped on every unit when a grant relic is present', () => {
    const units = toBattleUnits(team, 'left', [], [egida])
    expect(units.every(u => u.shieldConvert?.rate === 0.5)).toBe(true)
  })
})
