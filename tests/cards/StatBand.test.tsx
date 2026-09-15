import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatBand } from '@/components/cards/parts/StatBand'

const stats = { hp: 78, atk: 19, def: 14, spd: 28 }

describe('StatBand', () => {
  it('mostra le quattro statistiche', () => {
    render(<StatBand stats={stats} />)
    for (const v of ['78', '19', '14', '28']) expect(screen.getByText(v)).toBeInTheDocument()
    for (const k of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(k)).toBeInTheDocument()
  })

  it('con currentHp mostra vita attuale e massima', () => {
    render(<StatBand stats={stats} currentHp={49} />)
    expect(screen.getByText('49/78')).toBeInTheDocument()
  })

  it('le quattro celle sono sempre nello stesso ordine', () => {
    render(<StatBand stats={stats} />)
    const keys = [...screen.getByTestId('stat-band').querySelectorAll('[data-stat]')]
      .map(e => e.getAttribute('data-stat'))
    expect(keys).toEqual(['hp', 'atk', 'def', 'spd'])
  })
})
