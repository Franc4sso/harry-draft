import { describe, it, expect } from 'vitest'
import { detectSynergies, applyBonuses, totalRegen } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

function team(ids: string[]) {
  const r = createRng(1)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('synergy', () => {
  it('detects golden trio', () => {
    const active = detectSynergies(team(['harry', 'ron', 'hermione', 'luna', 'neville']))
    expect(active.find(a => a.synergy.id === 'goldenTrio')).toBeTruthy()
  })
  it('does not detect trio without all three', () => {
    const active = detectSynergies(team(['harry', 'ron', 'luna', 'neville', 'draco']))
    expect(active.find(a => a.synergy.id === 'goldenTrio')).toBeFalsy()
  })
  it('applyBonuses adds flat then percent', () => {
    const base = { hp: 100, atk: 100, def: 100, spd: 100 }
    const fakeSyn = [
      { synergy: { id: 'x', name: 'x', kind: 'house', requires: {}, bonus: { atk: 20 } }, memberIds: [] },
      { synergy: { id: 'y', name: 'y', kind: 'group', requires: {}, bonus: { allPct: 0.1 } }, memberIds: [] },
    ] as const
    const out = applyBonuses(base, fakeSyn as never)
    expect(out.atk).toBe(Math.round((100 + 20) * 1.1))
    expect(out.hp).toBe(Math.round(100 * 1.1))
  })
  it('totalRegen sums regen bonuses', () => {
    const active = detectSynergies(team(['fred', 'george', 'molly', 'arthur', 'ginny']))
    expect(totalRegen(active)).toBeGreaterThan(0)
  })
})
