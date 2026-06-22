import { describe, it, expect } from 'vitest'
import { createDraftPool, generateScreen, commitPick } from '@/game/engine/draft'
import { createRng } from '@/game/engine/rng'
import type { Tier } from '@/types'

describe('draft', () => {
  it('returns exactly 5 options', () => {
    const screen = generateScreen(createRng(1), createDraftPool(), [], 0)
    expect(screen).toHaveLength(5)
  })
  it('never shows more than one Tier 1 per screen', () => {
    for (let seed = 0; seed < 50; seed++) {
      const screen = generateScreen(createRng(seed), createDraftPool(), [], 0)
      expect(screen.filter(w => w.tier === 1).length).toBeLessThanOrEqual(1)
    }
  })
  it('guarantees at least one Tier <=2 per screen', () => {
    for (let seed = 0; seed < 50; seed++) {
      const screen = generateScreen(createRng(seed), createDraftPool(), [], 0)
      expect(screen.some(w => w.tier <= 2)).toBe(true)
    }
  })
  it('applies pity: screen 3 has a Tier <=2 when none picked yet', () => {
    const pickedTiers: Tier[] = [4, 4]
    const screen = generateScreen(createRng(11), createDraftPool(), pickedTiers, 2)
    expect(screen.some(w => w.tier <= 2)).toBe(true)
  })
  it('is deterministic per seed', () => {
    const a = generateScreen(createRng(8), createDraftPool(), [], 0).map(w => w.id)
    const b = generateScreen(createRng(8), createDraftPool(), [], 0).map(w => w.id)
    expect(a).toEqual(b)
  })
  it('does not mutate the input pool', () => {
    const pool = createDraftPool()
    const originalLength = pool.length
    const originalIds = pool.map(w => w.id)
    generateScreen(createRng(3), pool, [], 0)
    expect(pool).toHaveLength(originalLength)
    expect(pool.map(w => w.id)).toEqual(originalIds)
  })
  it('commitPick removes all shown options from the pool', () => {
    const pool = createDraftPool()
    const screen = generateScreen(createRng(2), pool, [], 0)
    const next = commitPick(pool, screen, screen[0]!.id)
    for (const w of screen) expect(next.find(p => p.id === w.id)).toBeUndefined()
    expect(next.length).toBe(pool.length - screen.length)
  })
})
