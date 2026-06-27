import { describe, it, expect } from 'vitest'
import { statBreakdown } from '@/lib/statBreakdown'
import { leveledStats } from '@/game/engine/leveling'
import type { DraftedWizard } from '@/types'

function dw(level = 1): DraftedWizard {
  return {
    wizard: { id: 'h', name: 'H', house: 'Grifondoro', role: 'Attaccante', tier: 4, gender: 'm',
      ranges: { hp: [100,100], atk: [50,50], def: [40,40], spd: [30,30] }, spellPool: ['s'] },
    stats: { hp: 100, atk: 50, def: 40, spd: 30 }, maxHp: 100,
    spell: { id: 's' } as DraftedWizard['spell'], level, exp: 0, growthChoices: [],
  }
}

describe('statBreakdown', () => {
  it('base layer equals the wizard base stats', () => {
    expect(statBreakdown(dw(1), [dw(1)], [], []).base).toEqual({ hp: 100, atk: 50, def: 40, spd: 30 })
  })
  it('afterLevel equals leveledStats', () => {
    const w = dw(5)
    expect(statBreakdown(w, [w], [], []).afterLevel).toEqual(leveledStats(w))
  })
  it('with no synergies/relics, total equals afterLevel', () => {
    const w = dw(3)
    const b = statBreakdown(w, [w], [], [])
    expect(b.total).toEqual(b.afterLevel)
  })
  it('layers are monotonic when synergy adds positive bonuses', () => {
    const w = dw(1)
    const syn = [{ synergy: { id: 'x', name: 'x', kind: 'house', family: 'house:Grifondoro',
      requires: { house: 'Grifondoro', count: 1 }, bonus: { def: 20 } }, memberIds: ['h'] }] as any
    const b = statBreakdown(w, [w], syn, [])
    expect(b.afterSynergy.def).toBeGreaterThan(b.afterLevel.def)
    expect(b.total.def).toBe(b.afterSynergy.def) // no relics → relic layer is identity
  })
})
