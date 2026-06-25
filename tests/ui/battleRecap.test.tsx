import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleRecap } from '@/components/battle/BattleRecap'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const units = [
  { key: 'left:a', id: 'a', name: 'Aaa', side: 'left' },
  { key: 'left:b', id: 'b', name: 'Bbb', side: 'left' },
] as unknown as ReplayUnit[]
const f = (e: LogEntry | null) => ({ index: 0, entry: e, hp: {}, cooldowns: {}, statusEffects: {} } as unknown as ReplayFrame)
const dmg = (id: string, v: number) => ({ turn: 1, actorId: id, actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'S', type: 'Attacco', value: v, flags: [] } as unknown as LogEntry)

it('renders player rows sorted with the top dealer first', () => {
  render(<BattleRecap frames={[f(null), f(dmg('b', 40)), f(dmg('a', 10))]} units={units} />)
  expect(screen.getByTestId('battle-recap')).toBeInTheDocument()
  const rows = screen.getAllByTestId('battle-recap-row')
  expect(rows[0]).toHaveTextContent('Bbb')
  expect(rows[1]).toHaveTextContent('Aaa')
})
