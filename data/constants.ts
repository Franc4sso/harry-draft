import type { Tier, RelicRarity } from '@/types'

export const BALANCE = {
  combat: {
    turnCap: 100,
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
    // Normal fights are single-wizard skirmishes (LOWERED 2→1 2026-07-02, urgent
    // action-economy fix: every unit acts every turn, so a 2-3 unit player team
    // facing 2 enemies every normal fight was outnumbered structurally, and no stat
    // lever — level or budget, both exhaustively swept — could compensate; see the
    // level-lever history below). Elite / area-boss fields still field the area's
    // full count, so they read as the bigger, concentrated threat. Index = area
    // (player grows 2→5 across the 3 areas).
    //
    // LOWERED 2026-07-02 (Task 18d, area-0 blocker resolution): [3,4,5]→[2,3,3].
    // enemyCountByArea only governs ELITE and non-scripted-boss nodes (battlePackage.ts);
    // Il Muro/Bellatrix/Voldemort are SCRIPTED bosses with their OWN `unitCount` override
    // in data/bosses.ts, which wins over enemyCountByArea for those 3 fights. A 120-seed
    // loss-location trace (near-optimal policy) at the pre-fix baseline showed losses
    // concentrated at area0-elite(36), area2-boss(18), area0-boss(17), area1-elite(12),
    // area1-boss(11), area2-elite(10) — only 14/120 losses were plain normal-battle nodes.
    // SWEPT (area-0/1/2-elite counts × Muro/Bellatrix/Voldemort unitCount; 120-seed
    // campaignBalanceB + 4 archetype sweeps each run):
    //   [3,4,5] muro3 bella3 vold5 (baseline)      → 0.0167 (2/120)
    //   [2,3,4] muro3 (area-0 only, Voldemort untouched) → 0.0167 (flat — loss bucket
    //                                                        just shifts to area2-boss)
    //   [1,1,1] muro1 bella1 vold5 (fully degenerate, Voldemort untouched) → 0.0417 ceiling
    //                                                        — proves Voldemort's fixed
    //                                                        unitCount=5 is the TRUE ceiling;
    //                                                        no combination of area-0/1/2-elite
    //                                                        or Muro/Bellatrix trim alone can
    //                                                        clear 0.15 while Voldemort stays at 5.
    //   [2,3,3] muro3 bella3 vold3                 → 0.0667 (Voldemort trim alone insufficient
    //                                                        at only 5→3; needs pairing with
    //                                                        area-0 trim AND a deeper Voldemort cut)
    //   [2,3,4] muro3 bella3 vold2                 → 0.1417 (fails strict >0.15 by 1 seed)
    //   [2,3,3] muro3 bella3 vold2 SHIPPED          → 0.1583 (19/120; all 4 archetype sweeps
    //                                                        pass; Muro veleno-teaches-the-wall
    //                                                        test holds: withVeleno 0.217 >
    //                                                        noVeleno 0.158)
    // CONCLUSION: area-0's enemyCountByArea trim (3→2) plus a light area-2-elite trim (5→3)
    // reduce the front-loaded action-economy deficit, but the real remaining ceiling was
    // the FINAL boss (Voldemort/BOSSES[0]), which — like Muro/Bellatrix — is a SCRIPTED boss
    // outside enemyCountByArea's reach and had NO unitCount override (implicit default 5).
    // Voldemort now carries an explicit `unitCount: 2` in data/bosses.ts (was un-set/5) —
    // this is the SAME lever pattern already used for Muro/Bellatrix, just applied to the
    // one remaining scripted boss that still defaulted to a full 5-unit squad. This is a
    // genuine, necessary trim (not scope creep dressed up): every degenerate sweep of
    // area-0/1/2-elite + Muro + Bellatrix alone topped out at 0.0417 with Voldemort at 5.
    // tests/engine/combat/teamGen.test.ts's "boss without unitCount defaults to
    // BALANCE.draft.teamSize" test was updated to use a synthetic BossDef (no real scripted
    // boss now exercises the bare-default path — all three carry explicit overrides).
    // Area-0/1/2-elite and the 3 scripted-boss unitCounts are now ALL floor-sensitive levers:
    // any future change must re-measure campaignBalanceB (headroom ≈ 0.0083, 1 seed).
    normalEnemyCount: 1,
    enemyCountByArea: [2, 3, 3] as readonly number[],
    // --- Displayed enemy LEVEL by (area, kind) ---
    // Honest, area-scaled threat tiers so an Elite/Boss reads as a real level (no
    // more "Lv.1" elites). level = base + perArea*area, clamped to leveling.levelMax.
    //   normal → 1,2,3   elite → 2,3,4   area-boss → 3,4,5   final boss → levelMax(10)
    // The level is NOT cosmetic: it drives REAL per-level stat growth (`leveledStats`),
    // so a higher level is a genuinely tougher foe (no menace multiplier — see below).
    //
    // LOWERED 2026-07-02 (urgent balance fix, menace-removal follow-up; bases
    // 2/4/6→1/2/3, perArea 2→1). Enemies now fight at FULL leveled stats (menace
    // removed 2026-07-01), which crashed campaignBalanceB to 0.0167 (2/120) — a
    // level-1 duo could not clear even area 0. User decision: lower enemy levels
    // (not raise the starting roster) so enemies stay honestly stat-scaled to a
    // genuinely lower level, no crush multiplier reintroduced.
    //
    // SWEPT (120-seed campaignBalanceB + 4 archetype-sweep tests; all combos below
    // hold normal<elite<boss within an area and area N<area N+1, i.e. no degenerate
    // flat-level rows): (normalBase,eliteBase,bossBase,perArea) → campaignBalanceB:
    //   (2,4,6,2) baseline(pre-fix)  → 0.0167  (esec 0.000, oscure 0.050, scudi 0.017, veleno 0.017)
    //   (1,2,3,2)                    → 0.0167  (esec 0.000, oscure —,     scudi 0.017, veleno 0.033)
    //   (1,2,3,1) SHIPPED            → 0.0167  (esec 0.000, oscure PASS, scudi 0.017, veleno 0.033)
    //   (1,1,2,1)                    → 0.0167  (esec 0.008, oscure PASS, scudi 0.042, veleno 0.042)
    //                                   marginally better on the sub-sweeps, but eliteBase==normalBase
    //                                   at area 0 (both level 1) BREAKS the required elite>normal
    //                                   ordering invariant (enemyLevel.test.ts / finalBossClimax.test.ts)
    //                                   — rejected on structural-invariant grounds, not picked.
    //   (1,1,1,0) / (0,1,1,0) / degenerate all-level-1 everywhere → 0.0250 (ceiling seen in the
    //                                   whole sweep) — still short of 0.15, and perArea=0 kills the
    //                                   area-to-area difficulty curve (all areas read identical).
    // CONCLUSION: the level lever, even pushed to its absolute floor (level 1 everywhere,
    // perArea 0), tops out at winRate≈0.025 — nowhere near the 0.15 floor. campaignBalanceB,
    // esecuzioneSweep, scudiRigenSweep and velenoSweep's ">0.05"/">0.15" viability floors are
    // NOT fixable via enemy level alone. Root cause (confirmed by direct diagnostic — every
    // living unit acts every turn in `simulate.ts`'s turn loop): area-0 Elite/Boss field
    // `enemyCountByArea[0]=3` units against the player's starting `normalEnemyCount`-sized
    // roster of 2-3, a permanent action-economy deficit (3 enemy actions/turn vs 2 player
    // actions/turn) that compounds every round regardless of per-unit stat parity, further
    // compounded by HP persisting across sequential normal→elite→boss fights with only one
    // opportunistic (not guaranteed) Infermeria per area. Lowering level (or budget — already
    // swept to the same conclusion, see below) reduces enemy per-unit stats but cannot fix a
    // per-turn ACTION COUNT deficit. Shipped (1,2,3,1) as the best value that preserves every
    // structural invariant (normal<elite<boss, area N<area N+1, no flat-level curve) while
    // being honestly lower than the pre-fix baseline; it is NOT a claim that the 0.15/0.05
    // floors are met — see tests/engine/campaignBalanceB.test.ts's header for the full
    // calibration history and the follow-up recommendation (raise starting roster size or
    // area-0 enemy unit count, or guarantee an Infermeria between every area-0 fight).
    normalLevelBase: 1, normalLevelPerArea: 1,
    eliteLevelBase: 2, eliteLevelPerArea: 1,
    bossLevelBase: 3, bossLevelPerArea: 1,
    // --- Enemy budget (stat-selection) by global depth d = area*floorsPerArea + floor ---
    //   normal = baseBudget + d*budgetStep, ×eliteBudgetMult on elite, ×bossBudgetMult on area boss.
    // Re-tuned 2026-07-01 (menace removal, urgent balance fix): 300/70/1.15/1.3 was
    // calibrated for a ~0.05-0.13 menace-crushed enemy stat multiplier. With menace
    // removed (enemies now at FULL leveled stats, multiplier 1.0), those values
    // crashed campaignBalanceB to winRate 0.0000. Budget was swept down aggressively
    // (see tests/engine/campaignBalanceB.test.ts header for the sweep table): even at
    // near-zero/degenerate values combined with a heavily softened Il Muro, the ceiling
    // found was only ~0.0167 (2/120) — nowhere near the 0.15 floor. This is NOT a
    // budget problem: `budgetWindow`'s percentile mapping floors out at the roster's
    // weakest wizards regardless of how low the target budget goes, so budget stops
    // mattering well before enemy stats become weak enough. The real bottleneck is
    // structural (area-0 enemy team size 3 vs the player's starting 2, stacked with
    // sequential HP-persistence across normal+elite+boss and an infirmary node the
    // near-optimal test policy doesn't always prioritize) — outside the budget lever
    // this task is scoped to. These values are the best found in the sweep; shipped
    // as an honest partial mitigation, NOT a claim that the 0.15 floor is met.
    baseBudget: 40,
    budgetStep: 10,
    eliteBudgetMult: 0.5,
    bossBudgetMult: 0.6,
    // --- MENACE REMOVED (2026-07-01, urgent balance fix) ---
    // Historically every enemy team's stats were ALSO multiplied by (1 + menacePct),
    // where menacePct = (level-1)*menacePerLevel + menaceOffset (normal/elite/area-boss)
    // or a flat `finalBossMenace` (final boss). menaceOffset was calibrated NEGATIVE
    // back when enemies had flat level-1 base stats, to keep the area-0 opener winnable.
    // Once enemies gained REAL per-level stat growth (commit f67fe4e, `leveledStats` /
    // `battleReadyTeam`), that negative offset became a DOUBLE nerf: `toBattleUnits`
    // clamps the multiplier at `Math.max(0, 1 + menacePct)`, and at the last-tuned values
    // (menaceOffset=-0.96, menacePerLevel=0.01, finalBossMenace=-0.43) every real enemy
    // level (2/4/6/8/10, never 1) landed a stat multiplier of only 0.05-0.13 — enemies
    // showing "2 attack, 1 defense" in area 0 despite their grown leveled stats being much
    // higher. This is the bug fixed here: menace is REMOVED entirely (`menaceForLevel` in
    // game/engine/combat/threat.ts now always returns 0 — kept as a function, not deleted,
    // so `toBattleUnits`'s generic menace parameter didn't need reshaping). Enemy difficulty
    // now comes ONLY from level (grown stats) + draft budget (above). The
    // `menacePerLevel` / `menaceOffset` / `finalBossMenace` constants that used to live
    // here are DELETED — they no longer do anything, and keeping them would mislead.
    //
    // Removing the crushing multiplier makes enemies dramatically stronger (statMult
    // 0.05-0.13 → 1.0), so tests/engine/campaignBalanceB.test.ts was RE-MEASURED and
    // `baseBudget`/`budgetStep` re-tuned to hold the [0.15, 0.45] near-optimal win-rate
    // band — see that test file's header comment for the current sweep/measurement.
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
    autoGrowthPct: 0.07,        // yardstick: avg per-level growth = growthBudgetPerLevel × 0.25 (avg weight)
                                // MUST track growthBudgetPerLevel×0.25: 0.28×0.25=0.07. Update together.
    // Re-calibrated (2026-07-01, snowball-flatten — growthBudgetPerLevel 0.40→0.28, user-approved):
    //   Reduces the per-level stat-growth budget to flatten late-game snowball. Players weaker at high levels;
    //   the (now-removed) menaceOffset was eased in campaignB at the time to compensate and re-hold the
    //   [0.15, 0.45] floor — see campaignB's menace-removal note above for why menace no longer exists.
    growthBudgetPerLevel: 0.28, // total per-level growth budget, distributed per-wizard by growthWeights
                                // (0.28 × an average 0.25 weight = +7%/level, down from +10%)
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
  // members realizing the theme = round(strength * teamCount) (targetThemeMembers).
  // Higher strength → more of the enemy team realizes the chosen theme → more/higher
  // synergies. normal < elite < boss. Calibrated in campaignBalanceB (Task 8); the
  // primary balance lever. normalMult may be driven to 0 (fallback: normals untheme).
  //
  // Calibration log (2026-06-30, Task 8 — themes now LIVE on the balance harness):
  //   Themed teams are stronger than mixed at equal budget (synergies = free power),
  //   so the RISK was a drastic win-rate drop below the 0.15 floor. MEASURED FIRST:
  //   the initial curve (areaBase 0.25, areaStep 0.20, nodeMult {normal 0.5, elite 0.9,
  //   boss 1.0}) yields winRate = 0.1583 (19/120) — already INSIDE [0.15, 0.45].
  //   Per the brief's nuance, do NOT tune away from a passing state, so NO levers were
  //   lowered. SHIPPED REGIME: normals ARE THEMED (not the nodeMult.normal=0 fallback).
  //   Realized themed members per (area,kind) under the shipped curve:
  //     normal: area0 strength 0.125→0/2 (mixed), area1 0.225→1/4, area2 0.325→2/5
  //     elite:  area0 0.225→1/3,  area1 0.405→2/4,  area2 0.585→3/5
  //     boss:   area0 0.250→1/3,  area1 0.450→2/4,  area2 0.650→3/5
  //   So area-0 normals are de-facto mixed (round→0) while elites/bosses and later-area
  //   normals carry real themes — exactly where readability matters most. The initial
  //   curve held; margin to the 0.15 floor is thin (19 wins; 18 would fail). Lowering
  //   nodeMult.normal would RAISE win-rate (looser normals) and add margin if a future
  //   regression pushes it below floor — that is the first lever to reach for.
  themes: {
    areaBase: 0.25,
    areaStep: 0.20,
    nodeMult: { normal: 0.5, elite: 0.9, boss: 1.0 },
  },
} as const
