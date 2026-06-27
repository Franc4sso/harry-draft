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
    // Enemy team SIZE per area (index = area). The player starts with 2 and grows to
    // 5, so early areas field fewer foes; the roster fills out to 5 by the final area.
    // Area bosses use the area's count; the final boss is always full (5).
    enemyCountByArea: [3, 4, 5] as readonly number[],
    // Enemy budget by global depth d = area*floorsPerArea + floor (0..14):
    //   normal = baseBudget + d*budgetStep, ×eliteBudgetMult on elite, ×bossBudgetMult on area boss.
    // Budget below campaign.baseBudget already floors enemies at the weakest roster
    // percentile, so the EARLY curve is driven by `menace` (which can go negative).
    baseBudget: 300,
    budgetStep: 70,
    eliteBudgetMult: 1.15,
    bossBudgetMult: 1.3,
    // Menace = stat multiplier (1+pct) = menaceBase + menacePerDepth*d, scaled on elite/boss.
    // menaceBase is NEGATIVE so area-0 fights drop below the roster floor (a level-1
    // trio can win); the ramp lifts late fights back above 1.0 for the level-5 endgame.
    // -0.65 (was -0.60): the nearest-2 map wiring (C1) gives a near-optimal player
    // slightly tighter EXP-fight paths, shaving one win off the 120-seed harness;
    // this re-eases the area-0 floor to restore the calibrated >15% win target.
    menaceBase: -0.65,
    menacePerDepth: 0.04,
    menaceEliteMult: 1.1,
    menaceBossMult: 1.3,
    // The FINAL area boss is the scripted Voldemort (BOSSES[0], fixed budget); its
    // menace is this flat value (independent of the depth ramp) so it stays the climax.
    finalBossMenace: -0.25,
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
    autoGrowthPct: 0.10,        // +10% a tutte le stat per livello sopra il 1
    milestoneBoostPct: 0.25,    // +25% allo stat scelto a una soglia
    milestoneLevels: [3, 6, 9] as readonly number[],
    levelMax: 10,
    expStep: 70,                // exp per salire da L a L+1 = expStep * L
    expBattle: 80,              // exp da un combattimento normale (team-wide)
    expElite: 160,              // exp da un Elite
    expBoss: 120,               // area boss clear → exp per la prossima area (boss finale: irrilevante)
  },
  recruit: {
    offerSize: 3,
    houseGuarantee: 1,          // almeno N candidati della Casa del giocatore
    houseBiasWeight: 1.5,       // moltiplicatore di peso per i non-garantiti della Casa
  },
  roles: {
    tauntBonus: 1000,       // additive threat that makes a live Tank the focus
    attackerArmorPen: 0.4,  // fraction of target DEF an Attaccante ignores
  },
} as const
