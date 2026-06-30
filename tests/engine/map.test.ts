// tests/engine/map.test.ts
import { describe, it, expect } from 'vitest'
import { nodeDepth } from '@/game/engine/map'

describe('nodeDepth', () => {
  it('parses the floor index from the id', () => {
    expect(nodeDepth('f0n0')).toBe(0)
    expect(nodeDepth('f3n1')).toBe(3)
    expect(nodeDepth('f12n0')).toBe(12)
  })
})
