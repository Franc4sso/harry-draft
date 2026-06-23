import type { Tier, RelicRarity } from '@/types'

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
    // Stages of budget headroom used to map an enemy budget onto a roster
    // power-percentile. Smaller = steeper difficulty (late enemies/boss draft
    // from the very top of the roster). Tuned for ~50% clear at optimal play.
    difficultySpan: 7,
  },
  map: {
    floors: 6,            // total floors incl. start(0) + boss(last); 4 middle floors
    minWidth: 2,          // min nodes per middle floor
    maxWidth: 3,          // max nodes per middle floor
    eliteFloors: [3],     // 0-based middle-floor indices forced to 'elite'
    eliteBudgetMult: 1.35,// enemy-budget multiplier on elite nodes
  },
  relics: {
    offerCount: 3,
    rarityWeights: {
      'comune': 50,
      'non-comune': 28,
      'rara': 16,
      'epica': 6,
    } as Record<RelicRarity, number>,
  },
} as const
