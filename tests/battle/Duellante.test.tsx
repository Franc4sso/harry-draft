import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Duellante } from '@/components/battle/Duellante'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const u = (over: Partial<ReplayUnit> = {}): ReplayUnit =>
  ({ key: 'left:harry', id: 'harry', name: 'Harry Potter', side: 'left',
     house: 'Grifondoro', maxHp: 100, spd: 20, ...over } as ReplayUnit)

const fx = (kind: string): ActiveEffect =>
  ({ kind, statusId: kind, remaining: 2, stacks: 1 } as unknown as ActiveEffect)

describe('Duellante', () => {
  it('mostra il nome del mago', () => {
    render(<Duellante unit={u()} hp={80} maxHp={100} role="attore" effects={[]} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
  })

  it('dice se AGISCE o SUBISCE', () => {
    const { rerender } = render(<Duellante unit={u()} hp={80} maxHp={100} role="attore" effects={[]} />)
    expect(screen.getByTestId('duellante')).toHaveTextContent(/agisce/i)
    rerender(<Duellante unit={u()} hp={80} maxHp={100} role="bersaglio" effects={[]} />)
    expect(screen.getByTestId('duellante')).toHaveTextContent(/subisce/i)
  })

  it('la barra vita riflette gli HP', () => {
    render(<Duellante unit={u()} hp={25} maxHp={100} role="bersaglio" effects={[]} />)
    expect(screen.getByTestId('duellante-hp').style.width).toBe('25%')
  })

  it('mostra le pillole di stato', () => {
    render(<Duellante unit={u()} hp={80} maxHp={100} role="bersaglio" effects={[fx('veleno'), fx('stun')]} />)
    expect(screen.getAllByTestId('status-pip')).toHaveLength(2)
  })

  it('un caduto resta in scena, marcato', () => {
    render(<Duellante unit={u()} hp={0} maxHp={100} role="bersaglio" effects={[]} dead />)
    expect(screen.getByTestId('duellante')).toHaveAttribute('data-dead', 'true')
    expect(screen.getByTestId('duellante-hp').style.width).toBe('0%')
  })

  it('porta la chiave dell unità, che il livello effetti usa per misurare', () => {
    render(<Duellante unit={u()} hp={80} maxHp={100} role="attore" effects={[]} />)
    expect(screen.getByTestId('duellante')).toHaveAttribute('data-unit-key', 'left:harry')
  })
})
