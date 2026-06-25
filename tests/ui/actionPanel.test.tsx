import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActionPanel } from '@/components/battle/ActionPanel'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const harry: ReplayUnit = {
  key: 'left:harry', side: 'left', id: 'harry', name: 'Harry Potter',
  house: 'Grifondoro', role: 'Attaccante', tier: 1, maxHp: 100,
  atk: 50, def: 40, spd: 30, baseAtk: 50, baseDef: 40, baseSpd: 30,
  spell: { id: 'stupeficium', name: 'Stupeficium', cooldown: 1 },
}
const draco: ReplayUnit = {
  key: 'right:draco', side: 'right', id: 'draco', name: 'Draco Malfoy',
  house: 'Serpeverde', role: 'Attaccante', tier: 1, maxHp: 100,
  atk: 50, def: 40, spd: 30, baseAtk: 50, baseDef: 40, baseSpd: 30,
  spell: { id: 'sectumsempra', name: 'Sectumsempra', cooldown: 2 },
}
const units = [harry, draco]

function panel() {
  return screen.getByTestId('action-panel')
}

describe('ActionPanel', () => {
  it('renders attacker, spell, target and a red damage result', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 24, flags: [],
    }
    render(<ActionPanel entry={e} units={units} />)
    const p = panel()
    expect(p.querySelector('[data-role="attacker"]')!.textContent).toContain('Harry Potter')
    expect(p.querySelector('[data-role="spell"]')!.textContent).toContain('Stupeficium')
    expect(p.querySelector('[data-role="target"]')!.textContent).toContain('Draco Malfoy')
    const result = p.querySelector('[data-role="result"]')!
    expect(result.getAttribute('data-tone')).toBe('damage')
    expect(result.textContent).toContain('-24')
  })

  it('renders a green heal result with a positive number', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Episkey',
      targetId: 'harry', targetSide: 'left', type: 'Cura', value: 30, flags: ['heal'],
    }
    render(<ActionPanel entry={e} units={units} />)
    const result = panel().querySelector('[data-role="result"]')!
    expect(result.getAttribute('data-tone')).toBe('heal')
    expect(result.textContent).toContain('+30')
    expect(result.className).toContain('text-emerald-300')
  })

  it('renders a dim grey dodge result', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 0, flags: ['dodge'],
    }
    render(<ActionPanel entry={e} units={units} />)
    const result = panel().querySelector('[data-role="result"]')!
    expect(result.getAttribute('data-tone')).toBe('dodge')
    expect(result.textContent).toMatch(/schivato/i)
  })

  it('renders a gold crit result combined with the number', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Sectumsempra',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 40, flags: ['crit'],
    }
    render(<ActionPanel entry={e} units={units} />)
    const result = panel().querySelector('[data-role="result"]')!
    expect(result.getAttribute('data-tone')).toBe('crit')
    expect(result.textContent).toContain('-40')
    expect(result.textContent).toMatch(/critico/i)
    expect(result.className).toContain('text-amber-300')
  })

  it('renders a sky block result', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 0, flags: ['block'],
    }
    render(<ActionPanel entry={e} units={units} />)
    const result = panel().querySelector('[data-role="result"]')!
    expect(result.getAttribute('data-tone')).toBe('block')
    expect(result.textContent).toMatch(/bloccato/i)
  })

  it('degrades on a system/no-target entry: actor text, no target/arrow', () => {
    const e: LogEntry = {
      turn: 2, actorId: 'harry', actorSide: 'left', action: 'KO',
      type: 'system', flags: ['kill'],
    }
    render(<ActionPanel entry={e} units={units} />)
    const p = panel()
    expect(p.querySelector('[data-role="target"]')).toBeNull()
    expect(p.querySelector('[data-role="spell"]')).toBeNull()
    expect(p.textContent).toMatch(/harry/i)
  })

  it('renders a calm placeholder for a null entry', () => {
    render(<ActionPanel entry={null} units={units} />)
    const p = panel()
    expect(p).toBeInTheDocument()
    expect(p.querySelector('[data-role="target"]')).toBeNull()
  })

  it('renders a plain Italian narration sentence for a damage action', () => {
    const dmgEntry: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Expelliarmus',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 30, flags: [],
    }
    render(<ActionPanel entry={dmgEntry} units={units} />)
    const narration = screen.getByRole('note')
    expect(narration.textContent).toMatch(/Expelliarmus/)
    expect(narration.textContent).toMatch(/30/)
  })
})
