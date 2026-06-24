import { describe, it, expect } from 'vitest'
import { archetypeFor, archetypeStyle } from '@/lib/spellArchetype'
import type { LogEntry } from '@/types'

const base: LogEntry = { turn: 1, actorId: 'a', actorSide: 'left', action: 'X', type: 'Attacco', flags: [] }

describe('archetypeFor', () => {
  it('maps a heal flag to heal', () => {
    expect(archetypeFor({ ...base, type: 'Cura', flags: ['heal'] })).toBe('heal')
  })
  it('maps a stun flag to stun', () => {
    expect(archetypeFor({ ...base, flags: ['stun'] })).toBe('stun')
  })
  it('maps a Difesa / block to shield', () => {
    expect(archetypeFor({ ...base, type: 'Difesa', flags: [] })).toBe('shield')
    expect(archetypeFor({ ...base, type: 'Attacco', flags: ['block'] })).toBe('shield')
  })
  it('maps a dot flag to fire', () => {
    expect(archetypeFor({ ...base, flags: ['dot'] })).toBe('fire')
  })
  it('recognizes the killing curse by name as dark', () => {
    expect(archetypeFor({ ...base, action: 'Avada Kedavra' })).toBe('dark')
  })
  it('recognizes the disarm by name', () => {
    expect(archetypeFor({ ...base, action: 'Expelliarmus' })).toBe('disarm')
  })
  it('falls back to a straight beam for a plain attack', () => {
    expect(archetypeFor({ ...base, type: 'Attacco', flags: [] })).toBe('beam')
  })
  it('returns none for a system entry with no target', () => {
    expect(archetypeFor({ ...base, type: 'system', action: 'KO', flags: ['kill'] })).toBe('none')
  })
  it('returns none for null', () => {
    expect(archetypeFor(null)).toBe('none')
  })
})

describe('archetypeStyle', () => {
  it('gives every archetype a color and a shape', () => {
    for (const a of ['beam', 'curse', 'fire', 'dark', 'shield', 'heal', 'stun', 'disarm'] as const) {
      const s = archetypeStyle(a)
      expect(s.color).toMatch(/^#|rgb/)
      expect(['bolt', 'orb', 'wave', 'burst']).toContain(s.shape)
    }
  })
})
