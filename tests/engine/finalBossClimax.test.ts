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
// Strong-final-boss slice DONE 2026-07-01 (guard sweeps + tripwire pass):
//   finalBossMenace locked at -0.34, statMult = 0.66 (raised from 0.616).
//   campaignBalanceB winRate: 0.1667 (headroom 0.0167 above the 0.15 floor).
//   Boss is stronger than the old pushover (0.616→0.66) but still BELOW parity (1.08).
//   Archetype sweeps post-raise: veleno=0.567, esecuzione=0.792, scudiRigen=0.142,
//   magieOscure=0.733 (all above floor 0.05).
//   Raising the boss alone is winRate-expensive (0.2000→0.1667 per +0.044 menace);
//   full parity DEFERRED to a player-power/scripted-boss slice — flat menace lever too costly.
//   Serpeverde house-scissor also remains a separate future slice.
//   Tripwire (second test below) still PASSES: 0.66 < 1.08 — no assertion change made.
//
// Full area-boss PARITY (1 + finalBossMenace >= 1 + menaceForLevel(levelMax)) is DEFERRED:
//   NOTE (2026-07-01 snowball pass): menaceOffset -0.75→-1.00 lowered menaceForLevel(10) from 0.33 to 0.08,
//   so the area-boss parity target dropped from statMult ~1.33 to ~1.08. A future final-boss-raise
//   slice should calibrate against ~1.08, NOT 1.33 — the old figure is obsolete after this pass.
//   parity would require statMult ~1.08, collapsing campaign completion to ~2.5%.
//   Parity is pending a player-power pass — see:
//     docs/superpowers/specs/2026-06-30-strong-final-boss-design.md
//     docs/superpowers/remaining-work.md (backlog item #1)

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
