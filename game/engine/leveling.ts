import type { DraftedWizard, Stats } from '@/types'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'

const L = BALANCE.leveling

const STAT_KEYS = ['hp', 'atk', 'def', 'spd'] as const

// Roster average base stat (range midpoint) per stat — the yardstick a wizard's
// growth leans against: above-average stats grow faster.
const ROSTER_MEAN: Stats = (() => {
  const s = { hp: 0, atk: 0, def: 0, spd: 0 }
  for (const w of WIZARDS) for (const k of STAT_KEYS) s[k] += (w.ranges[k][0] + w.ranges[k][1]) / 2
  const n = WIZARDS.length || 1
  return { hp: s.hp / n, atk: s.atk / n, def: s.def / n, spd: s.spd / n }
})()

/** Per-wizard growth weights: each stat weighted by how it compares to the roster
 *  average (squared to sharpen specialization), normalized to sum to 1. */
export function growthWeights(base: Stats): Stats {
  const raw = {
    hp: (base.hp / ROSTER_MEAN.hp) ** 2,
    atk: (base.atk / ROSTER_MEAN.atk) ** 2,
    def: (base.def / ROSTER_MEAN.def) ** 2,
    spd: (base.spd / ROSTER_MEAN.spd) ** 2,
  }
  const total = raw.hp + raw.atk + raw.def + raw.spd || 1
  return { hp: raw.hp / total, atk: raw.atk / total, def: raw.def / total, spd: raw.spd / total }
}

/** Cumulative EXP required to BE at `level`. Level 1 = 0. Step grows linearly. */
export function expForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level))
  // sum_{k=1}^{n-1} expStep*k = expStep * (n-1)*n/2
  return L.expStep * ((n - 1) * n) / 2
}

export function levelFromExp(exp: number): number {
  let lvl = 1
  while (lvl < L.levelMax && exp >= expForLevel(lvl + 1)) lvl++
  return lvl
}

/** Award EXP and recompute level. Levels rise automatically from exp — there is no
 *  milestone stat-choice; growth is applied per-wizard in `leveledStats`. */
export function addExp(dw: DraftedWizard, amount: number): { dw: DraftedWizard } {
  const newExp = (dw.exp ?? 0) + Math.max(0, amount)
  const newLevel = levelFromExp(newExp)
  return { dw: { ...dw, exp: newExp, level: newLevel } }
}

/** Grant `n` whole levels at once (clamped to [1, levelMax]), keeping `exp` coherent
 *  with the new level. Win-based progression: clearing a fight levels survivors
 *  directly (normal +1, elite +2, boss +3) instead of accumulating exp. */
export function gainLevels(dw: DraftedWizard, n: number): { dw: DraftedWizard } {
  const newLevel = Math.min(L.levelMax, Math.max(1, (dw.level ?? 1) + Math.max(0, Math.floor(n))))
  return { dw: { ...dw, level: newLevel, exp: expForLevel(newLevel) } }
}

/** Effective stats: every stat grows EVERY level by a per-wizard share of the total
 *  growth budget. A wizard's strongest stats (vs the roster average) get the larger
 *  share, so each wizard specializes in what it is already good at. With an average
 *  profile (each weight = 0.25) the multiplier collapses to 1 + 0.10*(level-1) — the
 *  same total budget as the old uniform auto-growth, just redistributed per-wizard. */
export function leveledStats(dw: DraftedWizard): Stats {
  const level = dw.level ?? 1
  const steps = level - 1
  const w = growthWeights(dw.stats)
  const m = (k: keyof Stats) => 1 + L.growthBudgetPerLevel * w[k] * steps
  return {
    hp: Math.round(dw.stats.hp * m('hp')),
    atk: Math.round(dw.stats.atk * m('atk')),
    def: Math.round(dw.stats.def * m('def')),
    spd: Math.round(dw.stats.spd * m('spd')),
  }
}
