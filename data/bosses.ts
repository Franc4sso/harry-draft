import type { Synergy } from '@/types'

export interface BossDef {
  id: string
  name: string
  budget: number
  hpMult: number
  forcedSpellIds?: string[]
  exclusiveSynergy?: Synergy
  /** Wall archetype: per-unit direct-damage reduction (0..1) applied to every boss unit. */
  unitDamageReduction?: number
  /** Area this scripted boss is pinned to (e.g. Muro → 0). Final boss uses isFinalBoss instead. */
  pinnedArea?: number
  /** Team size override; defaults to BALANCE.draft.teamSize (5) when absent. */
  unitCount?: number
  /** A specific wizard guaranteed as this boss's leader unit in the fought team. */
  bossWizardId?: string
  /** Attackers on this boss's side ignore the enemy Tank's taunt (target backline). */
  ignoresTaunt?: boolean
}

export const BOSSES: BossDef[] = [
  {
    id: 'voldemort_boss',
    name: 'Lord Voldemort',
    budget: 1080,
    hpMult: 1.09,
    forcedSpellIds: ['avada', 'fiendfyre'],
    bossWizardId: 'voldemort',
    // ADDED 2026-07-02 (Task 18d, area-0 blocker resolution): previously unset (implicit
    // default BALANCE.draft.teamSize=5). A 120-seed loss trace showed that once
    // enemyCountByArea/Muro/Bellatrix were trimmed to fix area-0/1, Voldemort's fixed
    // 5-unit squad became the dominant remaining wall (area2-boss losses rose to 28-62/120
    // across sweep configs) — an exhaustive degenerate sweep of every OTHER lever (with
    // Voldemort still implicit-default 5) topped out at winRate 0.0417, proving 5 units is
    // structurally uncompensable. unitCount 2 (paired with enemyCountByArea [2,3,3] and
    // Muro/Bellatrix left at their calibrated 3) cleared the 0.15 floor at 0.1583.
    // RAISED 2→3 (2026-07-02, Task 21, USER DECISION): the final boss felt too scrawny at
    // 2 units. This is a genuine difficulty increase (campaignBalanceB dropped to 0.0500
    // with unitCount=3 alone) — restored via a starting-roster-size raise instead
    // (game/engine/runEngine.ts STARTER_PICKS 2→4), landing at winRate 0.2083. See
    // data/constants.ts campaignB's Task 21 note and tests/engine/campaignBalanceB.test.ts
    // header for the full sweep table.
    //
    // Task 25 (2026-07-02, USER DECISION): STARTER_PICKS reverted 4→3 ("MAI 4, 3 maghi
    // voglio"), reopening the area-2-boss action-economy deficit Task 21 had fixed via the
    // roster raise (campaignBalanceB crashed to 0.1000). Voldemort's OWN budget/hpMult
    // turned out to be the lever that moves this floor: budget 1800→1080, hpMult 1.4→1.09.
    //
    // RAISED unitCount 3→5 (2026-07-04, USER DECISION): "il boss dell'ultima arena non può
    // avere solo 3 maghi, non ha senso" — the FINAL boss must field a full army (the area
    // bosses Muro/Bellatrix stay at 3, so the finale visibly escalates). The old
    // "5 units is structurally uncompensable" finding (winRate ≈0.04) was measured against
    // the weak default-spell bot on the old calibration; re-measured now against the
    // spell-optimized bot + the [3,5,8] enemy-count pass, a 5-unit finale at the SAME
    // per-unit power (1080/1.09) lands campaignBalanceRestricted at 0.2083 (vs 0.2583 at
    // 3 units) — a harder, climactic finale that the user explicitly endorsed ("più
    // cattivo, dev'essere così"). budget/hpMult were verified near-inert at unitCount=5
    // (budget 1080→900 flat at 0.2167; hpMult 1.09→1.0 = +1 seed) — the shared team budget
    // spreads thin over 5 bodies, so the extra ACTIONS are the difficulty, not per-unit
    // stats. Kept at the original calibrated 1080/1.09 for the most threatening finale.
    unitCount: 5,
    exclusiveSynergy: {
      id: 'darkLord', name: "L'Oscuro Signore", kind: 'group',
      requires: { count: 1 }, bonus: { allPct: 0.2 },
    },
  },
]

/** Area-0 scripted wall boss. Telegraphed; countered by veleno (bypasses damageReduction).
 *  No bossWizardId: Il Muro is a wall archetype (a fortification, not a named character),
 *  so there is no thematic wizard to guarantee as its leader — left absent by design. */
export const MURO: BossDef = {
  id: 'muro_boss',
  name: 'Il Muro',
  // Re-tuned 2026-07-01 (menace removal, urgent balance fix): budget/hpMult 1000/1.3
  // was calibrated against menace-crushed (~0.05-0.13x) enemy stats everywhere else in
  // the campaign; with menace gone (enemies now at full leveled stats), those values
  // were part of a campaignBalanceB crash to 0.0000. Softened as far as the sweep
  // found useful (250/0.5, part of a combined sweep with campaignB.baseBudget/
  // eliteBudgetMult/bossBudgetMult — see tests/engine/campaignBalanceB.test.ts header)
  // — this alone does not restore the 0.15 floor; see that file's header for the honest
  // sweep table and the structural (non-budget) blocker.
  // Softened further 250/0.5→150/0.35 (2026-07-04, recruit-rarity re-tune): tried while
  // hunting for the campaignBalanceB floor after the recruit-node cap change (see
  // data/constants.ts campaignB.categoryWeights comment for the full story). Measured
  // FLAT (no winRate change) — consistent with this file's established pattern that
  // Muro's budget/hpMult plateau once already low; the real lever turned out to be
  // categoryWeights + enemyCountByArea. Left at the softer value anyway (same direction
  // as the difficulty intent, harmless either way).
  budget: 150,
  hpMult: 0.35,
  unitDamageReduction: 0.4, // unchanged: wall-archetype mechanic, not a budget/power lever.
  pinnedArea: 0,
  unitCount: 3,
}

/** Area-1 scripted boss: Bellatrix Lestrange. Signature effect: ignores the enemy
 *  Tank's taunt (provocazione), so her side targets by real threat and hits the backline.
 *  Calibrated 2026-07-01 (Task 8): ignoresTaunt (whole-side scope) is the dominant lever here —
 *  budget/hpMult barely move campaignBalanceB in isolation (0.1417 flat across budget 500→900 at
 *  hpMult 1.25, and flat at 0.1500 across budget 200→900 once unitCount=3/hpMult=1.0). unitCount=3
 *  (matches Muro's pattern) plus hpMult trimmed below 1.0 was needed to clear the floor: hpMult
 *  0.85 passes at 0.1583 across budget∈[200,450] (stable plateau); hpMult flips to 0.1500 (fails
 *  strict >) at 0.88+ (boundary measured at 0.875 pass / 0.88 fail — 1-seed margin, same fragility
 *  pattern as the final-boss and Muro tunings). See campaignBalanceB.test.ts.
 *  unitCount TRIMMED 3→2 (2026-07-02, Task 25, STARTER_PICKS=3 exploration): part of the
 *  Task-25 sweep to recover the 0.15 floor after STARTER_PICKS reverted 4→3; kept as-is
 *  since area-1/Bellatrix was confirmed NOT the live bottleneck in the final Task 25 sweep
 *  (flat 0.1000 plateau when perturbing hpMult further at unitCount=2) — the floor was
 *  ultimately cleared via Voldemort's own budget/hpMult instead. See
 *  tests/engine/campaignBalanceB.test.ts header for the full Task 25 table.
 *  RESTORED 2→3 (2026-07-03, USER DECISION): a boss fighting with only 2 units read as
 *  wrong ("perché Bellatrix so due?"). Every boss now fields ≥3 units — this is a hard
 *  design rule, also enforced structurally by generateBossTeam's Math.max(3, …) floor.
 *  This is a deliberate difficulty increase that overrides the Task-25 balance choice. */
export const BELLATRIX: BossDef = {
  id: 'bellatrix_boss',
  name: 'Bellatrix Lestrange',
  budget: 300,
  hpMult: 0.85,
  bossWizardId: 'bellatrix',
  ignoresTaunt: true,
  pinnedArea: 1,
  unitCount: 4, // 3->4 (USER 2026-07-08): boss must not field fewer units than an elite (area-2 elite 5->3)
}

// --- Seeded boss pool (Task 6, Reservation 2): one alternate per area, picked per-run by
// seed (battlePackage.ts bossPick). Each alt REUSES its area default's calibrated
// budget/hpMult/unitCount/mechanic (spread from the default) so the balance floor holds —
// only id/name/bossWizardId (a thematic villain reskin) differ.

/** Area-0 alt: Il Muro reskinned as a monstrous personal wall — same wall mechanic
 *  (unitDamageReduction) and calibrated budget/hpMult/unitCount as MURO.
 *  Leader FIXED 2026-07-03 (balance review): was 'greyback' (powerOf ≈221.5, roster
 *  rank ~54/59 — a top-10% outlier), which broke the "alts are power-neutral reskins"
 *  rule and dropped campaignBalanceB 0.1000→0.0833 by making area-0 (the run's first,
 *  least-forgiving boss) markedly harder than default MURO (leaderless, ≈power 140).
 *  Then briefly 'pettigrew' (powerOf ≈145.5) — an exact power match, but pettigrew is a
 *  Supporto, and this slice bans any Supporto from being a boss-leader (a Supporto is
 *  clamped to a Cura fallback in guaranteeOffensiveSpell, so it can never hold the
 *  offensive spell the "no harmless boss/elite" invariant requires — see
 *  tests/engine/combat/attackMoveGuarantee.test.ts and game/engine/statRoll.ts).
 *  Leader FIXED 2026-07-07 (USER DECISION): replaced pettigrew with 'marcus'
 *  (Marcus Flint, Serpeverde Attaccante, powerOf 145.5 — the SAME power as pettigrew,
 *  so campaignBalanceB is unmoved). Thematic constraint relaxed from "deatheater-tagged"
 *  to "Serpeverde house": the scoped deatheater/non-Supporto pool was empty (every
 *  deatheater is either already a leader elsewhere or a Supporto), and marcus is a
 *  credible Slytherin mini-boss and an exact power match to the MURO baseline. */
export const MURO_ALT: BossDef = {
  ...MURO,
  id: 'marcus_boss',
  name: 'Marcus Flint',
  bossWizardId: 'marcus',
}

/** Area-1 alt: same ignoresTaunt mechanic and calibrated numbers as BELLATRIX, reskinned
 *  as a fellow Death Eater. */
export const BELLATRIX_ALT: BossDef = {
  ...BELLATRIX,
  id: 'dolohov_boss',
  name: 'Antonin Dolohov',
  bossWizardId: 'dolohov',
}

/** Final-area alt: same budget/hpMult/unitCount/forcedSpellIds/exclusiveSynergy as
 *  BOSSES[0] (Voldemort), reskinned as his lieutenant. */
export const VOLDEMORT_ALT: BossDef = {
  ...BOSSES[0]!,
  id: 'lucius_boss',
  name: 'Lucius Malfoy',
  bossWizardId: 'lucius',
}

/** Seeded pool per area — default boss first (always selectable), alt second.
 *  battlePackage.ts's bossPick() forks the combat seed to choose an index into the
 *  matching sub-array; this stays pure/deterministic and is NEVER gated on unlock state. */
export const BOSSES_BY_AREA: BossDef[][] = [
  [MURO, MURO_ALT],
  [BELLATRIX, BELLATRIX_ALT],
  [BOSSES[0]!, VOLDEMORT_ALT],
]
