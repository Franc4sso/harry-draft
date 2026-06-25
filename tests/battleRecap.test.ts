import { describe, it, expect } from 'vitest'
import { recapTotals } from '@/lib/battleRecap'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const units = [
  { key: 'left:a', id: 'a', name: 'Aaa', side: 'left' },
  { key: 'left:b', id: 'b', name: 'Bbb', side: 'left' },
  { key: 'right:x', id: 'x', name: 'Xxx', side: 'right' },
] as unknown as ReplayUnit[]

function frame(entry: LogEntry | null): ReplayFrame {
  return { index: 0, entry, hp: {}, cooldowns: {}, statusEffects: {} } as unknown as ReplayFrame
}
function dmg(actorId: string, actorSide: 'left'|'right', targetId: string, targetSide: 'left'|'right', value: number, flags: string[] = []): LogEntry {
  return { turn: 1, actorId, actorSide, targetId, targetSide, action: 'S', type: 'Attacco', value, flags } as unknown as LogEntry
}

describe('recapTotals', () => {
  it('attributes damage to the actor and ignores the initial null frame', () => {
    const frames = [frame(null), frame(dmg('a','left','x','right',30))]
    const rows = recapTotals(frames, units, 'left')
    expect(rows.find(r => r.key === 'left:a')!.dealt).toBe(30)
    expect(rows.find(r => r.key === 'left:b')!.dealt).toBe(0)
  })

  it('attributes healing via the heal flag', () => {
    const heal = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'b', targetSide: 'left', action: 'Episkey', type: 'Cura', value: 20, flags: ['heal'] } as unknown as LogEntry
    const rows = recapTotals([frame(null), frame(heal)], units, 'left')
    expect(rows.find(r => r.key === 'left:a')!.healed).toBe(20)
    expect(rows.find(r => r.key === 'left:a')!.dealt).toBe(0)
  })

  it('excludes DoT self-ticks (actor === target) from dealt', () => {
    const dot = { turn: 2, actorId: 'a', actorSide: 'left', targetId: 'a', targetSide: 'left', action: 'Veleno', type: 'Controllo', value: 8, flags: ['dot'] } as unknown as LogEntry
    const rows = recapTotals([frame(null), frame(dot)], units, 'left')
    expect(rows.find(r => r.key === 'left:a')!.dealt).toBe(0)
  })

  it('sorts by dealt+healed descending', () => {
    const frames = [frame(null), frame(dmg('b','left','x','right',50)), frame(dmg('a','left','x','right',10))]
    const rows = recapTotals(frames, units, 'left')
    expect(rows[0]!.key).toBe('left:b')
    expect(rows[1]!.key).toBe('left:a')
  })

  it('only includes the requested side', () => {
    const rows = recapTotals([frame(null)], units, 'left')
    expect(rows.map(r => r.key).sort()).toEqual(['left:a','left:b'])
  })
})
