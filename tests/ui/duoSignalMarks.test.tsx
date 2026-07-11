import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  it('renders nothing for a plain attacker', () => {
    const { container } = render(<DuoSignalMarks wizard={wiz('Attaccante', [])} />)
    expect(container.querySelector('[data-testid="duo-signal-marks"]')).toBeNull()
  })
  it('names the fed Duos in the tooltip content', () => {
    render(<DuoSignalMarks wizard={wiz('Attaccante', ['veleno'])} />)
    // Tooltip content only mounts once its trigger button is activated (see
    // tests/ui/tooltip.test.tsx: "is hidden until tapped, then reveals its content").
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/alimenta:/)).toBeInTheDocument()
  })
})
