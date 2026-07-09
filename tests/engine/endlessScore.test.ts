import { describe, it, expect } from 'vitest'
import { endlessScore } from '@/game/engine/endlessScore'
import { BALANCE } from '@/data/constants'

const P = BALANCE.endless.pointsPerFloor

describe('endlessScore', () => {
  it('base is depth × pointsPerFloor when no style bonus', () => {
    expect(endlessScore({ floorsCleared: 10, eliteKills: 0, bossKills: 0, hpFraction: 0 }))
      .toBe(10 * P)
  })

  it('is monotonic in depth (more floors never lowers score)', () => {
    const a = endlessScore({ floorsCleared: 10, eliteKills: 3, bossKills: 1, hpFraction: 0.5 })
    const b = endlessScore({ floorsCleared: 11, eliteKills: 3, bossKills: 1, hpFraction: 0.5 })
    expect(b).toBeGreaterThan(a)
  })

  it('rewards kills and preserved HP as multiplicative style bonus', () => {
    const plain = endlessScore({ floorsCleared: 10, eliteKills: 0, bossKills: 0, hpFraction: 0 })
    const styled = endlessScore({ floorsCleared: 10, eliteKills: 4, bossKills: 2, hpFraction: 1 })
    expect(styled).toBeGreaterThan(plain)
  })

  it('is deterministic (same input → same output)', () => {
    const i = { floorsCleared: 7, eliteKills: 2, bossKills: 1, hpFraction: 0.3 }
    expect(endlessScore(i)).toBe(endlessScore(i))
  })
})
