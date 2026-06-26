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
    // Anti-stall "fatigue": past `fatigueStart`, every unit takes escalating TRUE
    // damage at end of turn (`maxHp * fatiguePctStep * (turn - fatigueStart)`),
    // ignoring def/shields/heals so defensive stalemates always converge ~turn 40
    // instead of grinding to turnCap. Normal fights end long before fatigueStart.
    fatigueStart: 30,
    fatiguePctStep: 0.05,
    // A direct damage hit on a frozen unit shatters the freeze: it ends and the
    // breaking hit deals this multiplier. DoT ticks do NOT shatter.
    freezeShatterMult: 1.5,
  },
  draft: {
    screenSize: 5,
    teamSize: 5,
    tierWeights: { 1: 4, 2: 12, 3: 32, 4: 52 } as Record<Tier, number>,
    maxTier1PerScreen: 1,
    shinyChance: 0.015,
  },
  campaign: {
    enemyCount: 5,
    // Brutal calibration: mid-game enemies are deliberately gentle so optimal
    // players survive the HP-persistence attrition of the 4 middle fights and
    // reach the boss (~37% reach rate — the structural ceiling). Brutality is
    // concentrated in the boss (relics + exclusive synergy + menace), giving a
    // whip curve. Calibrated against tests/engine/campaignBalance.test.ts.
    baseBudget: 700,
    budgetStep: 120,
    // Stages of budget headroom used to map an enemy budget onto a roster
    // power-percentile. Larger = gentler (enemies draft from lower percentiles).
    difficultySpan: 12,
    // "Menace": every enemy team's stats are multiplied by (1 + menacePct), where
    // menacePct = menaceBase + menacePerStage * stage, ×menaceEliteMult on elite,
    // ×menaceBossMult on boss. A small per-stage ramp keeps mid fights gentle
    // (~+2% mid) while the boss term bites (~+10%); larger ramps overshoot the
    // brutal band because HP-persistence compounds mid-game losses.
    menaceBase: 0,
    menacePerStage: 0.01,
    menaceEliteMult: 1.3,
    menaceBossMult: 2,
    // Real relics handed to enemy teams on elite/boss nodes (deterministic per seed).
    enemyRelicsElite: 1,
    enemyRelicsBoss: 3,
  },
  map: {
    floors: 6,            // total floors incl. start(0) + boss(last); 4 middle floors
    minWidth: 2,          // min nodes per middle floor
    maxWidth: 3,          // max nodes per middle floor
    eliteFloors: [3] as readonly number[],  // 0-based middle-floor indices forced to 'elite'
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
  roles: {
    tauntBonus: 1000,       // additive threat that makes a live Tank the focus
    attackerArmorPen: 0.4,  // fraction of target DEF an Attaccante ignores
  },
} as const
