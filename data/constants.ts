import type { Tier, RelicRarity } from '@/types'

/** Shared cap on cumulative stat buff/debuff instances (per unit, per stat). Stat
 *  buffs/debuffs are permanent (never expire — see game/engine/status.ts tickStatuses),
 *  so both places that can compound them must agree on one ceiling:
 *   - the statusId path (data/statuses.ts StatusDef.maxStacks, e.g. atkUp/weaken2/expose1)
 *   - the inline-effect path (game/engine/status.ts applyInlineEffect)
 *  Lives in data/ (not game/engine/) because data/statuses.ts needs it and data/ must not
 *  import from game/engine/ (dependency direction is game/engine → data, never reverse). */
export const MAX_STAT_STACKS = 3

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
    screenSize: 3,
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
  // starts with 4 level-1 wizards (RAISED 2→4, Task 21 — see game/engine/runEngine.ts
  // STARTER_PICKS) growing to 5 across 3 areas, so it needs a much gentler early curve.
  // Enemy budgets below `campaign.baseBudget` (700) make `pickTowardBudget` draft from
  // the weakest roster percentile. These are the ONLY numbers the new-loop balance
  // harness (campaignBalanceB.test.ts) calibrates; the legacy `campaign` block and its
  // test are never touched by new-loop tuning.
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
    // any future change must re-measure campaignBalanceB.
    // RESTORED 2→1→2 (2026-07-03): normal fights had felt trivially easy at 1 enemy ("burro").
    // Raising 1→2 alone dropped winRate 0.1583→0.1333 (BELOW the 0.15 floor) because HP
    // persists across sequential fights and the extra normal-fight damage bled into the
    // elite/boss walls. FIXED by adding a GUARANTEED end-of-area full-recovery heal
    // (runEngine.ts clearAreaAndAdvance) which caps HP bleed at one area: with the heal,
    // winRate = 0.2083 (25/120) at normalEnemyCount=2 — a comfortable ~7-seed margin above
    // the floor (vs the old ~1-seed razor's edge), veleno counter intact (0.300>0.208), full
    // 979-test suite green. Both levers (this + the end-of-area heal) are now floor-sensitive.
    // LOWERED 2→1 (2026-07-04, recruit-rarity re-tune — see categoryWeights above): after
    // capping recruit to <=1/area (was effectively unlimited), the near-optimal bot's team
    // stays at its starting size of 3 for ~75% of runs (a loss-trace showed fight-first
    // greedy play almost never detours to a recruit node), reopening the same
    // action-economy deficit normalEnemyCount=2 was raised to fix back when recruit was
    // abundant. Eased back to 1 as part of the same re-tune that adjusted
    // enemyCountByArea below; see categoryWeights' comment for the full sweep.
    // RAISED 1→3 (2026-07-04, "too easy" hard re-tune — see report at
    // .superpowers/sdd/fix-hard-enemycount-report.md): the previous session's
    // recruit-rarity easing left normalEnemyCount at 1, which made
    // campaignBalanceRestricted (the REAL player game — the meta-layer restricts
    // drafting to a curated ~18-wizard starter pool, so THIS harness measures what
    // the player actually experiences, not the 60-wizard campaignBalanceB pool)
    // trivially easy: 0.3083 winRate, far above the 0.10-0.13 hard target. User
    // directive: enemy COUNT is the preferred lever (the felt problem was being
    // "outnumbered-favorably, 5 vs 3"), not stat/level tweaks.
    // SWEPT (120-seed campaignBalanceRestricted; normalEnemyCount paired with
    // enemyCountByArea below each row):
    //   normalEnemyCount=1, enemyCountByArea=[1,2,4] (baseline)  → restricted 0.3083
    //   normalEnemyCount=2, enemyCountByArea=[2,3,4]             → restricted 0.2833
    //   normalEnemyCount=3, enemyCountByArea=[2,3,4]             → restricted 0.2500
    //   normalEnemyCount=3, enemyCountByArea=[3,4,4]             → restricted 0.1917
    //   normalEnemyCount=3, enemyCountByArea=[4,4,5]             → restricted 0.0667 (BELOW
    //                                                               the 0.07 floor — rejected)
    //   normalEnemyCount=3, enemyCountByArea=[3,4,5] SHIPPED     → restricted 0.1500 (best
    //                                                               landing inside guardrails
    //                                                               (0.07, 0.45), close to the
    //                                                               0.10-0.13 aim)
    // normalEnemyCount is the dominant lever (every normal fight, not just
    // elite/boss, feels the extra body — normal fights are far more frequent),
    // so it moved the needle harder per step than enemyCountByArea alone.
    //
    // SWEPT, BLOCKED — did NOT ship a change (2026-07-21, post-rimozione bonus sinergia):
    // removing the 9 team-synergy bonuses (Task 2) crashed campaignBalanceRestricted from
    // the prior 0.1500 ship value to 0.0083 (1/120) — losing the free synergy power hit the
    // player side much harder than enemies (enemies never drafted synergies either — symmetric
    // removal, asymmetric impact). Re-swept both enemy-count levers (120-seed
    // campaignBalanceRestricted; normalEnemyCount paired with enemyCountByArea below each
    // row), leva dominante first per the brief, this task's stated pin `elites>=2` respected
    // throughout (no enemyCountByArea value < 2):
    //   normalEnemyCount=3, enemyCountByArea=[3,3,5] (prior ship)  → restricted 0.0083
    //   normalEnemyCount=2, enemyCountByArea=[3,3,5]               → restricted 0.0167
    //   normalEnemyCount=2, enemyCountByArea=[2,3,4]               → restricted 0.0333
    //   normalEnemyCount=2, enemyCountByArea=[2,3,3]               → restricted 0.0250 (worse —
    //                                                                 non-monotonic, matches this
    //                                                                 file's older lever history)
    //   normalEnemyCount=1, enemyCountByArea=[2,3,3]               → restricted 0.0333
    //   normalEnemyCount=1, enemyCountByArea=[2,3,4]               → restricted 0.0333 (flat vs
    //                                                                 the row above)
    //   normalEnemyCount=1, enemyCountByArea=[2,2,3]               → restricted 0.0583 (in band,
    //                                                                 but only 1-seed margin: 7/120)
    //   normalEnemyCount=1, enemyCountByArea=[2,2,2]               → restricted 0.0667 (in band,
    //                                                                 8/120, best result found —
    //                                                                 BUT see conflict below)
    // CONFLICT FOUND (blocks shipping any enemyCountByArea value < 3 in ANY area):
    // tests/engine/combat/teamGen.test.ts "elite packs field an active synergy in the
    // overwhelming majority of cases" is a separately locked invariant (user-pinned
    // 2026-07-03, "so a future balance sweep can't silently trim"). Post the same
    // Task-2 TEAM-synergy removal, SYNERGIES now contains only ARCHETYPE synergies —
    // `tossicita` (veleno) and `spietatezza` (esecuzione, revived 2026-07-22), both
    // `requires.count: 3` on a tag (data/synergies.ts). Every TEAM synergy (marauder count:2,
    // da count:4, etc., referenced in that test's own now-stale comment) was deleted. An
    // elite pack below 3 units can therefore NEVER realize a synergy (0% by construction,
    // not RNG variance) — verified: enemyCountByArea=[2,2,2] measures elite synergy rate
    // 0.0% (was 100% at the prior [3,3,5]), hard-failing that test's >=0.95 assertion.
    // battlePackage.ts feeds enemyCountByArea into REAL elite generation with no independent
    // floor, so this isn't a test-only artifact — a live [2,2,2] elite would in fact almost
    // never carry a theme. Every area's elite count must stay >=3 (not >=2) to keep that
    // invariant meaningful, which is STRICTER than this task's stated `elites>=2` pin.
    // Re-tested at the >=3 floor: normalEnemyCount=1, enemyCountByArea=[3,3,3] → restricted
    // 0.0083 — IDENTICAL to the original baseline, i.e. with the synergy-count-3 floor
    // respected, this task's two in-scope levers (normalEnemyCount already at its practical
    // floor of 1; enemyCountByArea floored at 3-everywhere by the other invariant) cannot
    // move the needle AT ALL. BLOCKED per brief Step 3: reverted to the original values
    // (3 / [3,3,5]) rather than ship a no-op change with elevated risk; a different lever
    // (statMult, or relaxing/updating the elite-synergy invariant test) needs a human
    // decision — out of this task's scope.
    // Tier-3 statMult also empirically checked (brief allows it "solo se le prime due non
    // bastano"), both confirmed NOT viable on their own and left UNCHANGED:
    //   campaignB.baseBudget/budgetStep/eliteBudgetMult/bossBudgetMult halved-to-aggressive
    //     (40/10/0.5/0.6 → 20/5/0.3/0.4)         → restricted 0.0083 (INERT — confirms this
    //                                                file's own 2026-07-04 note that budget
    //                                                saturates the roster's weakest slice
    //                                                regardless of target, still true post-
    //                                                synergy-removal)
    //   campaignB normal/elite/boss LevelBase+PerArea driven to the degenerate floor
    //     (2/4/6,perArea2 → 1/1/1,perArea1, ALL areas level-1)  → restricted 0.0333 (moves,
    //                                                but still < 0.05 even at a level-1-
    //                                                everywhere floor, AND breaks the
    //                                                normal<elite<boss / area-N<area-N+1
    //                                                level-ordering invariant other tests pin —
    //                                                rejected on both grounds)
    normalEnemyCount: 3,
    // RAISED 2026-07-03 (USER DECISION, "livelli e quantità elite/boss troppo bassi"):
    // one extra elite in the final area, [2,3,3]→[2,3,4]. Paired with the elite/boss
    // level bump below, this pushes campaignBalanceB's near-optimal-bot winRate to
    // ~0.125 — a deliberate difficulty increase; the test floor was lowered 0.15→0.10
    // to match (see tests/engine/campaignBalanceB.test.ts). Adding a 3rd area-0 elite or
    // a 2nd extra elite drops it further (measured 0.108-0.133) — do NOT stack blindly.
    //
    // RE-TUNED 2026-07-04 (recruit-rarity re-tune, [2,3,4]→[1,2,4]): the team now stays
    // near its area-0 starting size (3) for most of the run (see normalEnemyCount's note
    // above), so area-0's elite trim (2→1) targets pressure relief where the team is
    // weakest, while area-2's elite count is left at 4 (not trimmed) since by then a
    // near-optimal run has usually landed its 1-2 lifetime recruits and the extra
    // pressure is needed to hold the floor without pushing campaignBalanceRestricted
    // too close to the 0.45 ceiling (measured 0.4167 at [1,2,3], 0.3083 at [1,2,4] — the
    // latter has a much safer margin). See categoryWeights' comment for the full sweep
    // table this was measured against.
    // RAISED [1,2,4]→[3,4,5] (2026-07-04, "too easy" hard re-tune, paired with
    // normalEnemyCount 1→3 above): see that constant's comment for the full
    // sweep table this was measured against (120-seed campaignBalanceRestricted).
    // Also crashes campaignBalanceB (the obsolete full-60-wizard-pool harness,
    // no longer representative post-meta-layer) to 0.025 — its floor was
    // re-anchored down accordingly; see that test file's header comment.
    //
    // RAISED [3,4,5]→[3,5,8] (2026-07-04, difficulty pass vs the SPELL-OPTIMIZED bot).
    // The harness bot now equips each wizard's strongest attack spell (commits
    // f065bd7/f063cae) — the real skilled-player proxy — and at [3,4,5] it won a
    // trivial 0.4917. This is the measured difficulty pass that answers that. Area 0
    // is LEFT at 3 (raising it historically crashes the opener — action-economy floor,
    // see the level-lever conclusion below); only area 1 (4→5) and area 2 (5→8) elite
    // counts rise, the "victory lap" areas where a lv10-capped player faced lv4-8 foes.
    // 120-seed campaignBalanceRestricted (spell-optimized bot) sweep:
    //   normalEnemyCount, enemyCountByArea → restricted winRate
    //   3, [3,4,5] (prev)  → 0.4917 (trivial)
    //   4, [3,4,5]         → 0.1750 (normalEnemyCount is coarse: one step ≈ -0.32)
    //   3, [3,5,7]         → 0.3250
    //   3, [3,6,7]         → 0.3083
    //   3, [3,5,8] SHIPPED → 0.2583 (in the 0.25-0.30 target band, leans slightly hard)
    // Elite-count is the fine lever here (~1 fight/area, each unit ≈ -0.055) vs
    // normalEnemyCount's coarse per-normal-fight swing; budget (eliteBudgetMult/
    // baseBudget) was verified INERT in this regime (targetPer saturates the
    // strongest roster slice — raising it moved winRate 0.0000). campaignBalanceB
    // (obsolete full-60 harness) tracks to 0.225 overall; its muro-veleno whole-run
    // ordering assertion was retired (effect collapsed to seed noise post-spell-opt —
    // see that test file). USER PLAYTEST is ground truth; iterate the target lower if
    // it still feels easy (the user outplays the bot by an unknown margin).
    // HARD CAP: no encounter — battle, elite, OR boss — may EVER field more than
    // `maxEnemies` units (USER DIRECTIVE 2026-07-05: "max 5 avversari, ASSOLUTAMENTE").
    // area-2 elite was 8 (part of the earlier "più cattivo" pass); capped to 5 here and
    // structurally clamped at generation (buildBattlePackage + generateBossTeam) so a
    // future retune can never breach it again.
    // area-2 elite trimmed 5→3 (USER DECISION 2026-07-08) so a boss (Bellatrix unitCount 4)
    // is never SMALLER than an elite — a boss should read as the bigger threat, not a scrawnier
    // one. Paired with Bellatrix 3→4; balance re-measured.
    //
    // SWEPT, BLOCKED — value unchanged (2026-07-21, post-rimozione bonus sinergia): see
    // normalEnemyCount's comment above for the full sweep table and the conflict found
    // (any area's elite count < 3 kills tests/engine/combat/teamGen.test.ts's elite-synergy
    // invariant now that only one count:3 synergy remains). Left at the original [3,3,5]
    // rather than ship a no-op-for-balance change with elevated risk.
    enemyCountByArea: [3, 3, 5] as readonly number[],
    maxEnemies: 5,
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
    // STEEPENED 2026-07-03 (USER DECISION, "hard mode"): the player's roster ramps to
    // ~lv8 by area 2 (levelsPerBattle/Elite/Boss below), so the old lv3/4/5 elites read
    // as absurdly weak. Enemy levels now TRACK that ramp: bases 2/4/6, perArea 2 →
    // normal 2/4/6, elite 4/6/8, area-boss 6/8/10 (area-2 elite matches a lv8 team; area
    // bosses reach the cap; final boss already levelMax). This is a large deliberate
    // difficulty increase — near-optimal-bot winRate measured 0.10; the campaignBalanceB
    // floor was lowered to 0.07 to match (see that test's header).
    normalLevelBase: 2, normalLevelPerArea: 2,
    eliteLevelBase: 4, eliteLevelPerArea: 2,
    bossLevelBase: 6, bossLevelPerArea: 2,
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
    // --- Enemy-wizard VARIETY (2026-07-11) ---
    // The budget levers above are vestigial for wizard SELECTION: per-unit budget (~8-15)
    // sits far below budgetWindow's percentile floor (140), so the candidate window collapsed
    // to `sorted.slice(0, count*3)` — the same ~9 weakest wizards every normal/elite fight,
    // identical across all areas (~85% of the 60-wizard roster never appeared). Difficulty is
    // carried by enemy LEVEL (leveledStats), NOT by which wizard is drawn, so these two knobs
    // buy variety at a small, measured base-power cost (see _probeVariety + campaignBalanceB):
    //   varietyWindowSize — ABSOLUTE number of candidate wizards the window spans (was an
    //                       implicit count*3 ≈ 9). Made absolute (not count-scaled) so normal
    //                       (3 units) and elite (5 units) draw an EVEN-size pool at even power,
    //                       instead of elite silently pulling a whole-roster window.
    //   varietyWeightBias — weightedPick exponent: 1=legacy (window's strongest few dominate),
    //                       →0 flattens toward uniform so the wide window actually surfaces its
    //                       members. Lower bias also holds avg power near the roster-weak end.
    // Scoped to normal/elite (themedEnemyTeam); boss/legacy draft keep the tight default window.
    varietyWindowSize: 30,
    varietyWeightBias: 0.5,
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
  // Endless mode (Plan A) — DECOUPLED from campaign/campaignB. Difficulty scales via
  // UNCAPPED enemy level (past leveling.levelMax:10), which drives real per-level stat
  // growth. `levelPerFloor`/`levelPerFloorSq` are the calibration levers (see
  // tests/engine/endlessScaling). Floor-sensitive: any change to endless enemy scaling
  // (or to endless MAP generation — e.g. node-category weights — which changes how much
  // relic/recruit/combat density a run accumulates per floor) must re-run that sweep.
  //
  // RE-CALIBRATED (regression fix, 2026-07-09): shipping a LINEAR-only formula
  // (levelPerFloor=0.1, median=21/p90=63) went immortal (bot survives to the test's
  // 500-floor safety cap on >50% of seeds) once `nodeGen.ts` started excluding
  // shop/spellForge from endless areas — that change redistributes their category
  // weight across battle/recruit/relic/event, which doesn't just densify relics: it
  // widens the variance of how many combats a run packs into N floors, which in turn
  // widens how many WIN-BASED PLAYER LEVELS (leveling.ts: gainLevels, uncapped by user
  // directive) a run banks per floor. A run that gets lucky/skilled enough to clear the
  // area-2 boss cliff (floor 14, Voldemort — see endlessScaling's header) then compounds
  // player levels faster than any constant per-FLOOR enemy slope can track, because
  // enemy level was a function of raw floor count, never of how many fights actually
  // happened. No `levelPerFloor` value threads both needles post-exclusion (verified by
  // an exhaustive sweep from 0.02 to 8.0: every value either lets >50% of seeds go
  // immortal, or crushes the median back down to the SAME floor-14 cliff — the cliff's
  // position is set by Voldemort's fixed stats, independent of slope, so a steep-enough
  // slope to prevent runaway is also steep enough to fail the cliff for most seeds).
  // Fix: add a small quadratic acceleration term (`levelPerFloorSq`) on top of the
  // existing linear slope in `endlessEnemyLevel` (game/engine/combat/threat.ts) — negligible
  // near the floor-14 cliff (preserving the original escape-the-wall dynamics) but it
  // eventually catches any run that escapes and would otherwise compound indefinitely.
  // 60-seed sweep (levelPerFloor held at 0.1, quadratic-only sweep):
  //   levelPerFloorSq=0.000 (unchanged)     -> median=500, p90=500      (immortal >50%)
  //   levelPerFloorSq=0.005                 -> median=19,  p90=174      (tail still long)
  //   levelPerFloorSq=0.008                 -> median=19,  p90=129
  //   levelPerFloorSq=0.010                 -> median=19,  p90=99, max=124  (passes, healthy margin)
  //   levelPerFloorSq=0.011                 -> median=14   (cliff — same sharp threshold
  //                                             character as the original levelPerFloor sweep)
  // SHIPPED: levelPerFloorSq=0.010 — median=19/p90=99/max=124 across 60 seeds, no seed
  // anywhere near the safety cap even at 20000 floors (spot-checked), comfortable margin
  // from the 0.011 cliff (not a fragile 1-seed boundary).
  endless: {
    normalLevelBase: 2,   // enemy level at floor 0 (matches campaignB area-0 normal)
    levelPerFloor: 0.1,
    levelPerFloorSq: 0.010, // quadratic catch-up term — see re-calibration note above
    // Exponential ramp AFTER the third area (user directive 2026-07-21: "dopo la terza
    // area devono diventare esponenzialmente più forti"). The multiplier is 1 up to
    // expStartFloor (= 3 areas × floorsPerArea:5), so the calibrated early-game curve —
    // including the floor-14 Voldemort-cliff dynamics the sweeps above protect — is
    // byte-identical; past it the whole polynomial level is scaled by
    // levelExpGrowth^(floor − expStartFloor). At 1.05: floor 20 → ×1.28, floor 30 →
    // ×2.08, floor 40 → ×3.39, floor 50 → ×5.52 — closes the mid-game sag where
    // uncapped win-based player leveling (~1.6 lv/floor) outran the ~0.5 lv/floor
    // polynomial slope for entire areas.
    expStartFloor: 15,
    levelExpGrowth: 1.05,
    pointsPerFloor: 100,  // score base unit (see endlessScore.ts, Task 5)
  },
  // Task 21 (2026-07-02, final calibration): USER DECISION set the final boss
  // (Voldemort/BOSSES[0]) unitCount 2→3 (felt too scrawny at 2), which is a genuine
  // difficulty INCREASE — campaignBalanceB dropped from 0.1583 to 0.0833, then to 0.0500
  // once Voldemort=3 was applied on top. Menace stays removed (not reintroduced) per prior
  // decree. Swept the starting-roster-size lever (game/engine/runEngine.ts STARTER_PICKS,
  // plus every balance-harness test's hardcoded starter-pick count, which must mirror it):
  //   STARTER_PICKS=2 (baseline, Voldemort=3)                → 0.0500
  //   STARTER_PICKS=3 (+ enemyCountByArea[0] 2→1)             → 0.0667 (no gain — area0-elite
  //                                                              is not the bottleneck once
  //                                                              Voldemort=3 dominates)
  //   STARTER_PICKS=3 (+ Bellatrix unitCount 3→2)             → 0.1000 (progress, still short)
  //   STARTER_PICKS=3 (+ Bellatrix unitCount 3→2 + Muro 3→2)  → 0.0833 (worse — non-monotonic,
  //                                                              trimming Muro further hurt)
  //   STARTER_PICKS=3 (+ Bellatrix hpMult 0.85→0.7, unitCount 2) → 0.1000 (flat plateau)
  //   STARTER_PICKS=4 (Muro/Bellatrix back to their calibrated 3/3, 0.85)  → 0.2083 (PASSES;
  //                                                              robust plateau — perturbing
  //                                                              Bellatrix hpMult or Muro's
  //                                                              unitDamageReduction at
  //                                                              STARTER_PICKS=4 did not move
  //                                                              the number, confirming the
  //                                                              bottleneck moved away from
  //                                                              area-0/1 entirely)
  // SHIPPED: STARTER_PICKS 2→4 (game/engine/runEngine.ts), Voldemort unitCount 2→3
  // (data/bosses.ts), Muro/Bellatrix left UNCHANGED at their prior calibration (budget 250/
  // hpMult 0.5/unitCount 3 and budget 300/hpMult 0.85/unitCount 3 respectively).
  // campaignBalanceB=0.2083 (25/120) — inside (0.15, 0.45), on the higher side of the
  // requested 0.15-0.18 sweet spot but the sweep shows no clean intermediate lever
  // (STARTER_PICKS=3 combos plateaued at 0.0667-0.1000 regardless of Muro/Bellatrix
  // trims — the roster-size lever moves in a coarse, non-linear way here because it's a
  // structural action-economy fix, not a smooth stat dial). Accepted as the best
  // available value that clears the floor without exceeding the 0.22 overshoot ceiling.
  // esecuzioneSweep 0.292, scudiRigenSweep 0.608, velenoSweep 0.467 (all >> 0.05 floor;
  // scudiRigenSweep's OWN starter-pick slice also had to be raised 2→4 in lockstep — it was
  // failing at exactly 0.050 with the old slice count). Muro veleno-teaches-the-wall holds:
  // withVeleno 0.217 > noVeleno 0.208 > 0. Every balance-harness test file that hardcodes a
  // starter-pick slice count (campaignBalanceB, levelingSnowball, scudiRigenSweep) was raised
  // to 4 to mirror the real STARTER_PICKS change; esecuzione/veleno/magieOscure/serpeverde
  // sweeps were left at their existing slice(0,2) since they already passed comfortably and
  // are diagnostic/floor-only (not gated on roster size). STARTER_PICKS is now a
  // floor-sensitive lever: any future change must re-measure campaignBalanceB.
  //
  // Task 25 (2026-07-02, SUPERSEDES Task 21 above): USER DECISION reverted STARTER_PICKS
  // 4→3 ("MAI 4, 3 maghi voglio"). Every balance-harness test's hardcoded starter-pick
  // slice count was lowered 4→3 in lockstep (avgPolicyProbe, campaignBalanceB,
  // levelingSnowball, runEngine.test, scudiRigenSweep). This reopened the exact area-2-boss
  // (Voldemort) action-economy deficit Task 21 had fixed via the roster raise — measured
  // campaignBalanceB crashed back to 0.1000 (12/120), loss trace: area2-boss 39-42/120,
  // area0-boss 29/120 dominant. Voldemort unitCount=3 and STARTER_PICKS=3 are BOTH hard
  // user pins (cannot move). Re-swept every other lever (120-seed campaignBalanceB):
  //   baseline (Bellatrix unitCount=2, everything else as Task 21 shipped) → 0.1000
  //   Muro unitCount 3→2                                          → 0.0833 (worse — same
  //                                                                  non-monotonic pattern
  //                                                                  as Task 21's sweep)
  //   enemyCountByArea [2,3,3]→[2,2,3]                             → 0.0917 (worse)
  //   Bellatrix hpMult 0.85→0.6 (unitCount already 2)              → 0.1000 (flat plateau —
  //                                                                  Bellatrix/area-1 is not
  //                                                                  the live bottleneck once
  //                                                                  Voldemort=3 dominates)
  //   Muro budget 250→150, hpMult 0.5→0.35                        → 0.1000 (flat plateau —
  //                                                                  same conclusion, area-0
  //                                                                  is not the live bottleneck)
  //   Voldemort budget 1800→900, hpMult 1.4→1.0 (unitCount stays 3, PINNED) → 0.2833
  //                                                                  (overshoots the 0.22
  //                                                                  ceiling)
  //   Voldemort budget 1800→1300, hpMult 1.4→1.2                  → 0.1000 (sharp cliff back
  //                                                                  to floor — this lever is
  //                                                                  a threshold, not a smooth
  //                                                                  dial, matching every other
  //                                                                  floor-adjacent lever in
  //                                                                  this file's history)
  //   Voldemort budget 1800→1100, hpMult 1.4→1.1                  → 0.1500 (fails strict >,
  //                                                                  exact boundary)
  //   Voldemort budget 1800→1080, hpMult 1.4→1.09  SHIPPED         → 0.1583 (19/120, headroom
  //                                                                  0.0083 — the same 1-seed
  //                                                                  margin pattern as every
  //                                                                  other floor-adjacent lever
  //                                                                  in this file)
  // CONCLUSION: with both STARTER_PICKS=3 and Voldemort unitCount=3 pinned, area-0/area-1
  // scripted-boss and enemyCountByArea levers are all flat/non-monotonic (area-2-boss is the
  // dominant loss location, not area-0/1) — the only lever that moved the floor was
  // Voldemort's OWN budget/hpMult (data/bosses.ts), left untouched by every prior task
  // because unitCount was assumed to be the only lever worth pulling on a scripted boss.
  // SHIPPED: Voldemort (BOSSES[0]) budget 1800→1080, hpMult 1.4→1.09 (data/bosses.ts);
  // unitCount stays 3 (user pin, untouched). Muro and Bellatrix left at their Task 21/18d
  // values (Muro budget 250/hpMult 0.5/unitCount 3; Bellatrix budget 300/hpMult 0.85/
  // unitCount 2 — Bellatrix's unitCount 3→2 trim from the STARTER_PICKS=3 exploration
  // earlier in this task carries forward since reverting it to 3 was never re-tested
  // against the final Voldemort tune and the shipped config already clears the floor).
  // Final winRates (120 seeds): campaignBalanceB overall 0.1583 (19/120), withVeleno 0.217 >
  // noVeleno 0.158 > 0 (Muro veleno-teaches-the-wall holds), esecuzioneSweep/scudiRigenSweep/
  // velenoSweep/scudiRigenCounters all pass comfortably. Voldemort's budget/hpMult are now
  // ALSO floor-sensitive levers (in addition to unitCount and every lever listed above): any
  // future change must re-measure campaignBalanceB (headroom ≈ 0.0083, 1 seed).
  map: {
    floors: 6,            // total floors incl. start(0) + boss(last); 4 middle floors
    // (minWidth/maxWidth removed 2026-07-02: dead — game/engine/map.ts hardcodes floor
    // widths directly, 1 for entry/boss floors and 3 for middle floors; nothing read these.)
    eliteFloors: [3] as readonly number[],  // 0-based middle-floor indices forced to 'elite'
    eliteBudgetMult: 1.35,// enemy-budget multiplier on elite nodes
    areas: 3,                   // numero di aree per run
    floorsPerArea: 5,           // piani per area incl. ingresso(0) + boss(last)
    eliteMinFloor: 2,           // l'unico Elite dell'area va in [eliteMinFloor, floorsPerArea-2]
    // SLASHED 2026-07-04 (USER DIRECTIVE, "recruit nodes must be RARE — at most 1 per
    // area, some areas ZERO; the game must be hard, more losses (esp. early) accepted").
    // Paired with the nodeGen.ts change that DROPPED the guaranteed->=1-recruit-per-area
    // rule and added a hard per-area cap of exactly 1 recruit (any filler roll beyond the
    // cap downgrades to 'battle'), the OLD weights (28/30) used to yield an average of
    // 3.19 recruit nodes PER AREA (measured — the old code had no cap, so the dominant
    // recruit weight just kept re-rolling more copies) — this IS the bug the user
    // reported ("always field 5 vs 3"). At the new cap, recruit dropped to ~0.5-1/area.
    //
    // ROOT CAUSE FOUND DURING RE-TUNE: cutting recruit's weight without ALSO cutting
    // 'battle' redistributes the freed probability mass mostly into 'battle' (since it
    // was already the largest weight), which SILENTLY DOUBLED the average mandatory
    // battle-filler count per area (measured: old ≈1.96 filler battles/area → new ≈3.7-5.0
    // depending on recruit weight). A loss-location trace (120 seeds, near-optimal bot)
    // confirmed the real bottleneck was NOT recruit frequency itself — pushing recruit
    // odds to near-certain (recruit=2/boost=20) still measured 0.05 flat, because the
    // near-optimal test policy is fight-first-greedy: it only ever visits recruit/relic
    // when NO battle/elite is reachable at that step, so recruit uptake is structurally
    // suppressed by battle density, independent of recruit's own weight. The trace showed
    // 76% of runs recruited ZERO times all run (vs the ~50-55%/area raw-generation odds
    // would suggest), and losses concentrated overwhelmingly at area0-boss (Il Muro) with
    // the team stuck at its starting size of 3.
    // FIX: rebalance battle DOWN and relic UP (not just cut recruit) so the freed weight
    // from a rare recruit goes to relic (permanent power, no extra fight) instead of
    // inflating mandatory combat count, then re-open the enemy-count lever (below) to
    // compensate for the team staying near its starting size most of the run.
    // categoryWeights sweep (120-seed campaignBalanceB / campaignBalanceRestricted,
    // enemyCountByArea/normalEnemyCount held at their SHIPPED post-cut values unless noted):
    //   battle=50 recruit=28 boost=30 (old weights, NEW cap code) → 0.0083 / — (avgBattle/area
    //                                   jumped 1.96→4.99; recruit stayed ~1/area despite P=98%)
    //   battle=50 recruit=6  boost=3                                → 0.0250 / 0.1833
    //   battle=35 recruit=6  boost=3  relic=35 (first relic-up attempt) → 0.0500 / 0.2167
    //   battle=25 recruit=10 boost=10 relic=50, enemyCountByArea=[2,3,4] normal=2 (baseline
    //                                   enemy pressure, pre-cut) → 0.0417 (recruit uptake
    //                                   still suppressed by fight-first greedy)
    //   SAME weights + enemyCountByArea=[1,2,3] + normalEnemyCount=1 (re-opened the
    //                                   enemy-count lever to compensate for the
    //                                   team-stuck-at-3 reality)     → 0.1250 / 0.4167 (both
    //                                   pass, restricted uncomfortably close to the 0.45 ceiling)
    //   SAME + enemyCountByArea=[1,2,4] (put the trimmed area-0 slot's slack back onto
    //                                   area 2 instead of area 0, since area-0 is where
    //                                   the team is smallest/weakest)  → 0.1000 / 0.3083
    //                                   SHIPPED — both comfortably inside (0.07,0.45),
    //                                   full-pool centered in the requested 0.08-0.13 band.
    // budget (eliteBudgetMult/bossBudgetMult) and enemy LEVEL sweeps were also tried during
    // this re-tune and, consistent with this file's older history, PLATEAUED (no measurable
    // effect once already low) — not the live lever here. Il Muro's own budget/hpMult
    // (data/bosses.ts) was also softened 250/0.5→150/0.35 during the search; also flat, but
    // left at the softer value (harmless, consistent direction).
    // Onda 1.e (2026-07-25): spellForge/spellSwap/shop rimossi dal gioco — erano il 27% del
    // peso filler (36 su 131) e tre menù nati per rimpiazzare il loadout tolto. I punti NON
    // sono stati redistribuiti: le proporzioni fra i quattro filler superstiti sono identiche
    // a prima, così la misura dice davvero quanto costa toglierli.
    categoryWeights: { battle: 25, recruit: 10, relic: 45, event: 15 } as Record<'battle' | 'recruit' | 'relic' | 'event', number>,
    recruitBiasBoost: 10,        // peso aggiunto a 'recruit' quando la squadra è incompleta
  },
  relics: {
    offerCount: 3,
    jokerNodeChance: 0.35,
    maxRelics: 5, // cap reliquie del giocatore (swap/scarto su tutte le fonti)
    rarityWeights: {
      'comune': 50,
      'non-comune': 28,
      'rara': 16,
      'epica': 6,
    } as Record<RelicRarity, number>,
  },
  shop: {
    relicByRarity: { 'comune': 25, 'non-comune': 45, 'rara': 75, 'epica': 120 } as Record<import('@/types').Relic['rarity'], number>,
    heal: 35,
    removeWizard: 20,
    reroll: 15,
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
    tenaciaControlDurationMult: 0.5,   // Supporto aura: incoming hard-control duration ×this
    // Halved 0.4→0.2 (2026-07-02, role-identity pass): Attaccante's flat armor pen was
    // too dominant even against Tanks; halving keeps the identity (ignores some DEF)
    // without letting it trivialize the highest-DEF role.
    attackerArmorPen: 0.2,  // fraction of target DEF an Attaccante ignores
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
