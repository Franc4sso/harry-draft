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
  budget: 1000,
  hpMult: 1.3,
  unitDamageReduction: 0.4, // calibrated 2026-07-01 (Task 6b): passing plateau {0.40,0.45}; 0.35/0.50 flip overall to 0.1500 (< floor). See campaignBalanceB.test.ts.
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
