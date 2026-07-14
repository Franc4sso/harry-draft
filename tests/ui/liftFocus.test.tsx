import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LiftFocus } from '@/components/battle/LiftFocus'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const cho = {
  key: 'left:cho', id: 'cho', name: 'Cho', side: 'left', house: 'Corvonero', role: 'Controllo', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's1', name: 'S1', cooldown: 0 },
} as unknown as ReplayUnit

const cedric = {
  key: 'right:cedric', id: 'cedric', name: 'Cedric', side: 'right', house: 'Tassorosso', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's2', name: 'S2', cooldown: 0 },
} as unknown as ReplayUnit

const units: ReplayUnit[] = [cho, cedric]

function killEntry(reason?: LogEntry['reason']): LogEntry {
  return {
    turn: 1, actorId: 'cho', actorSide: 'left', targetId: 'cedric', targetSide: 'right',
    action: 'X', type: 'Attacco', flags: ['kill'], reason, value: 20,
  } as unknown as LogEntry
}

function normalEntry(): LogEntry {
  return {
    turn: 1, actorId: 'cho', actorSide: 'left', targetId: 'cedric', targetSide: 'right',
    action: 'X', type: 'Attacco', flags: [], value: 5,
  } as unknown as LogEntry
}

describe('LiftFocus', () => {
  it("su un colpo che uccide con reason, monta l'overlay + la riga-causa", () => {
    const { container } = render(
      <LiftFocus entry={killEntry('weakest')} frameKey={3} units={units} firstDuo={new Map()} speed={1} />,
    )
    expect(container.querySelector('[data-testid="lift-focus"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="lift-cause"]')).toHaveTextContent(/più debole/i)
  })

  it("su un colpo che uccide SENZA reason, monta l'overlay ma NESSUNA riga-causa", () => {
    const { container } = render(
      <LiftFocus entry={killEntry(undefined)} frameKey={3} units={units} firstDuo={new Map()} speed={1} />,
    )
    expect(container.querySelector('[data-testid="lift-focus"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="lift-cause"]')).toBeNull()
  })

  it('su un frame normale (no kill/crit/duo), NON monta nulla', () => {
    const { container } = render(
      <LiftFocus entry={normalEntry()} frameKey={3} units={units} firstDuo={new Map()} speed={1} />,
    )
    expect(container.querySelector('[data-testid="lift-focus"]')).toBeNull()
  })
})
