import { describe, it, expect } from 'vitest'
import type { ReactiveHook, ModifierHook, BattleHook } from '@/types'
import { createEventBus } from '@/game/engine/combat/eventBus'
import type { HookCtx } from '@/types'

const ctx = (): HookCtx => ({ turn: 1, actor: {} as any, side: 'left', flags: [] })

describe('event hook types', () => {
  it('reactive and modifier hooks are assignable to BattleHook', () => {
    const r: ReactiveHook = 'onHit'
    const m: ModifierHook = 'modifyOutgoingDamage'
    const hooks: BattleHook[] = [r, m, 'onBattleStart', 'onHpThreshold']
    expect(hooks).toContain('onHit')
  })
})

describe('createEventBus', () => {
  it('collectReactive returns specs in registration order', () => {
    const bus = createEventBus()
    bus.onReactive('onHit', () => [{ kind: 'heal', amount: 1 }])
    bus.onReactive('onHit', () => [{ kind: 'heal', amount: 2 }])
    const specs = bus.collectReactive('onHit', ctx())
    expect(specs).toEqual([{ kind: 'heal', amount: 1 }, { kind: 'heal', amount: 2 }])
  })

  it('collectReactive returns [] for a hook with no listeners', () => {
    expect(createEventBus().collectReactive('onDeath', ctx())).toEqual([])
  })

  it('emitModifier folds value through listeners in order', () => {
    const bus = createEventBus()
    bus.onModifier('modifyOutgoingDamage', v => v * 2)
    bus.onModifier('modifyOutgoingDamage', v => v + 5)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, ctx())).toBe(25) // (10*2)+5
  })

  it('emitModifier returns the value unchanged with no listeners (identity)', () => {
    expect(createEventBus().emitModifier('modifyIncomingDamage', 42, ctx())).toBe(42)
  })
})
