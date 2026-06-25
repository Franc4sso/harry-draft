import { it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'
import type { LogEntry } from '@/types'

const names = { 'left:a': 'Aaa', 'right:x': 'Xxx' }

it('narrates a dodge as a miss', () => {
  const e = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'Stupeficium', type: 'Attacco', value: 0, flags: ['dodge'] } as unknown as LogEntry
  expect(describeEntry(e, names)).toMatch(/schiva/i)
})

it('narrates a damage spell that did nothing (0 dmg, no status) as a failure', () => {
  // A pure-damage Attacco with no value and no status flag = it genuinely failed.
  const e = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'Reducto', type: 'Attacco', value: 0, flags: [] } as unknown as LogEntry
  expect(describeEntry(e, names)).toMatch(/non ha effetto|fallisce/i)
})

it('does NOT call a landed control spell a failure (it applied a stun)', () => {
  // Imperio that landed has the 'stun' flag (and no damage) — a SUCCESS, not a failure.
  const e = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'Imperio', type: 'Controllo', value: 0, flags: ['stun'] } as unknown as LogEntry
  expect(describeEntry(e, names)).not.toMatch(/non ha effetto/i)
})

it('does NOT call a debuff-only control spell a failure', () => {
  // Confundo (spd debuff, no damage, no stun flag) is a Controllo success, not a failure.
  const e = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'Confundo', type: 'Controllo', value: 0, flags: [] } as unknown as LogEntry
  expect(describeEntry(e, names)).not.toMatch(/non ha effetto/i)
})
