import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'
import { keywordDamageMult, relicMatchesCondition } from './relics'

/** Per-wizard Magie Oscure map. The Oscurità synergy gives `bonus` (recoil 0) to every
 *  magieOscure-tagged wizard; an assigned Marchio Nero adds bonus + recoil to its carrier only.
 *  Bonus is scaled by keywordMult.magieOscure; recoil is NOT scaled. Pure; no RNG. */
export function teamDarkMagic(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[],
): Record<string, { bonus: number; recoil: number }> {
  const map: Record<string, { bonus: number; recoil: number }> = {}
  const synBonus = synergies.some(s => s.synergy.id === 'oscurita') ? 0.3 : 0
  // 1. synergy: every dark caster gets the base bonus (no recoil)
  if (synBonus > 0) {
    for (const dw of team) {
      if ((dw.wizard.tags ?? []).includes('magieOscure')) {
        map[dw.wizard.id] = { bonus: synBonus, recoil: 0 }
      }
    }
  }
  // 2. assigned Marchio: bonus + recoil to the carrier (creating its entry if needed)
  for (const ar of relics) {
    const g = ar.relic.grantsDarkMagic
    if (!g || !ar.assignedTo) continue
    if (!relicMatchesCondition(team, ar.relic.condition)) continue
    const cur = map[ar.assignedTo] ?? { bonus: 0, recoil: 0 }
    map[ar.assignedTo] = { bonus: cur.bonus + g.bonus, recoil: Math.max(cur.recoil, g.recoil) }
  }
  // 3. scale bonus only (recoil unchanged) by the magieOscure keyword mult
  const mult = keywordDamageMult(team, relics, 'magieOscure')
  for (const id of Object.keys(map)) {
    map[id] = { bonus: map[id]!.bonus * mult, recoil: map[id]!.recoil }
  }
  return map
}
