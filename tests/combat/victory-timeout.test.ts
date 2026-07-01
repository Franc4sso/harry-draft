import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'

function team(rng = createRng(1), n = 5) {
  return WIZARDS.slice(0, 200).filter((_, i) => i % 2 === 0).slice(0, n).map(w => draftWizard(rng, w))
}

describe('BattleResult.timedOut', () => {
  it('is set true when the sim ends by turnCap with both sides alive', () => {
    // Force an early turnCap so a normal matchup is cut off long before either side
    // is wiped out — a genuine "both sides still alive at the cap" stalemate, without
    // fighting the anti-stall fatigue mechanic (which otherwise guarantees convergence
    // well before turn 100). Restore the real cap immediately after so no other test
    // observes the mutation.
    // BALANCE is declared `as const` (readonly at the type level) but is a plain,
    // mutable object at runtime; cast through `as { turnCap: number }` to flip the
    // cap for this test only, then restore it in `finally`.
    const combat = BALANCE.combat as unknown as { turnCap: number }
    const originalTurnCap = combat.turnCap
    combat.turnCap = 2
    let res
    try {
      const left = team(createRng(1))
      const right = team(createRng(2))
      res = simulateBattle(left, right, createRng(3))
    } finally {
      combat.turnCap = originalTurnCap
    }
    expect(res.turns).toBe(2)
    const leftAlive = res.finalSnapshot.some(u => u.side === 'left' && u.alive)
    const rightAlive = res.finalSnapshot.some(u => u.side === 'right' && u.alive)
    expect(leftAlive).toBe(true)
    expect(rightAlive).toBe(true)
    expect(res.timedOut).toBe(true)
  })

  it('is set false when the sim ends by one side being wiped out before turnCap', () => {
    const left = team(createRng(1))
    const right = team(createRng(2))
    const res = simulateBattle(left, right, createRng(3))
    const leftAlive = res.finalSnapshot.some(u => u.side === 'left' && u.alive)
    const rightAlive = res.finalSnapshot.some(u => u.side === 'right' && u.alive)
    expect(leftAlive && rightAlive).toBe(false)
    expect(res.timedOut).toBe(false)
  })
})
