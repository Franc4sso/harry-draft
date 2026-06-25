import { describe, it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'

describe('describeEntry shatter', () => {
  it('appends the ice-break note when the shatter flag is set', () => {
    const entry = {
      turn: 3, actorId: 'harry', actorSide: 'left', action: 'Reducto',
      targetId: 'snape', targetSide: 'right', type: 'Attacco', value: 60,
      flags: ['shatter'],
    } as any
    const out = describeEntry(entry, { 'left:harry': 'Harry', 'right:snape': 'Snape' })
    expect(out).toContain('60 danni')
    expect(out).toContain('infrange il ghiaccio')
  })
})
