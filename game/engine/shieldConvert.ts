import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'
import { keywordDamageMult, relicMatchesCondition } from './relics'

/** Team-wide regen-overflow → shield conversion from relics + the Bastione synergy, scaled by
 *  keywordMult.scudo. Pure; no RNG. Returns undefined when the team has no conversion source.
 *  `rate` is the fraction of each regen tick's overflow-above-maxHp that becomes shield (clamped <= 1). */
export function teamShieldConvert(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[],
): { rate: number } | undefined {
  let rate = 0
  for (const { relic } of relics) {
    if (!relic.grantsShieldConvert) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    rate += relic.grantsShieldConvert.rate
  }
  if (synergies.some(s => s.synergy.id === 'bastione')) {
    rate += 0.35
  }
  if (rate <= 0) return undefined
  rate *= keywordDamageMult(team, relics, synergies, 'scudo')
  return { rate: Math.min(1, rate) }
}
