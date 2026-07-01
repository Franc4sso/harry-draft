import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { menaceForLevel } from '@/game/engine/resolvers/combat'

// Regression guard for the "enemies crushed to 5-13% of their real stats" bug:
// menaceForLevel used to derive a NEGATIVE menace from the (real, always >=2)
// enemy level, which toBattleUnits applied as a SECOND multiplier on top of the
// already-leveled stats (Math.max(0, 1 + menacePct) ~= 0.05-0.13). Menace has been
// removed entirely (menaceForLevel now always returns 0), so an enemy's battle
// stats must equal its leveled stats exactly (multiplier 1.0) — difficulty comes
// only from level growth + draft budget.
describe('enemy stats are NOT crushed by menace (menace removed)', () => {
  it('menaceForLevel always returns 0, for any level', () => {
    expect(menaceForLevel(1)).toBe(0)
    expect(menaceForLevel(2)).toBe(0)
    expect(menaceForLevel(6)).toBe(0)
    expect(menaceForLevel(10)).toBe(0)
  })

  it('an area-0 normal enemy carries its FULL leveled stats in battle (statMult 1.0)', () => {
    const { battle: pkg } = buildBattlePackage('enemy-full-stats-seed', 0, 0, 'battle')
    const leveled = battleReadyTeam(pkg.enemyTeam)
    const units = toBattleUnits(leveled, 'right', [], [], menaceForLevel(pkg.enemyLevel))

    expect(leveled.length).toBeGreaterThan(0)
    for (let i = 0; i < leveled.length; i++) {
      const dw = leveled[i]!
      const u = units[i]!
      // Full leveled stats, no crushing multiplier applied.
      expect(u.buffedStats.atk).toBe(dw.stats.atk)
      expect(u.buffedStats.def).toBe(dw.stats.def)
      expect(u.maxHp).toBe(dw.stats.hp)
      expect(u.buffedStats.spd).toBe(dw.stats.spd)
    }
  })

  it('area-0 boss (Il Muro) and final boss also carry full leveled stats (no finalBossMenace)', () => {
    const { battle: bossPkg } = buildBattlePackage('enemy-full-stats-seed-2', 0, 3, 'boss')
    const bossLeveled = battleReadyTeam(bossPkg.enemyTeam)
    const bossUnits = toBattleUnits(bossLeveled, 'right', [], [], 0)
    for (let i = 0; i < bossLeveled.length; i++) {
      expect(bossUnits[i]!.buffedStats.atk).toBe(bossLeveled[i]!.stats.atk)
    }

    const { battle: finalPkg } = buildBattlePackage('enemy-full-stats-seed-3', 2, 4, 'boss')
    const finalLeveled = battleReadyTeam(finalPkg.enemyTeam)
    const finalUnits = toBattleUnits(finalLeveled, 'right', [], [], 0)
    for (let i = 0; i < finalLeveled.length; i++) {
      expect(finalUnits[i]!.buffedStats.atk).toBe(finalLeveled[i]!.stats.atk)
    }
  })
})
