import { describe, it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'
import type { LogEntry } from '@/types'

const names = { 'left:a': 'Aaa' }
const skip = { turn: 3, actorId: 'a', actorSide: 'left', action: 'Stordito', type: 'system', flags: [] } as unknown as LogEntry

it('defaults to stun copy', () => {
  expect(describeEntry(skip, names)).toMatch(/stordito e salta il turno/)
})
it('uses freeze copy when controlKind is freeze', () => {
  expect(describeEntry(skip, names, 'freeze')).toMatch(/congelato e salta il turno/)
})
it('uses silence copy when controlKind is silence', () => {
  expect(describeEntry(skip, names, 'silence')).toMatch(/silenziato/)
})
