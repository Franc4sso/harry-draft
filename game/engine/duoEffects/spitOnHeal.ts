import type { BattleUnit } from '@/types'
import type { Rng } from '@/game/engine/rng'
import { applyStatus } from '@/game/engine/status'

/** UNTORE (Duo Combos, player-only): every time the player team HEALS, jab ONE random living
 *  enemy with a dose of veleno. Deterministic by construction: the candidate pool is sorted by
 *  wizard.id before the single `rng.pick` draw, and NO draw happens when the pool is empty (a
 *  phantom draw would shift the whole downstream rng stream and desync replay). Mirrors
 *  `spreadOnDeath.ts`'s pick shape 1:1. */
export function maybeSpitPoison(enemies: BattleUnit[], rng: Rng, sourceId: string): void {
  const pool = enemies
    .filter(u => u.alive)
    .sort((a, b) => a.wizard.id.localeCompare(b.wizard.id))
  if (pool.length === 0) return // no rng draw when there's no candidate (parity)
  const recipient = rng.pick(pool)
  applyStatus(recipient, 'veleno', { sourceId })
}
