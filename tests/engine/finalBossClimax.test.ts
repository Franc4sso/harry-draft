import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'
import { menaceForLevel } from '@/game/engine/resolvers/combat'

// Regression-guard invariant: the final boss must stay meaningfully STRONGER than the
// old pushover (statMult 0.60, finalBossMenace = -0.40). This guards against silent
// regressions where a future calibration silently weakens Voldemort back to the old value.
//
// Moderate buff applied 2026-07-01 (backlog item #5):
//   finalBossMenace raised -0.40 → -0.384, statMult 0.60 → 0.616.
//   The Serpeverde balance tune (Voldemort atk trim) ate into the campaignBalanceB headroom,
//   leaving only 0.0083 above the 0.15 floor — so the raise is modest but real and honest.
//
// Full area-boss PARITY (1 + finalBossMenace >= 1 + menaceForLevel(levelMax)) is DEFERRED:
//   parity would require statMult ~1.33, collapsing campaign completion to ~2.5%.
//   Parity is pending a player-power pass — see:
//     docs/superpowers/specs/2026-06-30-strong-final-boss-design.md
//     docs/superpowers/remaining-work.md (backlog item #5)

describe('final boss climax invariant', () => {
  const finalStatMult = 1 + BALANCE.campaignB.finalBossMenace
  const oldPushoverStatMult = 1 + (-0.40) // the historic pushover baseline — must stay below

  it('final boss is stronger than the old pushover (statMult > 0.60)', () => {
    // Guards: if someone weakens finalBossMenace back to -0.40 or below, this fails.
    expect(finalStatMult).toBeGreaterThan(oldPushoverStatMult)
  })

  // Informational: area-boss parity target (NOT asserted — parity is deferred)
  it('documents area-boss parity target without asserting it (parity deferred)', () => {
    const levelMax = BALANCE.leveling.levelMax
    const areaBossStatMult = 1 + menaceForLevel(levelMax)
    // This gap is intentional and documented — NOT a bug.
    // Parity requires a player-power pass first (see spec above).
    expect(finalStatMult).toBeLessThan(areaBossStatMult) // parity not yet reached — by design
  })
})
