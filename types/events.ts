import type { EffectSpec } from './status'
import type { BattleUnit, LogFlag, Side } from './combat'

export type ReactiveHook =
  | 'onBattleStart' | 'onTurnStart' | 'onTurnEnd'
  | 'onHit' | 'onHeal' | 'onDeath' | 'onAllyDeath' | 'onHpThreshold'

export type ModifierHook =
  | 'modifyOutgoingDamage' | 'modifyIncomingDamage' | 'modifyHealing'

/** Reserved in the type so future consumers have a home; NOT dispatched yet. */
export type ReservedHook =
  | 'beforeSpell' | 'afterSpell' | 'onRoundStart' | 'onRoundEnd'

export type BattleHook = ReactiveHook | ModifierHook | ReservedHook

export interface HookCtx {
  turn: number
  /** Unit the event is "about": self for onTurnStart, attacker for onHit. */
  actor: BattleUnit
  /** Counterpart when meaningful: victim for onHit, dead unit for onAllyDeath. */
  target?: BattleUnit
  /** Owning side of the listener being evaluated. */
  side: Side
  flags: LogFlag[]
  /** onHpThreshold: fraction 0..1 of the unit that just crossed. */
  hpPct?: number
}

export type ReactiveListener = (ctx: HookCtx) => EffectSpec[]
export type ModifierListener = (value: number, ctx: HookCtx) => number
