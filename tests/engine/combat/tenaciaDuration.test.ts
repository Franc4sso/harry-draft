import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { createRng } from '@/game/engine/rng'
import { mkUnit } from './_roleTestUtils'

const alwaysRng = { ...createRng('x'), chance: () => true } as never

describe('Tenacia: control duration halved on a side with a live Supporto', () => {
  it('a 2-turn stun becomes 1 turn when the target has controlResist', () => {
    const actor = mkUnit({ id: 'ctl', role: 'Controllo', side: 'left' })
    const protectedTank = mkUnit({ id: 'tank', role: 'Tank', side: 'right', controlResist: true })
    EFFECT_HANDLERS.applyStatus(
      { rng: alwaysRng, turn: 1, actor, target: protectedTank, flags: [] } as never,
      { kind: 'applyStatus', target: 'enemy', statusId: 'stun', duration: 2 } as never,
    )
    expect(protectedTank.statusEffects.find(e => e.kind === 'stun')?.remaining).toBe(1)
  })
  it('no Supporto (controlResist falsy) → full duration', () => {
    const actor = mkUnit({ id: 'ctl', role: 'Controllo', side: 'left' })
    const tank = mkUnit({ id: 'tank2', role: 'Tank', side: 'right' })
    EFFECT_HANDLERS.applyStatus(
      { rng: alwaysRng, turn: 1, actor, target: tank, flags: [] } as never,
      { kind: 'applyStatus', target: 'enemy', statusId: 'stun', duration: 2 } as never,
    )
    expect(tank.statusEffects.find(e => e.kind === 'stun')?.remaining).toBe(2)
  })
})
