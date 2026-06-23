import { describe, it, expect } from 'vitest'
import { floatFor } from '@/components/battle/damageFloat'
import type { LogEntry } from '@/types'

function entry(partial: Partial<LogEntry>): LogEntry {
  return { turn: 1, actorId: 'a', action: 'X', type: 'Attacco', flags: [], ...partial }
}

describe('floatFor', () => {
  it('shows negative damage for a damaging hit', () => {
    expect(floatFor(entry({ type: 'Attacco', value: 24, targetId: 'b' }))).toEqual({
      text: '-24', tone: 'damage',
    })
  })

  it('marks a critical hit with its own tone', () => {
    expect(floatFor(entry({ value: 31, targetId: 'b', flags: ['crit'] }))).toEqual({
      text: '-31', tone: 'crit',
    })
  })

  it('shows positive healing', () => {
    expect(floatFor(entry({ type: 'Cura', value: 28, targetId: 'b', flags: ['heal'] }))).toEqual({
      text: '+28', tone: 'heal',
    })
  })

  it('shows a dodge instead of a number', () => {
    expect(floatFor(entry({ value: 0, targetId: 'b', flags: ['dodge'] }))).toEqual({
      text: 'Schiva', tone: 'dodge',
    })
  })

  it('returns null for a self-buff / defense with no target damage', () => {
    expect(floatFor(entry({ type: 'Difesa', action: 'Protego' }))).toBeNull()
  })

  it('returns null for system entries and KO narration', () => {
    expect(floatFor(entry({ action: 'KO', type: 'system' }))).toBeNull()
    expect(floatFor(null)).toBeNull()
  })
})
