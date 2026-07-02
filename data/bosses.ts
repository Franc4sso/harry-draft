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
    budget: 1800,
    hpMult: 1.4,
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
    unitCount: 3,
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
  budget: 250,
  hpMult: 0.5,
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
 *  pattern as the final-boss and Muro tunings). See campaignBalanceB.test.ts. */
export const BELLATRIX: BossDef = {
  id: 'bellatrix_boss',
  name: 'Bellatrix Lestrange',
  budget: 300,
  hpMult: 0.85,
  bossWizardId: 'bellatrix',
  ignoresTaunt: true,
  pinnedArea: 1,
  unitCount: 3,
}
