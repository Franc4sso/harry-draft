import { describe, it, expect } from 'vitest'
import { threatScore } from '@/game/engine/combat/targeting'
import { mkUnit } from './_roleTestUtils'

describe('Global Rule: stunned Tank loses taunt', () => {
  it('a healthy Tank carries the taunt threat term; a stunned Tank does not', () => {
    const tank = mkUnit({ id: 't', role: 'Tank' })
    const stunnedTank = mkUnit({ id: 't2', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never] })
    expect(threatScore(tank)).toBeGreaterThan(threatScore(stunnedTank))
    // stunned tank's score is just atk+spd (no +tauntBonus)
    expect(threatScore(stunnedTank)).toBeLessThan(1000)
  })
})
