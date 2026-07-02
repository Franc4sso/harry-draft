import { BALANCE } from '@/data/constants'

export type EnemyKind = 'normal' | 'elite' | 'boss'

/** Displayed enemy level as an explicit, area-scaled threat tier. normal → 1,2,3 ·
 *  elite → 2,3,4 · area-boss → 3,4,5 · final boss → levelMax. Clamped to [1, levelMax].
 *  (Lowered 2026-07-02, urgent balance fix — see data/constants.ts campaignB for the sweep.)
 *  This level drives REAL stat growth (via `leveledStats`/`battleReadyTeam`), so the
 *  level the player sees genuinely tracks difficulty — no menace multiplier involved
 *  (menace was removed 2026-07-01; see `menaceForLevel` below). */
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

/** REMOVED (2026-07-01): menace used to apply a SECOND stat multiplier on top of
 *  the enemy's already-leveled stats (see `leveledStats` / `battleReadyTeam`). Once
 *  enemies gained real per-level stat growth (commit f67fe4e), the old negative
 *  menaceOffset/menacePerLevel curve became a double nerf: `Math.max(0, 1 + menacePct)`
 *  crushed every real enemy level (2/4/6/8/10) down to a 0.05-0.13 stat multiplier —
 *  wizards showing "2 attack, 1 defense" in area 0. Enemy difficulty now comes ONLY
 *  from level (grown stats) + draft budget (`budgetB`), so this always returns 0 —
 *  kept as a function (not deleted outright) so `toBattleUnits`'s menace parameter
 *  and its callers/tests didn't need to change shape. */
export function menaceForLevel(_level: number): number {
  return 0
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
