import type { ActiveSynergy, DraftedWizard, House } from '@/types'

type Effect = { dodgeBonus?: number; critBonus?: { chance: number; mult: number }; damageReduction?: number; cunning?: { threshold: number; bonus: number } }

// Tier index 0/1/2 for 2/3/4 members. Values tuned in Task 6 (balance) — these are starting points.
const TIER = (familyId: string): 0 | 1 | 2 | -1 =>
  familyId.endsWith('2') ? 0 : familyId.endsWith('3') ? 1 : familyId.endsWith('4') ? 2 : -1

const GRYFF_DODGE = [0.04, 0.08, 0.14]
const RAVEN_CRIT = [{ chance: 0.06, mult: 0.2 }, { chance: 0.10, mult: 0.35 }, { chance: 0.16, mult: 0.5 }]
const HUFF_REDUCE = [0.08, 0.15, 0.22]
const SLYTH_CUNNING = [{ threshold: 0.5, bonus: 0.15 }, { threshold: 0.5, bonus: 0.25 }, { threshold: 0.5, bonus: 0.4 }]

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
