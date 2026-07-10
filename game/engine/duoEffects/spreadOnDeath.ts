import type { BattleUnit } from '@/types'
import type { Rng } from '@/game/engine/rng'
import { applyStatus } from '@/game/engine/status'

const VELENO_CAP = 8

/** MIASMA (Duo Combos, player-only): when a poisoned ENEMY dies, its veleno stacks jump to
 *  ONE random living enemy. Deterministic by construction: the candidate pool is sorted by
 *  wizard.id before the single `rng.pick` draw, and NO draw happens when the pool is empty
 *  (a phantom draw would shift the whole downstream rng stream and desync replay). Operates
 *  only on the already-resolved death — never recurses into further deaths. */
export function maybeSpreadPoison(dead: BattleUnit, enemiesOfDead: BattleUnit[], rng: Rng): void {
  if (dead.side !== 'right') return // player-only owner ⇒ only enemy deaths spread poison
  const velenoEffect = dead.statusEffects.find(e => e.statusId === 'veleno')
  const stacks = velenoEffect?.stacks ?? 0
  if (stacks <= 0) return
  const pool = enemiesOfDead
    .filter(u => u.alive && u !== dead)
    .sort((a, b) => a.wizard.id.localeCompare(b.wizard.id))
  if (pool.length === 0) return // no rng draw when there's no candidate (parity)
  const recipient = rng.pick(pool)
  const have = recipient.statusEffects.find(e => e.statusId === 'veleno')?.stacks ?? 0
  const toAdd = Math.min(stacks, VELENO_CAP - have)
  // Carry forward the ORIGINAL poisoner's credit string (ActiveEffect.sourceId, "side:id"),
  // not the dead unit's own identity — BattleUnit has no `sourceId` field, and crediting the
  // dead enemy itself would misattribute the DoT-tick score (see status.ts tickStatuses).
  for (let i = 0; i < toAdd; i++) applyStatus(recipient, 'veleno', { sourceId: velenoEffect?.sourceId })
}
