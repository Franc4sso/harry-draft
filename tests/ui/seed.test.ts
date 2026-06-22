import { describe, it, expect } from 'vitest'
import { randomSeed, normalizeSeed } from '@/lib/seed'

describe('seed', () => {
  it('randomSeed is non-empty alphanumeric', () => {
    const s = randomSeed()
    expect(s).toMatch(/^[a-z0-9]+$/)
    expect(s.length).toBeGreaterThanOrEqual(6)
  })
  it('normalizeSeed keeps a provided seed (trimmed)', () => {
    expect(normalizeSeed('  abc123 ')).toBe('abc123')
  })
  it('normalizeSeed generates one when empty/null', () => {
    expect(normalizeSeed('')).toMatch(/^[a-z0-9]+$/)
    expect(normalizeSeed(null)).toMatch(/^[a-z0-9]+$/)
    expect(normalizeSeed(undefined)).toMatch(/^[a-z0-9]+$/)
  })
})
