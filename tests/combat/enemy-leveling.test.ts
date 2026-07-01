import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { battleReadyTeam } from '@/game/engine/battlePrep'

function statTotal(team: { stats: { hp: number; atk: number; def: number; spd: number } }[]): number {
  return team.reduce((sum, dw) => sum + dw.stats.hp + dw.stats.atk + dw.stats.def + dw.stats.spd, 0)
}

describe('enemy per-level stat growth', () => {
  it('a higher-area (higher-level) enemy team has strictly greater post-prep stats than an area-0 (level-1-ish) team', () => {
    const seed = 'enemy-leveling-seed'
    const low = buildBattlePackage(seed, 0, 0, 'battle').battle
    const high = buildBattlePackage(seed, 2, 0, 'boss').battle

    expect(low.enemyLevel).toBeGreaterThanOrEqual(1)
    expect(high.enemyLevel).toBeGreaterThan(low.enemyLevel)

    // Every enemy carries a level, and it's actually the displayed threat tier.
    for (const dw of low.enemyTeam) expect(dw.level).toBe(low.enemyLevel)
    for (const dw of high.enemyTeam) expect(dw.level).toBe(high.enemyLevel)

    const lowReady = battleReadyTeam(low.enemyTeam)
    const highReady = battleReadyTeam(high.enemyTeam)

    // Post-prep (leveled) stats: a level-N enemy shows level-N stats, so a much
    // higher level team's per-unit average stat total must be strictly greater.
    const lowAvg = statTotal(lowReady) / lowReady.length
    const highAvg = statTotal(highReady) / highReady.length
    expect(highAvg).toBeGreaterThan(lowAvg)
  })
})
