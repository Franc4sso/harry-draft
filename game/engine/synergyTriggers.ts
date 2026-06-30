import type { ActiveSynergy, BattleUnit, EffectSpec, Side } from '@/types'
import type { EventBus } from './combat/eventBus'

/** Per-hit chance for a Tossicità member to apply poison with a normal strike.
 *  Balance lever (Task 6 / spec Rischio #1). */
export const TOSSICITA_HIT_CHANCE = 0.35

/** Synergy-driven combat triggers, mirroring registerSignatures/registerRelicTriggers.
 *  Currently: Tossicità gives every member of its side an on-hit chance to poison the
 *  target (generates poison so the synergy pays off even without a venom spell equipped).
 *  Gated to the actor that owns the listener AND to `side`. */
export function registerSynergyTriggers(
  bus: EventBus, units: BattleUnit[], synergies: ActiveSynergy[], side: Side,
): void {
  const tossicita = synergies.some(s => s.synergy.id === 'tossicita')
  if (!tossicita) return
  for (const u of units) {
    bus.onReactive('onHit', (ctx): EffectSpec[] =>
      ctx.side === side && ctx.actor === u
        ? [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno', chance: TOSSICITA_HIT_CHANCE, duration: 2 }]
        : [],
    )
  }
}
