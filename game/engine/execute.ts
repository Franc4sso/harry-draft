import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'
import { keywordDamageMult, relicMatchesCondition } from './relics'

/** Team-wide execute from relics + the Spietatezza synergy, scaled by keywordMult.esecuzione.
 *  Pure; no RNG. Returns undefined when the team has no execute source. */
export function teamExecute(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[],
): { threshold: number; bonus: number } | undefined {
  let threshold = 0
  let bonus = 0
  for (const { relic } of relics) {
    if (!relic.grantsExecute) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    threshold = Math.max(threshold, relic.grantsExecute.threshold)
    bonus += relic.grantsExecute.bonus
  }
  if (synergies.some(s => s.synergy.id === 'spietatezza')) {
    threshold = Math.max(threshold, 0.35)
    bonus += 0.25
  }
  if (bonus <= 0) return undefined
  bonus *= keywordDamageMult(team, relics, synergies, 'esecuzione')
  return { threshold, bonus }
}
