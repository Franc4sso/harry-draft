import { describe, it, expect } from 'vitest'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { leveledStats } from '@/game/engine/leveling'
import type { DraftedWizard } from '@/types'

function dw(level: number, currentHp?: number): DraftedWizard {
  return {
    wizard: { id: 'w'+level, name: 'W', house: 'Corvonero', role: 'Tank', tier: 3, gender: 'f',
      ranges: { hp: [200,200], atk: [40,40], def: [60,60], spd: [20,20] }, spellPool: ['s'] },
    stats: { hp: 200, atk: 40, def: 60, spd: 20 }, maxHp: 200,
    spell: { id: 's' } as DraftedWizard['spell'], level, exp: 0, growthChoices: [], currentHp,
  }
}

describe('battleReadyTeam', () => {
  it('replaces stats with leveledStats and maxHp with leveled hp', () => {
    const out = battleReadyTeam([dw(5)])[0]!
    const ls = leveledStats(dw(5))
    expect(out.stats).toEqual(ls)
    expect(out.maxHp).toBe(ls.hp)
  })
  it('preserves wound fraction when scaling currentHp to the leveled pool', () => {
    // base maxHp 200, currentHp 100 → 50% wounded. Leveled hp scales; currentHp stays ~50%.
    const out = battleReadyTeam([dw(5, 100)])[0]!
    const frac = out.currentHp! / out.maxHp
    expect(frac).toBeGreaterThan(0.49)
    expect(frac).toBeLessThan(0.51)
  })
  it('leaves a full (no currentHp) wizard at full leveled hp', () => {
    const out = battleReadyTeam([dw(3)])[0]!
    expect(out.currentHp).toBeUndefined()
  })
  it('does not mutate the input', () => {
    const team = [dw(4, 80)]
    battleReadyTeam(team)
    expect(team[0]!.stats.hp).toBe(200)
  })
})
