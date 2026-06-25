import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import type { DraftedWizard, Synergy } from '@/types'

// Minimal drafted wizard for synergy detection (only fields membersFor reads).
function dw(id: string, house: string, role = 'Attaccante'): DraftedWizard {
  return { wizard: { id, name: id, house, role, tier: 3, ranges: { hp: [1,1], atk: [1,1], def: [1,1], spd: [1,1] }, spellPool: [], tags: [] } } as unknown as DraftedWizard
}

describe('detectSynergies tier suppression', () => {
  it('keeps only the highest active tier per family', () => {
    // 4 Grifondoro present → tier-4 active; tier-2 and tier-3 of the same family suppressed.
    const team = [dw('a','Grifondoro'), dw('b','Grifondoro'), dw('c','Grifondoro'), dw('d','Grifondoro')]
    const active = detectSynergies(team)
    const houseG = active.filter(a => a.synergy.family === 'house:Grifondoro')
    expect(houseG).toHaveLength(1)
    expect(houseG[0]!.synergy.requires.count).toBe(4)
  })

  it('keeps tier-2 when only 2 members (tier-3/4 inactive)', () => {
    const team = [dw('a','Grifondoro'), dw('b','Grifondoro')]
    const houseG = detectSynergies(team).filter(a => a.synergy.family === 'house:Grifondoro')
    expect(houseG).toHaveLength(1)
    expect(houseG[0]!.synergy.requires.count).toBe(2)
  })

  it('never suppresses family-less (group) synergies', () => {
    const team = [dw('harry','Grifondoro'), dw('ron','Grifondoro'), dw('hermione','Grifondoro')]
    const active = detectSynergies(team)
    expect(active.some(a => a.synergy.id === 'goldenTrio')).toBe(true)
  })
})
