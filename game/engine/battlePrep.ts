import type { DraftedWizard } from '@/types'
import { leveledStats } from './leveling'

/**
 * Map a run roster to combat-ready units: stats/maxHp reflect levels, and any
 * carried wound is preserved as a FRACTION of the new (leveled) hp pool. The
 * combat engine reads only `stats`/`maxHp`/`currentHp`, so this keeps levels
 * entirely outside the engine. Pure; never mutates the input.
 */
export function battleReadyTeam(team: DraftedWizard[]): DraftedWizard[] {
  return team.map(dw => {
    const ls = leveledStats(dw)
    const baseHp = dw.maxHp > 0 ? dw.maxHp : 1
    const next: DraftedWizard = { ...dw, stats: ls, maxHp: ls.hp }
    if (dw.currentHp !== undefined) {
      const frac = Math.max(0, Math.min(1, dw.currentHp / baseHp))
      next.currentHp = Math.round(ls.hp * frac)
    }
    return next
  })
}
