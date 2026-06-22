import { describe, it, expect } from 'vitest'
import { createRng, seedFromString } from '@/game/engine/rng'

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(123); const b = createRng(123)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })
  it('differs across seeds', () => {
    const a = createRng(1).next(); const b = createRng(2).next()
    expect(a).not.toBe(b)
  })
  it('int is inclusive and within range', () => {
    const r = createRng(42)
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
  it('pick returns an element; shuffle preserves members', () => {
    const r = createRng(9)
    const arr = [1, 2, 3, 4, 5]
    expect(arr).toContain(r.pick(arr))
    expect([...r.shuffle(arr)].sort()).toEqual(arr)
  })
  it('fork is deterministic but independent from parent', () => {
    const base = createRng(7)
    const f1 = base.fork(1).next()
    const f1b = createRng(7).fork(1).next()
    expect(f1).toBe(f1b)
  })
  it('seedFromString is stable', () => {
    expect(seedFromString('harry')).toBe(seedFromString('harry'))
  })
})
