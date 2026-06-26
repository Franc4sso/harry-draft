import { describe, it, expect } from 'vitest'
import { expForLevel, levelFromExp, isMilestone, addExp, leveledStats, applyGrowthChoice } from '@/game/engine/leveling'
import { BALANCE } from '@/data/constants'
import type { DraftedWizard } from '@/types'

function dw(partial: Partial<DraftedWizard> = {}): DraftedWizard {
  return {
    wizard: { id: 'x', name: 'X', house: 'Grifondoro', role: 'Attaccante', tier: 4, gender: 'm',
      ranges: { hp: [100, 100], atk: [50, 50], def: [40, 40], spd: [30, 30] }, spellPool: ['s'] },
    stats: { hp: 100, atk: 50, def: 40, spd: 30 }, maxHp: 100,
    spell: { id: 's' } as DraftedWizard['spell'],
    level: 1, exp: 0, growthChoices: [],
    ...partial,
  }
}

describe('leveling', () => {
  it('expForLevel is 0 at level 1 and strictly increasing', () => {
    expect(expForLevel(1)).toBe(0)
    expect(expForLevel(2)).toBeGreaterThan(expForLevel(1))
    expect(expForLevel(3)).toBeGreaterThan(expForLevel(2))
  })
  it('levelFromExp inverts expForLevel and caps at levelMax', () => {
    expect(levelFromExp(0)).toBe(1)
    expect(levelFromExp(expForLevel(3))).toBe(3)
    expect(levelFromExp(expForLevel(3) - 1)).toBe(2)
    expect(levelFromExp(10_000_000)).toBe(BALANCE.leveling.levelMax)
  })
  it('isMilestone matches configured levels', () => {
    expect(isMilestone(3)).toBe(true)
    expect(isMilestone(4)).toBe(false)
  })
  it('addExp bumps level and reports newly crossed milestones', () => {
    const r = addExp(dw({ level: 1, exp: 0 }), expForLevel(3))
    expect(r.dw.level).toBe(3)
    expect(r.dw.exp).toBe(expForLevel(3))
    expect(r.milestones).toContain(3)
  })
  it('addExp does not re-report an already-passed milestone', () => {
    const at3 = addExp(dw({ level: 1, exp: 0 }), expForLevel(3)).dw
    const r = addExp(at3, expForLevel(4) - expForLevel(3))
    expect(r.dw.level).toBe(4)
    expect(r.milestones).not.toContain(3)
  })
  it('leveledStats grows with level', () => {
    const lo = leveledStats(dw({ level: 1 }))
    const hi = leveledStats(dw({ level: 5 }))
    expect(hi.atk).toBeGreaterThan(lo.atk)
    expect(lo.atk).toBe(50) // livello 1 = stat base
  })
  it('leveledStats treats missing level as 1', () => {
    expect(leveledStats(dw({ level: undefined }))).toEqual({ hp: 100, atk: 50, def: 40, spd: 30 })
  })
  it('applyGrowthChoice boosts the chosen stat', () => {
    const grown = applyGrowthChoice(dw({ level: 3 }), { atLevel: 3, kind: 'atk' })
    expect(grown.growthChoices).toHaveLength(1)
    expect(leveledStats(grown).atk).toBeGreaterThan(leveledStats(dw({ level: 3 })).atk)
  })
})
