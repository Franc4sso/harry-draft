import type { ActiveSynergy, BattleUnit, EffectSpec, Side } from '@/types'
import type { EventBus } from './combat/eventBus'

/** Per-hit chance for a Tossicità member to apply poison with a normal strike.
 *  Balance lever (Task 6 / spec Rischio #1).
 *  Calibration log (2026-06-30, Task 6 — "Veleno from attacks" slice final balance):
 *    Poison power was added on several axes (guaranteed venom spells; this on-hit
 *    generation; Tossicità's keywordMult.veleno=0.5 amplification) and themed-venom
 *    enemy teams now ALSO activate Tossicità — the RISK was a win-rate drop below the
 *    0.15 floor. Counter-pressure: removing Tossicità's old atk:5 made the player side
 *    slightly weaker too. MEASURED FIRST over the campaignBalanceB 120-seed harness:
 *    winRate = 0.2083 (25/120) — already INSIDE [0.15, 0.45]. Per the brief's nuance,
 *    do NOT tune away from a passing state, so NO levers were lowered. SHIPPED:
 *    TOSSICITA_HIT_CHANCE = 0.35, keywordMult.veleno = 0.5 (synergies.ts), veleno
 *    tickDamage/tickPctMaxHp unchanged (statuses.ts), themes.nodeMult unchanged
 *    (constants.ts). First lever to reach for if a regression pushes below floor:
 *    lower this hit-chance (0.35 → 0.25 → 0.15), then keywordMult.veleno (0.5 → 0.3). */
export const TOSSICITA_HIT_CHANCE = 0.35

/** Synergy-driven combat triggers, mirroring registerSignatures/registerRelicTriggers.
 *  Currently: Tossicità gives every member of its side an on-hit chance to poison the
 *  target (generates poison so the synergy pays off even without a venom spell equipped).
 *  Gated to the actor that owns the listener AND to `side`. */
export function registerSynergyTriggers(
  bus: EventBus, units: BattleUnit[], synergies: ActiveSynergy[], side: Side,
): void {
  const tossicita = synergies.some(s => s.synergy.id === 'tossicita')
  const spietatezza = synergies.some(s => s.synergy.id === 'spietatezza')
  if (spietatezza) for (const u of units) u.carnefice = true
  const bastione = synergies.some(s => s.synergy.id === 'bastione')
  if (bastione) for (const u of units) u.wallReflect = 0.25
  if (!tossicita) return
  for (const u of units) {
    bus.onReactive('onHit', (ctx): EffectSpec[] =>
      ctx.side === side && ctx.actor === u
        ? [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno', chance: TOSSICITA_HIT_CHANCE, duration: 2 }]
        : [],
    )
  }
}
