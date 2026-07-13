import { describe, it, expect } from 'vitest'
import { isUnderHardControl, countHardControl } from '@/game/engine/combat/roleCounter'
import { mkUnit } from './_roleTestUtils'

describe('roleCounter', () => {
  it('detects hard control (stun/freeze/silence) but not disarm/slow', () => {
    expect(isUnderHardControl(mkUnit({ id: 'a', role: 'Tank' }))).toBe(false)
    expect(isUnderHardControl(mkUnit({ id: 'b', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never] }))).toBe(true)
    const disarmed = mkUnit({ id: 'c', role: 'Tank', statusEffects: [{ kind: 'disarm', remaining: 1, stacks: 1 } as never] })
    expect(isUnderHardControl(disarmed)).toBe(false)
    const doubled = mkUnit({ id: 'd', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never, { kind: 'silence', remaining: 1, stacks: 1 } as never] })
    expect(countHardControl(doubled)).toBe(2)
  })
})
