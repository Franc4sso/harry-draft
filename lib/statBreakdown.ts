import type { ActiveRelic, ActiveSynergy, DraftedWizard, Stats } from '@/types'
import { leveledStats } from '@/game/engine/leveling'
import { applyBonuses } from '@/game/engine/synergy'
import { applyRelicBonuses } from '@/game/engine/relics'

export interface StatBreakdown {
  base: Stats
  afterLevel: Stats
  afterSynergy: Stats
  total: Stats
}

/**
 * Layered effective stats in the SAME order combat applies them:
 * base → level (leveledStats) → synergy (applyBonuses) → relics (applyRelicBonuses).
 * This is the single source of truth shared by combat-prep and the UI.
 */
export function statBreakdown(
  dw: DraftedWizard, team: DraftedWizard[], synergies: ActiveSynergy[], relics: ActiveRelic[],
): StatBreakdown {
  const base = dw.stats
  const afterLevel = leveledStats(dw)
  const afterSynergy = applyBonuses(afterLevel, synergies)
  const total = applyRelicBonuses(afterSynergy, team, relics)
  return { base, afterLevel, afterSynergy, total }
}
