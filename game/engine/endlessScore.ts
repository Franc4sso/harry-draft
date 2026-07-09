import { BALANCE } from '@/data/constants'

export interface EndlessScoreInput {
  floorsCleared: number
  eliteKills: number
  bossKills: number
  /** Fraction of total team HP preserved at run end, in [0,1]. */
  hpFraction: number
}

// Style bonus weights. Multiplicative on the depth base so more depth always wins
// (monotonicity): score = depth*P*(1 + killBonus + hpBonus).
const ELITE_WEIGHT = 0.05
const BOSS_WEIGHT = 0.15
const HP_WEIGHT = 0.25

export function endlessScore(input: EndlessScoreInput): number {
  const depth = Math.max(0, Math.floor(input.floorsCleared))
  const base = depth * BALANCE.endless.pointsPerFloor
  const killBonus = input.eliteKills * ELITE_WEIGHT + input.bossKills * BOSS_WEIGHT
  const hpBonus = Math.min(1, Math.max(0, input.hpFraction)) * HP_WEIGHT
  return Math.round(base * (1 + killBonus + hpBonus))
}
