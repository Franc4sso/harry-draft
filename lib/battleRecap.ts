import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

export interface RecapRow {
  key: string
  name: string
  dealt: number
  healed: number
}

/**
 * Per-unit damage dealt and healing done, derived from the replay log up to the
 * frames passed in (pass a slice for live/partial totals). Heal is credited via
 * the 'heal' flag; damage is any positive value that is NOT a heal and NOT a
 * DoT self-tick (actor === target). Returns one row per unit on `side`, sorted
 * by dealt+healed descending, then name.
 */
export function recapTotals(
  frames: ReplayFrame[], units: ReplayUnit[], side: 'left' | 'right',
): RecapRow[] {
  const rows = new Map<string, RecapRow>()
  for (const u of units) {
    if (u.side === side) rows.set(u.key, { key: u.key, name: u.name, dealt: 0, healed: 0 })
  }
  for (const f of frames) {
    const e = f.entry
    if (!e || !e.actorSide || e.actorSide !== side) continue
    const row = rows.get(unitKey(e.actorSide, e.actorId))
    if (!row) continue
    const value = e.value ?? 0
    if (value <= 0) continue
    if (e.flags.includes('heal')) { row.healed += value; continue }
    // DoT self-tick: a poisoned unit logged as its own actor/target — not "damage dealt".
    if (e.actorId === e.targetId && e.actorSide === e.targetSide) continue
    row.dealt += value
  }
  return [...rows.values()].sort((a, b) => (b.dealt + b.healed) - (a.dealt + a.healed) || a.name.localeCompare(b.name))
}
