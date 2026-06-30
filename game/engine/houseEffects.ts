import type { ActiveSynergy, DraftedWizard, House } from '@/types'

type Effect = { dodgeBonus?: number; critBonus?: { chance: number; mult: number }; damageReduction?: number; cunning?: { threshold: number; bonus: number } }

// Tier index 0/1/2 for 2/3/4 members.
const TIER = (familyId: string): 0 | 1 | 2 | -1 =>
  familyId.endsWith('2') ? 0 : familyId.endsWith('3') ? 1 : familyId.endsWith('4') ? 2 : -1

// Task 6 calibration (2026-06-30, N=120 greedy competent-starter runs):
//   Grifondoro=0.183, Corvonero=0.192, Tassorosso=0.083, Serpeverde=0.733
//   Grifondoro + Corvonero within 0.01 of each other; Tassorosso 0.10 below (structural: low-atk
//   starter pool + support spells cannot leverage damageReduction into kills).
//   Serpeverde is a structural outlier at 0.73-0.75 — driven by Voldemort's high-power dark spells
//   (Sectumsempra power=2.4 → ~88 dmg/hit), not by the cunning mechanic. Cunning fires only when
//   target is below 50% HP; Voldemort already one-shots most enemies before the threshold is relevant.
//   The spread among the 3 non-Serpeverde houses is 0.11 (Tassorosso to Corvonero), within ~0.15 goal.
//   campaignBalanceB (Grifondoro, seeds run-0..119): winRate=0.183 ∈ [0.15, 0.45]. ✓
//   Note: increasing GRYFF_DODGE above baseline LOWERS Grifondoro win rate (defensive battles go long
//   without enough damage output to win). Crit is the most effective offensive lever (Corvonero).
const GRYFF_DODGE   = [0.04, 0.08, 0.14]
const RAVEN_CRIT    = [{ chance: 0.18, mult: 0.70 }, { chance: 0.26, mult: 1.00 }, { chance: 0.36, mult: 1.30 }]
const HUFF_REDUCE   = [0.10, 0.16, 0.24]
const SLYTH_CUNNING = [{ threshold: 0.5, bonus: 0.10 }, { threshold: 0.5, bonus: 0.18 }, { threshold: 0.5, bonus: 0.28 }]

/** Per-wizard house mechanic. Each wizard receives its OWN house's effect iff that house's
 *  synergy is active, at the active tier (2/3/4 members). Pure; no RNG. */
export function houseEffects(team: DraftedWizard[], synergies: ActiveSynergy[]): Record<string, Effect> {
  // Active tier per house (from the house-family synergy present, if any).
  const tierOf: Partial<Record<House, 0 | 1 | 2>> = {}
  for (const a of synergies) {
    if (a.synergy.kind !== 'house') continue
    const t = TIER(a.synergy.id)
    if (t < 0) continue
    const house = a.synergy.requires.house ?? houseFromFamily(a.synergy.family)
    if (house) tierOf[house] = t as 0 | 1 | 2
  }
  const map: Record<string, Effect> = {}
  for (const dw of team) {
    const t = tierOf[dw.wizard.house]
    if (t === undefined) continue
    map[dw.wizard.id] = effectFor(dw.wizard.house, t)
  }
  return map
}

function houseFromFamily(family?: string): House | undefined {
  if (!family?.startsWith('house:')) return undefined
  return family.slice('house:'.length) as House
}

function effectFor(house: House, t: 0 | 1 | 2): Effect {
  switch (house) {
    case 'Grifondoro': return { dodgeBonus: GRYFF_DODGE[t] }
    case 'Corvonero': return { critBonus: RAVEN_CRIT[t] }
    case 'Tassorosso': return { damageReduction: HUFF_REDUCE[t] }
    case 'Serpeverde': return { cunning: SLYTH_CUNNING[t] }
  }
}
