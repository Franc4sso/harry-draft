import { describe, it, expect } from 'vitest'
import type { ReactiveHook, ModifierHook, BattleHook } from '@/types'

describe('event hook types', () => {
  it('reactive and modifier hooks are assignable to BattleHook', () => {
    const r: ReactiveHook = 'onHit'
    const m: ModifierHook = 'modifyOutgoingDamage'
    const hooks: BattleHook[] = [r, m, 'onBattleStart', 'onHpThreshold']
    expect(hooks).toContain('onHit')
  })
})
