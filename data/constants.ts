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
    // ignoring def/shields/heals so defensive stalemates always converge ~turn 25
    // instead of grinding to turnCap. Normal fights end long before fatigueStart.
    // Lowered 30→18 (2026-06-30): campaign median was 11 turns but p75=33/p90=36 due
    // to a fat tail of stall battles converging via fatigue at ~35-39 turns. At 18 the
    // tail collapses (p90 ≈ 18-20), mean/median land ~12-13 (target ≈ 15) and the
    // heavy sweep/UI tests no longer time out under full-suite parallel load.
    fatigueStart: 18,
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
    //   normal → 2,4,6   elite → 4,6,8   area-boss → 6,8,10   final boss → levelMax(10)
    // The level is NOT cosmetic: enemy menace is DERIVED from it (below), so a higher
    // level is a genuinely tougher foe. Scaled up to match win-based player levelling
    // (elite +2 / boss +3 a clear) — elites and bosses must hit harder than before.
    normalLevelBase: 2, normalLevelPerArea: 2,
    eliteLevelBase: 4, eliteLevelPerArea: 2,
    bossLevelBase: 6, bossLevelPerArea: 2,
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
    // near-optimal win-rate must stay in [0.15, 0.45] — "much harder" target).
    //
    // Win-based levelling makes the roster scale fast, so the per-level menace slope is
    // STEEP (enemies must keep pace as their level climbs) while the offset stays deeply
    // negative to keep the low-level area-0 opener winnable for a starting duo.
    // Calibrated on the 120-seed harness → winRate 0.167 (20/120 wins, menaceOffset -0.70):
    //   lv2-normal statMult 0.42 (was 0.07), lv10-boss statMult 1.38 (was 1.03).
    //   area-0 opener is the main wall; elites/bosses hit at level-coherent strength.
    // Re-calibrated (2026-06-30): menaceOffset eased -0.70→-0.75 to compensate for the live
    //   Infermeria consuming one combat floor per area (net power loss without the offset nudge).
    menacePerLevel: 0.12,
    menaceOffset: -0.75,
    // The FINAL area boss is the scripted Voldemort (BOSSES[0], fixed budget); its
    // menace is this flat value (independent of the level curve) so it stays the climax.
    // -0.31 → statMult 0.69 (was -0.45 → 0.55 before the Infermeria was on the live path).
    // The guaranteed pre-boss Infermeria node now generates via generateArea (live path) and
    // fully heals + revives the team before every boss.
    // Re-calibrated (2026-06-30, post C1 fix — Infermeria now on live path, menaceOffset -0.70→-0.75):
    //   The live Infermeria removes one combat floor per area (floor last-1 becomes infirmary
    //   instead of battle/elite/recruit/relic), which tightens the win-rate ceiling. Slightly
    //   easing menaceOffset (-0.70→-0.75) compensates for the lost advancement floor.
    //   winRate scan with menaceOffset=-0.75: -0.30 → 0.142, -0.31 → ~0.158, -0.32 → in band.
    //   Raising toward area-2 boss (statMult 1.38 → finalBossMenace +0.38) remains out of reach:
    //   at +0.38 → 0.092, +0.20 → 0.125, 0.00 → 0.133, -0.20 → 0.133, -0.28 → 0.133.
    //   -0.31 is the highest value that keeps winRate strictly above 0.15.
    // Re-calibrated (2026-06-30, floor-1=3 map change — first floor forced to 3 nodes for "first choice among 3"):
    //   The floor-1 width=3 structural change lowers average win-rate by ~1-2 pp; -0.31 now yields 0.142
    //   (below the [0.15, 0.45] band floor). Easing finalBossMenace -0.31→-0.40 (statMult 0.60, was 0.69)
    //   compensates: -0.36 → 0.158 (too close to edge), -0.40 → 0.167 (20/120, comfortable).
    //   Accepted trade-off: Voldemort statMult 0.60 < area-2 boss 1.38; real climax awaits
    //   a player-power buff — Slice 3.
    finalBossMenace: -0.40,
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
    expStep: 70,                // exp curve step (cumulative); kept for exp/level coherence
    // Win-based progression: clearing a fight grants WHOLE levels to the survivors
    // directly (no exp grind). Elites/bosses are the fast track, so the roster ramps
    // hard — enemy levels (campaignB) are scaled up to match.
    levelsPerBattle: 1,         // normal fight → +1 level
    levelsPerElite: 2,          // elite fight → +2 levels
    levelsPerBoss: 3,           // area boss clear → +3 levels
  },
  recruit: {
    offerSize: 3,
  },
  roles: {
    tauntBonus: 1000,       // additive threat that makes a live Tank the focus
    attackerArmorPen: 0.4,  // fraction of target DEF an Attaccante ignores
  },
  // Themed-battle synergy intensity. themeStrength(area,kind) =
  //   clamp01(areaBase + area*areaStep) * nodeMult[kind].
  // Higher strength → more of the enemy team realizes the chosen theme → more/higher
  // synergies. normal < elite < boss. Calibrated in campaignBalanceB (Task 8); the
  // primary balance lever. normalMult may be driven to 0 (fallback: normals untheme).
  themes: {
    areaBase: 0.25,
    areaStep: 0.20,
    nodeMult: { normal: 0.5, elite: 0.9, boss: 1.0 },
  },
} as const
