import { describe, it, expect } from 'vitest'
import { isDead, livingOf } from '@/game/engine/roster'
import { applyBattleToRoster } from '@/game/engine/run'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, UnitSnapshot } from '@/types'

const mk = (id: string, currentHp?: number): DraftedWizard => ({
  wizard: WIZARDS.find(w => w.id === id)!, stats: { hp: 100, atk: 10, def: 10, spd: 10 },
  maxHp: 100, spell: SPELL_BY_ID['base_attack']!, ...(currentHp !== undefined ? { currentHp } : {}),
})

describe('death bench helpers', () => {
  it('isDead: 0 HP is dead, undefined/positive is alive', () => {
    expect(isDead(mk('harry', 0))).toBe(true)
    expect(isDead(mk('harry', 1))).toBe(false)
    expect(isDead(mk('harry'))).toBe(false)   // undefined currentHp = full = alive
  })
  it('livingOf drops the dead', () => {
    const team = [mk('harry', 50), mk('voldemort', 0), mk('snape')]
    expect(livingOf(team).map(d => d.wizard.id)).toEqual(['harry', 'snape'])
  })
})

describe('applyBattleToRoster keeps the dead benched at 0 HP', () => {
  const team = [mk('harry'), mk('voldemort')]
  const snapshot: UnitSnapshot[] = [
    { id: 'harry', side: 'left', hp: 40, maxHp: 100, alive: true } as UnitSnapshot,
    { id: 'voldemort', side: 'left', hp: 0, maxHp: 100, alive: false } as UnitSnapshot,
  ]
  it('the dead wizard stays in the roster at currentHp 0 (not removed)', () => {
    const out = applyBattleToRoster(team, snapshot)
    expect(out.map(d => d.wizard.id)).toEqual(['harry', 'voldemort'])   // both kept
    expect(out.find(d => d.wizard.id === 'voldemort')!.currentHp).toBe(0)
    expect(out.find(d => d.wizard.id === 'harry')!.currentHp).toBe(40)
  })
})

import { battleReadyTeam } from '@/game/engine/battlePrep'
describe('only the living are fielded', () => {
  it('battleReadyTeam(livingOf(...)) excludes a benched dead wizard', () => {
    const team = [mk('harry', 50), mk('voldemort', 0)]
    const fielded = battleReadyTeam(livingOf(team))
    expect(fielded.map(d => d.wizard.id)).toEqual(['harry'])
  })
})
