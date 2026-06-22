import type { Tier } from '@/types'

export const BALANCE = {
  combat: {
    turnCap: 100,
    baseAttackMult: 0.45,
    defenseK: 0.5,
    minDamage: 1,
    critBase: 0.05,
    critSpdScale: 0.0015,
    critMult: 1.6,
    dodgeBase: 0.02,
    dodgeScale: 0.0012,
  },
  draft: {
    screenSize: 5,
    teamSize: 5,
    tierWeights: { 1: 4, 2: 12, 3: 32, 4: 52 } as Record<Tier, number>,
    tierRollBias: { 1: 0.85, 2: 0.65, 3: 0.5, 4: 0.4 } as Record<Tier, number>,
    maxTier1PerScreen: 1,
  },
  campaign: {
    enemyCount: 5,
    baseBudget: 1500,
    budgetStep: 220,
  },
} as const
