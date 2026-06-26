import { describe, it, expect } from 'vitest'
import { selectEnemyRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

describe('selectEnemyRelics', () => {
  it('returns the requested count of distinct relics, deterministically', () => {
    const a = selectEnemyRelics(createRng('s'), 3)
    const b = selectEnemyRelics(createRng('s'), 3)
    expect(a.length).toBe(3)
    expect(new Set(a.map(r => r.relic.id)).size).toBe(3) // distinct
    expect(a.map(r => r.relic.id)).toEqual(b.map(r => r.relic.id)) // deterministic
    expect(a[0]!.stageObtained).toBe(0)
  })

  it('never returns more relics than exist in the pool', () => {
    const huge = selectEnemyRelics(createRng('s'), 9999)
    expect(new Set(huge.map(r => r.relic.id)).size).toBe(huge.length)
  })
})
