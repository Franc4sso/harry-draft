import { describe, it, expect } from 'vitest'
import { detectSynergies, applyBonuses } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

function team(ids: string[]) {
  const r = createRng(1)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('synergy', () => {
  it('detects tossicita with 3 veleno-tagged wizards', () => {
    const active = detectSynergies(team(['bellatrix', 'pansy', 'blaise']))
    expect(active.find(a => a.synergy.id === 'tossicita')).toBeTruthy()
  })
  it('does not detect tossicita without 3 veleno tags', () => {
    const active = detectSynergies(team(['harry', 'ron', 'luna', 'neville', 'draco']))
    expect(active.find(a => a.synergy.id === 'tossicita')).toBeFalsy()
  })
  // applyBonuses stays alive for the boss's synthetic exclusiveSynergy (data/bosses.ts),
  // NOT for SYNERGIES content (Tossicità carries only keywordMult, no stat bonus).
  it('applyBonuses adds flat then percent (boss synthetic-synergy path)', () => {
    const base = { hp: 100, atk: 100, def: 100, spd: 100 }
    const fakeSyn = [
      { synergy: { id: 'x', name: 'x', kind: 'group', requires: {}, bonus: { atk: 20 } }, memberIds: [] },
      { synergy: { id: 'darkLord', name: 'y', kind: 'group', requires: {}, bonus: { allPct: 0.1 } }, memberIds: [] },
    ] as const
    const out = applyBonuses(base, fakeSyn as never)
    expect(out.atk).toBe(Math.round((100 + 20) * 1.1))
    expect(out.hp).toBe(Math.round(100 * 1.1))
  })
  it('applyBonuses is a no-op for tossicita (keywordMult only, no flat/allPct)', () => {
    const active = detectSynergies(team(['bellatrix', 'pansy', 'blaise']))
    const base = { hp: 100, atk: 100, def: 100, spd: 100 }
    expect(applyBonuses(base, active)).toEqual(base)
  })
})
