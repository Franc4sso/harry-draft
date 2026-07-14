import type { ActiveDuo, DraftedWizard, House } from '@/types'
import { livingOf } from '@/game/engine/roster'

export interface TrioEffect {
  firstStrike?: { bonus: number }              // Serpeverde
  analysis?: { exposeId: 'expose1' | 'expose2' } // Corvonero
  statusDurationBonus?: number                 // Tassorosso
  cooldownReduction?: number                   // Grifondoro
}

// grade 0 = 3 members, grade 1 = 4+ members. Initial numbers — tune via campaignBalanceB.
function effectFor(house: House, grade: 0 | 1): TrioEffect {
  switch (house) {
    case 'Serpeverde':  return { firstStrike: { bonus: grade === 1 ? 0.45 : 0.30 } }
    case 'Corvonero':   return { analysis: { exposeId: grade === 1 ? 'expose2' : 'expose1' } }
    case 'Tassorosso':  return { statusDurationBonus: 1 }
    case 'Grifondoro':  return { cooldownReduction: 1 }
  }
}

/** The houses that have an active Trio and their grade (0 = 3 members, 1 = 4+).
 *  Single source of truth for the gate: ≥1 active Duo AND ≥3 living wizards of the house.
 *  Both trioEffects (combat) and the run UI consume this so they can never drift. */
export function trioGates(team: DraftedWizard[], duos: ActiveDuo[]): { house: House; grade: 0 | 1 }[] {
  if (duos.length === 0) return []
  const living = livingOf(team)
  const countByHouse = new Map<House, number>()
  for (const d of living) countByHouse.set(d.wizard.house, (countByHouse.get(d.wizard.house) ?? 0) + 1)
  const out: { house: House; grade: 0 | 1 }[] = []
  for (const [house, n] of countByHouse) {
    if (n < 3) continue
    out.push({ house, grade: n >= 4 ? 1 : 0 })
  }
  return out
}

/** Player-only. For each wizard, its house's Trio effect IF the team has ≥1 active Duo AND
 *  ≥3 living wizards share that house. Empty map when no Duo is active. Pure; no RNG. */
export function trioEffects(team: DraftedWizard[], duos: ActiveDuo[]): Record<string, TrioEffect> {
  const gates = trioGates(team, duos)
  if (gates.length === 0) return {}
  const gradeByHouse = new Map(gates.map(g => [g.house, g.grade]))
  const map: Record<string, TrioEffect> = {}
  for (const d of livingOf(team)) {
    const grade = gradeByHouse.get(d.wizard.house)
    if (grade === undefined) continue
    map[d.wizard.id] = effectFor(d.wizard.house, grade)
  }
  return map
}
