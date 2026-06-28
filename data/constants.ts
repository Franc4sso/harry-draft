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
    tierWeights: { 1: 1, 2: 3, 3: 30, 4: 66 } as Record<Tier, number>,
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
    menaceBossMult: 3,
    // Real relics handed to enemy teams on elite/boss nodes (deterministic per seed).
    enemyRelicsElite: 1,
    enemyRelicsBoss: 3,
  },
  // New roguelite loop (Plan B) difficulty — DECOUPLED from `campaign` above.
  // The legacy single-area loop starts with a full drafted team of 5; the new loop
  // starts with 2 level-1 wizards growing to 5 across 3 areas, so it needs a much
  // gentler early curve. Enemy budgets below `campaign.baseBudget` (700) make
  // `pickTowardBudget` draft from the weakest roster percentile. These are the ONLY
  // numbers the new-loop balance harness (campaignBalanceB.test.ts) calibrates; the
  // legacy `campaign` block and its test are never touched by new-loop tuning.
  campaignB: {
    // --- Enemy team SIZE ---
    // Normal fights are small skirmishes (a starting level-1 duo is not swarmed);
    // Elite / area-boss fields field the area's full count, so they read as the
    // bigger threat. Index = area (player grows 2→5 across the 3 areas). The final
    // boss is always a full team of 5 (generateBossTeam).
    normalEnemyCount: 2,
    enemyCountByArea: [3, 4, 5] as readonly number[],
    // --- Displayed enemy LEVEL by (area, kind) ---
    // Honest, area-scaled threat tiers so an Elite/Boss reads as a real level (no
    // more "Lv.1" elites). level = base + perArea*area, clamped to leveling.levelMax.
    //   normal → 1,3,5   elite → 3,5,7   area-boss → 4,6,8   final boss → levelMax(10)
    // The level is NOT cosmetic: enemy menace is DERIVED from it (below), so a higher
    // level is a genuinely tougher foe.
    normalLevelBase: 1, normalLevelPerArea: 2,
    eliteLevelBase: 3, eliteLevelPerArea: 2,
    bossLevelBase: 4, bossLevelPerArea: 2,
    // --- Enemy budget (stat-selection) by global depth d = area*floorsPerArea + floor ---
    //   normal = baseBudget + d*budgetStep, ×eliteBudgetMult on elite, ×bossBudgetMult on area boss.
    baseBudget: 300,
    budgetStep: 70,
    eliteBudgetMult: 1.15,
    bossBudgetMult: 1.3,
    // --- Enemy MENACE (stat multiplier 1+pct), DERIVED from the displayed level ---
    // menace(level) = (level-1)*menacePerLevel + menaceOffset. menaceOffset is NEGATIVE
    // so an area-0 (level-1) fight drops below the roster floor — a starting level-1
    // duo can win; the per-level term lifts elites/bosses/late areas into a real
    // threat. The level↔menace link means the number the player sees tracks real
    // difficulty. Calibrated by tests/engine/campaignBalanceB.test.ts (120-seed
    // near-optimal win-rate must stay in [0.15, 0.55]).
    //
    // Final calibration (120-seed harness → 0.208, deaths split 36/18/41 across areas
    // so the final boss stays the wall): menacePerLevel 0.07 keeps the area-0 elite
    // survivable for a starting duo while still ranking it above the area's normals;
    // menaceOffset -1.02 floors the 2-enemy normal skirmishes near-trivial; the model
    // replaced the old depth-ramp (menaceBase/menacePerDepth/menaceEliteMult/
    // menaceBossMult) so level and difficulty move together.
    menacePerLevel: 0.07,
    menaceOffset: -1.02,
    // The FINAL area boss is the scripted Voldemort (BOSSES[0], fixed budget); its
    // menace is this flat value (independent of the level curve) so it stays the climax.
    // -0.35 (was -0.25): the level-driven path eased area-0 enough that the unchanged
    // boss became the sole binding constraint at ~0.175; loosening it lifts the run to
    // a healthier 0.208 while the boss still claims most area-2 losses.
    finalBossMenace: -0.35,
    enemyRelicsElite: 0,
    enemyRelicsBoss: 1,
  },
  map: {
    floors: 6,            // total floors incl. start(0) + boss(last); 4 middle floors
    minWidth: 2,          // min nodes per middle floor
    maxWidth: 3,          // max nodes per middle floor
    eliteFloors: [3] as readonly number[],  // 0-based middle-floor indices forced to 'elite'
    eliteBudgetMult: 1.35,// enemy-budget multiplier on elite nodes
    areas: 3,                   // numero di aree per run
    floorsPerArea: 5,           // piani per area incl. ingresso(0) + boss(last)
    eliteMinFloor: 2,           // l'unico Elite dell'area va in [eliteMinFloor, floorsPerArea-2]
    categoryWeights: { battle: 50, recruit: 28, relic: 22 } as Record<'battle' | 'recruit' | 'relic', number>,
    recruitBiasBoost: 30,       // peso aggiunto a 'recruit' quando la squadra è incompleta
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
  leveling: {
    autoGrowthPct: 0.10,        // yardstick: legacy uniform per-level growth (reference for menacePerLevel)
    growthBudgetPerLevel: 0.40, // total per-level growth budget, distributed per-wizard by growthWeights
                                // (0.40 × an average 0.25 weight = the old uniform +10%/level)
    levelMax: 10,
    expStep: 70,                // exp per salire da L a L+1 = expStep * L
    expBattle: 80,              // exp da un combattimento normale (team-wide)
    expElite: 160,              // exp da un Elite
    expBoss: 120,               // area boss clear → exp per la prossima area (boss finale: irrilevante)
  },
  recruit: {
    offerSize: 3,
  },
  roles: {
    tauntBonus: 1000,       // additive threat that makes a live Tank the focus
    attackerArmorPen: 0.4,  // fraction of target DEF an Attaccante ignores
  },
} as const
