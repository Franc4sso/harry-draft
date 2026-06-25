import type { EffectSpec } from './status'
import type { HookCtx, ModifierHook, ReactiveHook } from './events'

/** Which unit in the HookCtx owns (triggers) the trait. */
export type TraitSubject = 'actor' | 'target'

export type TraitTrigger =
  | { kind: 'modifier'; hook: ModifierHook; owner: TraitSubject; apply: (value: number, ctx: HookCtx) => number }
  | { kind: 'reactive'; hook: ReactiveHook; owner: TraitSubject; effects: (ctx: HookCtx) => EffectSpec[] }

export interface Trait {
  id: string
  name: string
  desc: string
  trigger: TraitTrigger
}
