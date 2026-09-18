import type { AbilityLine, Cond, Effect, Target, Trigger } from '@/types/rt'

type Extra = { params?: [number, number, number]; targetArg?: string; cond?: Cond; limit?: AbilityLine['limit']; desc?: string }
export const riga = (trigger: Trigger, target: Target, effect: Effect, extra: Extra = {}): AbilityLine => ({ trigger, target, effect, ...extra })
/** Cooldown in secondi per le righe "Al lancio". */
export const cd = (s: number): AbilityLine['limit'] => ({ everySeconds: s })
/** Una (o n) volta per battaglia. */
export const una = (n = 1): AbilityLine['limit'] => ({ perBattle: n })
/** Opt-out esplicito del cooldown: solo per identità piccole. */
export const libera = (): AbilityLine['limit'] => ({ senzaCooldown: true })
