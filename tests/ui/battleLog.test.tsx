import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { describeEntry, BattleLog } from '@/components/battle/BattleLog'
import type { LogEntry } from '@/types'

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

describe('BattleLog full scrollable log', () => {
  function entries(n: number): LogEntry[] {
    return Array.from({ length: n }, (_, i) => ({
      turn: i + 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: i + 1, flags: [],
    } as LogEntry))
  }

  it('renders ALL entries, not just the last 7, when given more than 7', () => {
    const n = 12
    render(<BattleLog entries={entries(n)} units={[]} />)
    const items = screen.getAllByText(/lancia Stupeficium/i)
    expect(items).toHaveLength(n)
    // the earliest entry (turn 1) must still be present
    expect(screen.getByText(/T1\b/)).toBeInTheDocument()
  })

  it('container is scrollable (max-h + overflow-y-auto) rather than clipped', () => {
    const { container } = render(<BattleLog entries={entries(12)} units={[]} />)
    const box = container.firstElementChild as HTMLElement
    expect(box.className).toMatch(/overflow-y-auto/)
    expect(box.className).not.toMatch(/overflow-hidden/)
  })
})
