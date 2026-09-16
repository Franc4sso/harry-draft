// tests/battle/CartaCombat.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CartaCombat } from '@/components/battle/CartaCombat'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const u = (o: Partial<ReplayUnit> = {}): ReplayUnit =>
  ({ key: 'left:harry', id: 'harry', name: 'Harry Potter', side: 'left',
     house: 'Grifondoro', maxHp: 120, spd: 23, ...o } as ReplayUnit)
const fx = (id: string, o = {}): ActiveEffect =>
  ({ kind: id, statusId: id, remaining: 2, stacks: 1, ...o } as unknown as ActiveEffect)

describe('CartaCombat', () => {
  it('mostra nome, vita col numero e le tre statistiche', () => {
    render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    expect(screen.getByTestId('carta-hp-testo')).toHaveTextContent('84/120')
    expect(screen.getByTestId('carta-hp')).toHaveStyle({ width: '70%' })
  })

  it('le tre dosi di veleno sono UNA pillola', () => {
    render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[fx('veleno', { stacks: 3 })]} />)
    const pip = screen.getAllByTestId('carta-pillola')
    expect(pip).toHaveLength(1)
    expect(pip[0]).toHaveTextContent('3')
  })

  it('accende la cornice giusta per attore e bersaglio', () => {
    const { rerender } = render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} ruolo="attore" />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-ruolo', 'attore')
    rerender(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} ruolo="bersaglio" />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-ruolo', 'bersaglio')
  })

  it('il caduto resta in campo, marcato', () => {
    render(<CartaCombat unit={u()} hp={0} maxHp={120} effects={[]} stato="caduto" />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-caduto', 'true')
    expect(screen.getByText(/caduto|caduta/i)).toBeInTheDocument()
  })

  it('porta la chiave dell unità, che i VFX usano per ancorarsi', () => {
    render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-unit-key', 'left:harry')
  })

  it('disegna davvero il ritratto, non solo lo importa', () => {
    // In questo progetto una carta passò ogni test e più review mentre il ritratto
    // non veniva montato affatto: i test misuravano, non guardavano.
    const { container } = render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} />)
    expect(container.querySelector('img, svg')).not.toBeNull()
  })
})
