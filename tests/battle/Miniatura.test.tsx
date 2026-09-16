import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Miniatura } from '@/components/battle/Miniatura'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const u = (over: Partial<ReplayUnit> = {}): ReplayUnit =>
  ({ key: 'right:draco', id: 'draco', name: 'Draco Malfoy', side: 'right',
     house: 'Serpeverde', maxHp: 90, spd: 18, ...over } as ReplayUnit)
const fx = (k: string): ActiveEffect => ({ kind: k, statusId: k, remaining: 2, stacks: 1 } as unknown as ActiveEffect)

describe('Miniatura', () => {
  it('mostra nome e vita, e nient altro di pesante', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[]} />)
    expect(screen.getByTestId('miniatura')).toHaveTextContent('Draco Malfoy')
    expect(screen.getByTestId('miniatura-hp').style.width).toBe('50%')
    // niente banda statistiche né riga incantesimo: è la ragione per cui esiste
    expect(screen.queryByTestId('stat-band')).toBeNull()
    expect(screen.queryByTestId('spell-line')).toBeNull()
  })

  it('mostra le pillole di stato anche in miniatura', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[fx('veleno')]} />)
    expect(screen.getAllByTestId('status-pip')).toHaveLength(1)
  })

  it('smorzata quando la sua unità è in scena come duellante', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[]} dimmed />)
    expect(screen.getByTestId('miniatura')).toHaveAttribute('data-dimmed', 'true')
  })

  it('un caduto resta al suo posto, marcato', () => {
    render(<Miniatura unit={u()} hp={0} maxHp={90} effects={[]} dead />)
    expect(screen.getByTestId('miniatura')).toHaveAttribute('data-dead', 'true')
  })

  it('porta la chiave dell unità', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[]} />)
    expect(screen.getByTestId('miniatura')).toHaveAttribute('data-unit-key', 'right:draco')
  })
})
