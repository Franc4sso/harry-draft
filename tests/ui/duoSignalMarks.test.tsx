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
  it('labels the taunt signal "Bersaglio" (not "Muro") so it never collides with the archetype', () => {
    render(<DuoSignalMarks wizard={wiz('Tank', [])} />)
    expect(screen.getByText('Bersaglio')).toBeInTheDocument()
    expect(screen.queryByText('Muro')).not.toBeInTheDocument()
  })

  it('renders nothing for a plain attacker', () => {
    const { container } = render(<DuoSignalMarks wizard={wiz('Attaccante', [])} />)
    expect(container.querySelector('[data-testid="duo-signal-marks"]')).toBeNull()
  })

  it('excludeArchetypeSignals drops the 4 tag-signals but keeps the taunt "Bersaglio" pill', () => {
    render(<DuoSignalMarks wizard={wiz('Tank', ['scudirigen'])} excludeArchetypeSignals />)
    // scudirigen tag-signal escluso (il nastro lo mostra); il taunt "Bersaglio" resta (nessuna collisione)
    expect(screen.getByText('Bersaglio')).toBeInTheDocument()
    expect(screen.queryByText('Muro')).not.toBeInTheDocument()
  })
})
