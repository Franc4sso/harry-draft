import type { DraftedWizard, GrowthChoice, Stats } from '@/types'
import { BALANCE } from '@/data/constants'

const L = BALANCE.leveling

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

export function isMilestone(level: number): boolean {
  return L.milestoneLevels.includes(level)
}

export function addExp(dw: DraftedWizard, amount: number): { dw: DraftedWizard; milestones: number[] } {
  const oldLevel = dw.level ?? 1
  const newExp = (dw.exp ?? 0) + Math.max(0, amount)
  const newLevel = levelFromExp(newExp)
  const milestones: number[] = []
  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    if (isMilestone(lv)) milestones.push(lv)
  }
  return { dw: { ...dw, exp: newExp, level: newLevel }, milestones }
}

/** Effective stats: base × auto-growth, then each milestone growth choice boosts its stat. */
export function leveledStats(dw: DraftedWizard): Stats {
  const level = dw.level ?? 1
  const growth = 1 + L.autoGrowthPct * (level - 1)
  const out: Stats = {
    hp: dw.stats.hp * growth,
    atk: dw.stats.atk * growth,
    def: dw.stats.def * growth,
    spd: dw.stats.spd * growth,
  }
  for (const c of dw.growthChoices ?? []) {
    out[c.kind] *= 1 + L.milestoneBoostPct
  }
  return { hp: Math.round(out.hp), atk: Math.round(out.atk), def: Math.round(out.def), spd: Math.round(out.spd) }
}

export function applyGrowthChoice(dw: DraftedWizard, choice: GrowthChoice): DraftedWizard {
  return { ...dw, growthChoices: [...(dw.growthChoices ?? []), choice] }
}
