import type {
  EffectSpec, HookCtx, ModifierHook, ModifierListener, ReactiveHook, ReactiveListener,
} from '@/types'

export interface EventBus {
  onReactive(hook: ReactiveHook, fn: ReactiveListener): void
  onModifier(hook: ModifierHook, fn: ModifierListener): void
  /** Returns concatenated EffectSpecs from all listeners in registration order. Caller applies them. */
  collectReactive(hook: ReactiveHook, ctx: HookCtx): EffectSpec[]
  /** Folds the value through every modifier listener in registration order. Pure; no RNG. */
  emitModifier(hook: ModifierHook, value: number, ctx: HookCtx): number
}

export function createEventBus(): EventBus {
  const reactive = new Map<ReactiveHook, ReactiveListener[]>()
  const modifier = new Map<ModifierHook, ModifierListener[]>()

  return {
    onReactive(hook, fn) {
      const list = reactive.get(hook) ?? []
      list.push(fn)
      reactive.set(hook, list)
    },
    onModifier(hook, fn) {
      const list = modifier.get(hook) ?? []
      list.push(fn)
      modifier.set(hook, list)
    },
    collectReactive(hook, ctx) {
      const out: EffectSpec[] = []
      for (const fn of reactive.get(hook) ?? []) out.push(...fn(ctx))
      return out
    },
    emitModifier(hook, value, ctx) {
      let v = value
      for (const fn of modifier.get(hook) ?? []) v = fn(v, ctx)
      return v
    },
  }
}
