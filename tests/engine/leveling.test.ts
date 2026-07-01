import { describe, it, expect } from 'vitest'
import { expForLevel, levelFromExp, addExp, gainLevels, leveledStats, growthWeights } from '@/game/engine/leveling'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'
import type { DraftedWizard, Stats } from '@/types'

function dw(stats: Stats, partial: Partial<DraftedWizard> = {}): DraftedWizard {
  return {
    wizard: { id: 'x', name: 'X', house: 'Grifondoro', role: 'Attaccante', tier: 4, gender: 'm',
      ranges: { hp: [stats.hp, stats.hp], atk: [stats.atk, stats.atk], def: [stats.def, stats.def], spd: [stats.spd, stats.spd] }, spellPool: ['s'] },
    stats, maxHp: stats.hp,
    spell: { id: 's' } as DraftedWizard['spell'],
    level: 1, exp: 0, growthChoices: [],
    ...partial,
  }
}

// Roster average base stat (range midpoints) — recomputed here independently so the
// "average profile" assertions don't depend on a private engine constant.
const ROSTER_MEAN: Stats = (() => {
  const s = { hp: 0, atk: 0, def: 0, spd: 0 }
  for (const w of WIZARDS) for (const k of ['hp', 'atk', 'def', 'spd'] as const) s[k] += (w.ranges[k][0] + w.ranges[k][1]) / 2
  const n = WIZARDS.length
  return { hp: s.hp / n, atk: s.atk / n, def: s.def / n, spd: s.spd / n }
})()

describe('leveling — exp curve', () => {
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
  it('addExp raises the level automatically from exp (no milestones)', () => {
    const r = addExp(dw(ROSTER_MEAN, { level: 1, exp: 0 }), expForLevel(3))
    expect(r.dw.level).toBe(3)
    expect(r.dw.exp).toBe(expForLevel(3))
    expect(r).not.toHaveProperty('milestones')
  })

  it('gainLevels grants whole levels and keeps exp coherent, clamped to levelMax', () => {
    const a = gainLevels(dw(ROSTER_MEAN, { level: 1, exp: 0 }), 2)
    expect(a.dw.level).toBe(3)
    expect(a.dw.exp).toBe(expForLevel(3))
    // clamps at the cap
    const capped = gainLevels(dw(ROSTER_MEAN, { level: BALANCE.leveling.levelMax - 1 }), 5)
    expect(capped.dw.level).toBe(BALANCE.leveling.levelMax)
  })
})

describe('leveling — per-wizard growth', () => {
  it('growthWeights sum to 1 and an average-profile wizard is uniform (0.25 each)', () => {
    const w = growthWeights(ROSTER_MEAN)
    expect(w.hp + w.atk + w.def + w.spd).toBeCloseTo(1, 10)
    expect(w.hp).toBeCloseTo(0.25, 10)
    expect(w.atk).toBeCloseTo(0.25, 10)
    expect(w.def).toBeCloseTo(0.25, 10)
    expect(w.spd).toBeCloseTo(0.25, 10)
  })

  it('an average-profile wizard still grows by the legacy uniform 1 + 0.07*(level-1)', () => {
    const L = BALANCE.leveling
    const lvl = 6
    const got = leveledStats(dw(ROSTER_MEAN, { level: lvl }))
    const mult = 1 + L.autoGrowthPct * (lvl - 1) // 0.28 budget × 0.25 weight == 0.07/level
    expect(got.hp).toBe(Math.round(ROSTER_MEAN.hp * mult))
    expect(got.atk).toBe(Math.round(ROSTER_MEAN.atk * mult))
    expect(got.def).toBe(Math.round(ROSTER_MEAN.def * mult))
    expect(got.spd).toBe(Math.round(ROSTER_MEAN.spd * mult))
  })

  it('a wizard strong in one stat specializes: that stat gets the largest weight and multiplier', () => {
    const strong = dw({ hp: ROSTER_MEAN.hp, atk: ROSTER_MEAN.atk * 2, def: ROSTER_MEAN.def, spd: ROSTER_MEAN.spd })
    const w = growthWeights(strong.stats)
    expect(w.atk).toBeGreaterThan(w.hp)
    expect(w.atk).toBeGreaterThan(w.def)
    expect(w.atk).toBeGreaterThan(w.spd)
    const hi = leveledStats({ ...strong, level: BALANCE.leveling.levelMax })
    const atkMult = hi.atk / strong.stats.atk
    const defMult = hi.def / strong.stats.def
    expect(atkMult).toBeGreaterThan(defMult)
  })

  it('leveledStats is identity at level 1 and treats a missing level as 1', () => {
    expect(leveledStats(dw(ROSTER_MEAN, { level: 1 }))).toEqual({
      hp: Math.round(ROSTER_MEAN.hp), atk: Math.round(ROSTER_MEAN.atk),
      def: Math.round(ROSTER_MEAN.def), spd: Math.round(ROSTER_MEAN.spd),
    })
    const base = { hp: 100, atk: 50, def: 40, spd: 30 }
    expect(leveledStats(dw(base, { level: undefined }))).toEqual(base)
  })

  it('every stat grows with level (no stat is left behind)', () => {
    const base = { hp: 100, atk: 50, def: 40, spd: 30 }
    const lo = leveledStats(dw(base, { level: 1 }))
    const hi = leveledStats(dw(base, { level: BALANCE.leveling.levelMax }))
    expect(hi.hp).toBeGreaterThan(lo.hp)
    expect(hi.atk).toBeGreaterThan(lo.atk)
    expect(hi.def).toBeGreaterThan(lo.def)
    expect(hi.spd).toBeGreaterThan(lo.spd)
  })
})
