import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'

describe('run progression constants', () => {
  it('leveling has sane values', () => {
    const l = BALANCE.leveling
    expect(l.levelMax).toBeGreaterThan(Math.max(...l.milestoneLevels))
    expect(l.autoGrowthPct).toBeGreaterThan(0)
    expect(l.expBattle).toBeGreaterThan(0)
    expect(l.expElite).toBeGreaterThan(l.expBattle)
  })
  it('map area config is coherent', () => {
    const m = BALANCE.map
    expect(m.areas).toBeGreaterThanOrEqual(1)
    expect(m.floorsPerArea).toBeGreaterThanOrEqual(3) // ingresso + almeno 1 medio + boss
    expect(m.eliteMinFloor).toBeGreaterThanOrEqual(1)
    expect(m.eliteMinFloor).toBeLessThanOrEqual(m.floorsPerArea - 2)
  })
  it('recruit offer has a positive offer size', () => {
    expect(BALANCE.recruit.offerSize).toBeGreaterThan(0)
  })
})
