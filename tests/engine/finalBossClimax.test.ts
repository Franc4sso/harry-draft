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
// Snowball pass completed 2026-07-01 (Task 3+4):
//   growthBudgetPerLevel 0.40 → 0.28, menaceOffset -0.75 → -1.00.
//   campaignBalanceB winRate: 0.2000 (headroom 0.05 above the 0.15 floor).
//   This 0.05 headroom is available for a future finalBossMenace raise (parity slice).
//   All 4 archetype sweeps in band: veleno=0.608, esecuzione=0.800,
//   scudiRigen=0.142, magieOscure=0.742 (floor 0.05 each).
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

  // The final boss is still BELOW area-boss parity — the deferred climax goal. This asserts the
  // current (intentional) gap; when a future player-power pass closes it, this test will flip and
  // signal that the deferred goal is reached and these docs/backlog notes should be updated.
  it('is still below area-boss parity (the deferred climax goal)', () => {
    const levelMax = BALANCE.leveling.levelMax
    const areaBossStatMult = 1 + menaceForLevel(levelMax)
    // Gap is intentional and documented — NOT a bug; parity requires a player-power pass (see spec above).
    expect(finalStatMult).toBeLessThan(areaBossStatMult)
  })
})
