import type { ActiveRelic, DraftedWizard } from '@/types'
import { relicMatchesCondition } from './relics'
import { tagsOf } from './roster'

/** Per-team guaranteed-hit set. A wizard is in the set when:
 *  - it carries the `infallibile` tag and is tier >= 2 (per-unit), OR
 *  - any active relic with `grantsAlwaysHit: true` (+ its condition) fires for this team.
 *  Returns a Set<wizardId>. Pure; no RNG. */
export function teamAlwaysHit(team: DraftedWizard[], relics: ActiveRelic[]): Set<string> {
  const ids = new Set<string>()
  for (const dw of team) {
    if (tagsOf(dw).includes('infallibile') && dw.wizard.tier >= 2) ids.add(dw.wizard.id)
  }
  const granted = relics.some(r => r.relic.grantsAlwaysHit && relicMatchesCondition(team, r.relic.condition))
  if (granted) for (const dw of team) ids.add(dw.wizard.id)
  return ids
}
