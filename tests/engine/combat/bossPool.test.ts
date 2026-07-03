import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { BOSSES_BY_AREA } from '@/data/bosses'

describe('seeded boss pool', () => {
  it('picks a boss from the area pool, deterministically per seed', () => {
    const a = buildBattlePackage('seed-A', 1, 4, 'boss')
    const b = buildBattlePackage('seed-A', 1, 4, 'boss')
    expect(a.preview.bossName).toBe(b.preview.bossName) // deterministic
    const names = BOSSES_BY_AREA[1]!.map(x => x.name)
    expect(names).toContain(a.preview.bossName)
  })

  it('different seeds can select different area-1 bosses', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `s-${i}`)
    const picked = new Set(seeds.map(s => buildBattlePackage(s, 1, 4, 'boss').preview.bossName))
    expect(picked.size).toBeGreaterThan(1) // pool actually varies
  })

  it('picks a boss from the area pool for area 0 (Muro) and the final area (Voldemort)', () => {
    const muro = buildBattlePackage('seed-M', 0, 4, 'boss')
    expect(BOSSES_BY_AREA[0]!.map(x => x.name)).toContain(muro.preview.bossName)

    const finalArea = BOSSES_BY_AREA.length - 1
    const finalBoss = buildBattlePackage('seed-F', finalArea, 4, 'boss')
    expect(BOSSES_BY_AREA[finalArea]!.map(x => x.name)).toContain(finalBoss.preview.bossName)
  })
})
