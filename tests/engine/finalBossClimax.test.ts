import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { battleReadyTeam } from '@/game/engine/battlePrep'

// Regression-guard invariant: the final boss must stay the single strongest fight in the
// campaign. This test's history spans several eras of the difficulty model:
//
//   Pre-growth: enemies carried flat level-1 stats; only a per-kind "menace" stat
//   multiplier (1+menacePct) separated normal/elite/boss/final-boss difficulty.
//
//   Real per-level growth landed (Task 7, 2026-07-01): enemies now genuinely grow with
//   level (a level-N enemy SHOWS level-N stats via `battleReadyTeam` / `leveledStats`,
//   stamped from `enemyLevelFor`). The power proxy became
//     avgLeveledStatTotal × max(0, 1 + menacePct)
//   to account for both terms.
//
//   MENACE REMOVED (2026-07-01, urgent balance fix): menacePct was calibrated NEGATIVE
//   back when enemies had flat level-1 stats. Once growth was added on top, the negative
//   offset became a double nerf — `Math.max(0, 1 + menacePct)` crushed every real enemy
//   level to a 0.05-0.13 stat multiplier (enemies showing "2 attack, 1 defense" in area 0).
//   Menace is now gone entirely (`menaceForLevel` always returns 0; `finalBossMenace` no
//   longer exists in data/constants.ts). The power proxy below is updated to drop the
//   menace term — it is now simply the average leveled stat total, which is exactly what
//   `simulate.ts#toBattleUnits` applies in combat (multiplier 1.0, full leveled stats).
//
//   The final boss remains the single strongest fight by a wide margin on pure leveled
//   stats alone (it's the level cap, levelMax=10, with the largest scripted budget), so
//   the monotonic ordering assertions below continue to hold without any menace term.
describe('final boss climax invariant', () => {
  it('enemy power proxy (avg leveled stat total) is monotonic: normal < elite < area-boss < final boss', () => {
    // This is the REAL power an enemy team brings to a fight (matches simulate.ts#toBattleUnits,
    // which now applies enemies' leveled stats at multiplier 1.0 — no menace term).
    const areasCount = 3 // BALANCE.map.areas, avoids importing BALANCE just for this constant
    const finalArea = areasCount - 1
    const areaBossArea = areasCount - 2 // last non-final area boss
    const seed = 'final-boss-climax-power-proxy-seed'

    function powerProxy(area: number, kind: 'battle' | 'elite' | 'boss'): number {
      const pkg = buildBattlePackage(seed, area, 0, kind).battle
      const ready = battleReadyTeam(pkg.enemyTeam)
      const statTotal = ready.reduce(
        (sum, dw) => sum + dw.stats.hp + dw.stats.atk + dw.stats.def + dw.stats.spd, 0,
      )
      return statTotal / ready.length
    }

    const normalProxy = powerProxy(0, 'battle')
    const eliteProxy = powerProxy(0, 'elite')
    const areaBossProxy = powerProxy(areaBossArea, 'boss')
    const finalBossProxy = powerProxy(finalArea, 'boss')

    // Real growth makes each tier a genuinely harder fight, not just a flat multiplier bump.
    expect(eliteProxy).toBeGreaterThan(normalProxy)
    expect(areaBossProxy).toBeGreaterThan(eliteProxy)
    // The final boss must be the single strongest fight in the campaign.
    expect(finalBossProxy).toBeGreaterThan(areaBossProxy)
  })
})
