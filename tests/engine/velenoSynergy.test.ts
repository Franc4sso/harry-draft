import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard } from '@/types'

function draft(id: string): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  const stats = { hp: 100, atk: 30, def: 15, spd: 25 }
  return { wizard, stats, maxHp: 100, spell: SPELL_BY_ID['base_attack']! }
}

describe('Tossicità synergy', () => {
  it('activates with 3 veleno-tagged wizards', () => {
    const team = ['bellatrix', 'dolohov', 'slughorn'].map(draft)
    const ids = detectSynergies(team).map(a => a.synergy.id)
    expect(ids).toContain('tossicita')
  })
  it('does not activate with only 2', () => {
    const team = ['bellatrix', 'dolohov'].map(draft)
    const ids = detectSynergies(team).map(a => a.synergy.id)
    expect(ids).not.toContain('tossicita')
  })
})

import { applyStatus } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

function mkUnit(maxHp = 100): BattleUnit {
  return { wizard: { id: 'd' }, side: 'right', hp: maxHp, maxHp, cooldowns: {}, statusEffects: [], alive: true } as unknown as BattleUnit
}

describe('veleno cap override', () => {
  it('caps at maxStacks(8) by default', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')
    expect(u.statusEffects.find(e => e.statusId === 'veleno')!.stacks).toBe(8)
  })
  it('ignores the cap when maxStacks override is Infinity', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno', { maxStacks: Infinity })
    expect(u.statusEffects.find(e => e.statusId === 'veleno')!.stacks).toBe(12)
  })
})
