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
}

export const BOSSES: BossDef[] = [
  {
    id: 'voldemort_boss',
    name: 'Lord Voldemort',
    budget: 1800,
    hpMult: 1.4,
    forcedSpellIds: ['avada', 'fiendfyre'],
    exclusiveSynergy: {
      id: 'darkLord', name: "L'Oscuro Signore", kind: 'group',
      requires: { count: 1 }, bonus: { allPct: 0.2 },
    },
  },
]

/** Area-0 scripted wall boss. Telegraphed; countered by veleno (bypasses damageReduction). */
export const MURO: BossDef = {
  id: 'muro_boss',
  name: 'Il Muro',
  budget: 1000,
  hpMult: 1.3,
  unitDamageReduction: 0.4, // calibrated 2026-07-01 (Task 6b): passing plateau {0.40,0.45}; 0.35/0.50 flip overall to 0.1500 (< floor). See campaignBalanceB.test.ts.
  pinnedArea: 0,
  unitCount: 3,
}
