import { describe, it, expect } from 'vitest'
import type { DraftedWizard, Wizard } from '@/types'
import { synergyProgress, previewSynergies, synergyThreshold } from '@/game/engine/synergy'
import { SYNERGIES } from '@/data/synergies'

function dw(id: string, tags: string[] = []): DraftedWizard {
  const wizard: Wizard = {
    id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
    gender: 'm',
    ranges: { hp: [80, 80], atk: [10, 10], def: [10, 10], spd: [10, 10] },
    spellPool: ['x'], tags,
  }
  return {
    wizard,
    stats: { hp: 80, atk: 10, def: 10, spd: 10 },
    maxHp: 80,
    spell: { id: 'x', name: 'X', type: 'Attacco', hitChance: 1 },
  } as DraftedWizard
}

const weasleySyn = SYNERGIES.find((s) => s.id === 'weasley')!

describe('synergyThreshold', () => {
  it('uses requires.count, else ids.length, else 3', () => {
    expect(synergyThreshold(weasleySyn)).toBe(3)
    expect(synergyThreshold(SYNERGIES.find((s) => s.id === 'goldenTrio')!)).toBe(3)
    expect(synergyThreshold(SYNERGIES.find((s) => s.id === 'marauder')!)).toBe(2)
  })
})

describe('synergyProgress', () => {
  it('counts partial progress and active state for a group synergy', () => {
    const team = [dw('a', ['weasley']), dw('b', ['weasley'])]
    const p = synergyProgress(team).find((x) => x.synergy.id === 'weasley')!
    expect(p.count).toBe(2)
    expect(p.threshold).toBe(3)
    expect(p.active).toBe(false)
    expect(p.memberIds.sort()).toEqual(['a', 'b'])
  })
  it('marks active when threshold reached', () => {
    const team = [dw('a', ['weasley']), dw('b', ['weasley']), dw('c', ['weasley'])]
    const p = synergyProgress(team).find((x) => x.synergy.id === 'weasley')!
    expect(p.active).toBe(true)
    expect(p.count).toBe(3)
  })
})

describe('previewSynergies', () => {
  it('projects the +1 and flags advances / willActivate', () => {
    const team = [dw('a', ['weasley']), dw('b', ['weasley'])]
    const cand = dw('c', ['weasley'])
    const pv = previewSynergies(team, cand).find((x) => x.synergy.id === 'weasley')!
    expect(pv.count).toBe(2)
    expect(pv.nextCount).toBe(3)
    expect(pv.advances).toBe(true)
    expect(pv.willActivate).toBe(true)
  })
  it('does not advance a synergy the candidate does not match', () => {
    const team = [dw('a', ['weasley'])]
    const cand = dw('z', ['deatheater'])
    const pv = previewSynergies(team, cand).find((x) => x.synergy.id === 'weasley')!
    expect(pv.advances).toBe(false)
    expect(pv.nextCount).toBe(1)
  })
})
