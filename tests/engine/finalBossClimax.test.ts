import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { menaceForLevel } from '@/game/engine/resolvers/combat'

// Regression-guard invariant: the final boss must stay the single strongest fight in the
// campaign. Originally (pre-growth) this was checked via a flat-menace statMult comparison
// against the old pushover baseline (finalBossMenace = -0.40); see Task 7 note below for why
// that check was replaced with a real leveled-stat power-proxy comparison.
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
// Real per-level growth landed (Task 7, 2026-07-01) — the OLD "deferred climax gap" premise
// is RESOLVED, not just re-tuned:
//   Before this task, enemies of every kind carried flat level-1 stats and only the menace
//   multiplier (1+menacePct) separated normal/elite/boss/final-boss difficulty. Comparing
//   `1+finalBossMenace` against `1+menaceForLevel(levelMax)` was the only power proxy
//   available, and under that flat-menace-only model the final boss was intentionally
//   calibrated BELOW area-boss-at-levelMax "parity" (statMult ~1.08) pending a future
//   player-power pass (see docs/superpowers/specs/2026-06-30-strong-final-boss-design.md).
//
//   Enemies now genuinely grow with level (a level-N enemy SHOWS level-N stats via
//   `battleReadyTeam` / `leveledStats`, stamped from `enemyLevelFor`), so the flat-menace
//   comparison above is stale — it ignores the (much larger) leveled-stat-total term.
//   The real per-unit power proxy an enemy brings to a fight is
//     avgLeveledStatTotal × max(0, 1 + menacePct)
//   which is what `simulate.ts#toBattleUnits` actually applies in combat. Measured with the
//   re-tuned constants (menacePerLevel 0.12→0.01, menaceOffset -1.00→-0.96,
//   finalBossMenace -0.34→-0.43, held to keep campaignBalanceB at the 0.1667 hard floor):
//     normal (area 0):      proxy ≈ 6.2
//     elite  (area 0):      proxy ≈ 9.9
//     area-boss (area 1):   proxy ≈ 18.8
//     final boss (area 2):  proxy ≈ 188.7
//   The final boss is now correctly the single strongest fight in the campaign by a wide
//   margin — the old "deferred climax gap" is resolved by real growth, not by a menace hack.
//   The assertions below verify this ordering directly (not just the historic flat-menace
//   floor), so they will fail if a future change breaks monotonic difficulty.

describe('final boss climax invariant', () => {
  // NOTE: `finalBossMenace` (-0.34 → -0.43, Task 7) is now LOWER than the historic pushover
  // value (-0.40) in raw flat-multiplier terms. That is expected and correct, not a regression:
  // under real per-level growth the final boss's leveled stat total is far larger than before
  // (levelMax vs the old flat level-1 base), so the menace multiplier needed to hold
  // campaignBalanceB at the 0.15 floor is smaller even though the boss itself hits much harder.
  // A flat-menace-vs-flat-menace comparison is therefore no longer a meaningful "is the boss
  // stronger" guard — see the real power-proxy test below for that. This test instead pins the
  // exact tuned menace value so a silent, undocumented drift is caught.
  it('finalBossMenace matches the Task 7 tuned value (-0.43)', () => {
    expect(BALANCE.campaignB.finalBossMenace).toBeCloseTo(-0.43, 5)
  })

  it('enemy power proxy (leveled stat total x menace) is monotonic: normal < elite < area-boss < final boss', () => {
    // This is the REAL power an enemy team brings to a fight (matches simulate.ts#toBattleUnits:
    // leveled stats scaled by max(0, 1+menacePct)), not just the flat menace multiplier — so it
    // actually reflects Task 7's per-level stat growth instead of the pre-growth flat proxy.
    const cb = BALANCE.campaignB
    const areasCount = BALANCE.map.areas
    const finalArea = areasCount - 1
    const areaBossArea = areasCount - 2 // last non-final area boss
    const seed = 'final-boss-climax-power-proxy-seed'

    function powerProxy(area: number, kind: 'battle' | 'elite' | 'boss'): number {
      const pkg = buildBattlePackage(seed, area, 0, kind).battle
      const ready = battleReadyTeam(pkg.enemyTeam)
      const statTotal = ready.reduce(
        (sum, dw) => sum + dw.stats.hp + dw.stats.atk + dw.stats.def + dw.stats.spd, 0,
      )
      const avgStat = statTotal / ready.length
      const isFinalBoss = kind === 'boss' && area >= finalArea
      const menace = isFinalBoss ? cb.finalBossMenace : menaceForLevel(pkg.enemyLevel)
      return avgStat * Math.max(0, 1 + menace)
    }

    const normalProxy = powerProxy(0, 'battle')
    const eliteProxy = powerProxy(0, 'elite')
    const areaBossProxy = powerProxy(areaBossArea, 'boss')
    const finalBossProxy = powerProxy(finalArea, 'boss')

    // Real growth makes each tier a genuinely harder fight, not just a flat multiplier bump.
    expect(eliteProxy).toBeGreaterThan(normalProxy)
    expect(areaBossProxy).toBeGreaterThan(eliteProxy)
    // The final boss must be the single strongest fight in the campaign — this is the
    // corrected replacement for the old "deferred climax gap" assertion.
    expect(finalBossProxy).toBeGreaterThan(areaBossProxy)
  })
})
