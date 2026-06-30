import { BALANCE } from '@/data/constants'

export type EnemyKind = 'normal' | 'elite' | 'boss'

/** Displayed enemy level as an explicit, area-scaled threat tier (NOT derived from
 *  menace). normal → 1,3,5 · elite → 3,5,7 · area-boss → 4,6,8 · final boss → levelMax.
 *  Clamped to [1, levelMax]. Enemy menace is derived FROM this (see menaceForLevel),
 *  so the level the player sees genuinely tracks difficulty. */
export function enemyLevelFor(area: number, kind: EnemyKind, isFinalBoss: boolean): number {
  const cb = BALANCE.campaignB
  const max = BALANCE.leveling.levelMax
  const lvl = isFinalBoss
    ? max
    : kind === 'boss' ? cb.bossLevelBase + cb.bossLevelPerArea * area
    : kind === 'elite' ? cb.eliteLevelBase + cb.eliteLevelPerArea * area
    : cb.normalLevelBase + cb.normalLevelPerArea * area
  return Math.max(1, Math.min(max, lvl))
}

/** Enemy stat menace (1+pct) derived from the displayed level: a higher-level foe is
 *  a genuinely stronger one. menaceOffset is negative to keep area-0 (level-1) fights
 *  winnable for a starting level-1 duo. */
export function menaceForLevel(level: number): number {
  const cb = BALANCE.campaignB
  return (level - 1) * cb.menacePerLevel + cb.menaceOffset
}

/** Monotonic progression depth across areas: areas are spaced by floorsPerArea so
 *  the last node of one area and the first of the next never collide. */
export function globalDepth(area: number, floor: number): number {
  return area * BALANCE.map.floorsPerArea + floor
}

/** New-loop enemy budget at a global depth (decoupled from the legacy `campaign`). */
export function budgetB(depth: number): number {
  return BALANCE.campaignB.baseBudget + depth * BALANCE.campaignB.budgetStep
}
