import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuoSignalMarks } from '@/components/cards/DuoSignalMarks'
import type { Wizard } from '@/types'

const wiz = (role: string, tags: string[] = []): Wizard =>
  ({ id: 'w', name: 'w', role, house: 'Grifondoro', tags } as unknown as Wizard)

describe('DuoSignalMarks', () => {
  it('renders a Veleno mark for a veleno mage', () => {
    render(<DuoSignalMarks wizard={wiz('Attaccante', ['veleno'])} />)
    expect(screen.getByTestId('duo-signal-marks')).toBeInTheDocument()
    expect(screen.getByText('Veleno')).toBeInTheDocument()
  })
  it('names the taunt signal "Muro" (not "Tank") so it does not echo the role badge', () => {
    render(<DuoSignalMarks wizard={wiz('Tank', [])} />)
    expect(screen.getByText('Muro')).toBeInTheDocument()
    expect(screen.queryByText('Tank')).toBeNull()
  })
  it('renders nothing for a plain attacker', () => {
    const { container } = render(<DuoSignalMarks wizard={wiz('Attaccante', [])} />)
    expect(container.querySelector('[data-testid="duo-signal-marks"]')).toBeNull()
  })
})
