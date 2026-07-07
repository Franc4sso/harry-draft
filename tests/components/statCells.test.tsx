import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCell, STAT_CELLS } from '@/components/cards/statCells'

describe('StatCell', () => {
  it('renders label and value', () => {
    render(<StatCell label="HP" value={80} max={100} color="#7CFC9B" />)
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })
  it('STAT_CELLS covers the four combat stats', () => {
    expect(STAT_CELLS.map((c) => c.label)).toEqual(['HP', 'ATK', 'DIF', 'VEL'])
  })
})
