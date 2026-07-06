import { describe, it, expect } from 'vitest'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerRelicTriggers } from '@/game/engine/relics'
import type { ActiveRelic, HookCtx } from '@/types'

const ctx = (turn: number): HookCtx => ({ turn, actor: {} as any, side: 'left', flags: [] })

describe('onlyTurn trigger gate', () => {
  it('fires only on the matching turn', () => {
    const bus = createEventBus()
    const relic: ActiveRelic = {
      relic: {
        id: 'op', name: 'Op', desc: '', rarity: 'epica',
        triggers: [{ hook: 'onTurnStart', onlyTurn: 1, effects: [{ kind: 'buff', stat: 'atk', amount: 40, target: 'ally' } as any] }],
      },
      stageObtained: 0,
    }
    registerRelicTriggers(bus, [], [relic], 'left')
    const at1 = bus.collectReactive('onTurnStart', ctx(1))
    const at2 = bus.collectReactive('onTurnStart', ctx(2))
    expect(at1.length).toBeGreaterThan(0)
    expect(at2.length).toBe(0)
  })

  it('fires on every turn when onlyTurn is absent (unchanged behavior)', () => {
    const bus = createEventBus()
    const relic: ActiveRelic = {
      relic: {
        id: 'always', name: 'Always', desc: '', rarity: 'epica',
        triggers: [{ hook: 'onTurnStart', effects: [{ kind: 'buff', stat: 'atk', amount: 10, target: 'ally' } as any] }],
      },
      stageObtained: 0,
    }
    registerRelicTriggers(bus, [], [relic], 'left')
    const at1 = bus.collectReactive('onTurnStart', ctx(1))
    const at2 = bus.collectReactive('onTurnStart', ctx(2))
    expect(at1.length).toBeGreaterThan(0)
    expect(at2.length).toBeGreaterThan(0)
  })
})
