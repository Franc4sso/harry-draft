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

/** Player-only. For each wizard, its house's Trio effect IF the team has ≥1 active Duo AND
 *  ≥3 living wizards share that house. Empty map when no Duo is active. Pure; no RNG. */
export function trioEffects(team: DraftedWizard[], duos: ActiveDuo[]): Record<string, TrioEffect> {
  if (duos.length === 0) return {}
  const living = livingOf(team)
  const countByHouse = new Map<House, number>()
  for (const d of living) countByHouse.set(d.wizard.house, (countByHouse.get(d.wizard.house) ?? 0) + 1)
  const map: Record<string, TrioEffect> = {}
  for (const d of living) {
    const n = countByHouse.get(d.wizard.house) ?? 0
    if (n < 3) continue
    map[d.wizard.id] = effectFor(d.wizard.house, n >= 4 ? 1 : 0)
  }
  return map
}
