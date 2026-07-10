import type { BattleUnit } from '@/types'
import { applyStatus } from '@/game/engine/status'

/** MIETITORE (Duo Combos, player-only, per-battle): each execute/kill landed by a player unit
 *  grants that killer one stack of `raccolto` — a permanent (rest-of-battle) +6 atk buff. No rng
 *  involved: the killer is already known at the call site, so there's no determinism concern
 *  (unlike UNTORE/MIASMA, which must pick a random recipient). */
export function maybeReap(killer: BattleUnit): void {
  applyStatus(killer, 'raccolto', { sourceId: `${killer.side}:${killer.wizard.id}` })
}
