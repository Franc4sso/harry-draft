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

describe('describeEntry MIASMA/UNTORE narration', () => {
  // Task 4 aggiunse queste righe di log senza dar loro una frase propria: cadevano nel
  // fallback generico e producevano "dying lancia Miasma su heir" — un nemico MORTO che
  // "lancia" un incantesimo. Qui inchiodiamo la narrazione corretta.
  it('MIASMA: il veleno del cadavere si propaga, nessuno "lancia" niente', () => {
    const entry = {
      turn: 4, actorId: 'dying', actorSide: 'right', action: 'Miasma',
      targetId: 'heir', targetSide: 'right', type: 'system', flags: ['duo'], duoId: 'miasma',
    } as any
    const out = describeEntry(entry, { 'right:dying': 'Nemico Morente', 'right:heir': 'Erede' })
    expect(out.toLowerCase()).not.toContain('lancia')
    expect(out).toContain('Erede')
  })

  it('UNTORE: una cura sputa una dose di veleno sul bersaglio nemico', () => {
    const entry = {
      turn: 5, actorId: 'sup', actorSide: 'left', action: 'Untore',
      targetId: 'foe', targetSide: 'right', type: 'system', flags: ['duo'], duoId: 'untore',
    } as any
    const out = describeEntry(entry, { 'left:sup': 'Supporto', 'right:foe': 'Nemico' })
    expect(out.toLowerCase()).not.toContain('lancia')
    expect(out).toContain('Nemico')
  })

  it('MURO VIVENTE: il tank riflette danno sull\'attaccante nemico', () => {
    const entry = {
      turn: 1, actorId: 'tank', actorSide: 'left', action: 'MuroVivente',
      targetId: 'enemy', targetSide: 'right', type: 'system', value: 12, flags: ['duo'], duoId: 'muro-vivente',
    } as any
    const out = describeEntry(entry, { 'left:tank': 'Tank', 'right:enemy': 'Enemy' })
    expect(out).toBe('Il muro di Tank riflette 12 su Enemy')
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
