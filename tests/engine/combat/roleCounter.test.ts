import { describe, it, expect } from 'vitest'
import { roleMult, ROLE_PREY, isUnderHardControl, countHardControl } from '@/game/engine/combat/roleCounter'
import { mkUnit } from './_roleTestUtils'

describe('roleCounter', () => {
  it('roleMult is 1.25 vs prey, 1.0 otherwise, for the whole cycle', () => {
    for (const [atk, prey] of Object.entries(ROLE_PREY)) {
      expect(roleMult(atk as never, prey as never)).toBeCloseTo(1.25)
    }
    expect(roleMult('Attaccante', 'Tank')).toBe(1)      // Tank is not Attaccante's prey
    expect(roleMult('Tank', 'Tank')).toBe(1)
  })
  it('detects hard control (stun/freeze/silence) but not disarm/slow', () => {
    expect(isUnderHardControl(mkUnit({ id: 'a', role: 'Tank' }))).toBe(false)
    expect(isUnderHardControl(mkUnit({ id: 'b', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never] }))).toBe(true)
    const disarmed = mkUnit({ id: 'c', role: 'Tank', statusEffects: [{ kind: 'disarm', remaining: 1, stacks: 1 } as never] })
    expect(isUnderHardControl(disarmed)).toBe(false)
    const doubled = mkUnit({ id: 'd', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never, { kind: 'silence', remaining: 1, stacks: 1 } as never] })
    expect(countHardControl(doubled)).toBe(2)
  })
})
