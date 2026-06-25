import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCardRow', () => {
  it('renders name, all four stat labels and the spell name', () => {
    const d = harry()
    render(<WizardCardRow drafted={d} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    for (const stat of ['HP', 'ATK', 'DIF', 'VEL']) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
    expect(screen.getByText(d.spell.name)).toBeInTheDocument()
  })

  it('conveys the house via a data-house frame and shows the card portrait', () => {
    const d = harry()
    const { container } = render(<WizardCardRow drafted={d} />)
    expect(container.querySelector(`[data-house="${d.wizard.house}"]`)).not.toBeNull()
    expect(container.querySelector('img[data-variant="card"]')).not.toBeNull()
  })

  it('exposes the role as an icon badge (aria-label)', () => {
    const d = harry()
    render(<WizardCardRow drafted={d} />)
    expect(screen.getByLabelText(d.wizard.role)).toBeInTheDocument()
  })

  it('shows the special-synergy strip and marks a hot chip', () => {
    render(<WizardCardRow drafted={harry()} hotSynergyIds={new Set(['goldenTrio'])} />)
    const strip = screen.getByTestId('affiliation-strip')
    expect(within(strip).getByText(/Golden Trio/i)).toBeInTheDocument()
    expect(strip.querySelector('[data-synergy="goldenTrio"][data-hot]')).not.toBeNull()
  })

  it('renders trait chips for a wizard that has traits', () => {
    const voldemort = draftWizard(createRng(1), WIZARD_BY_ID['voldemort']!)
    render(<WizardCardRow drafted={voldemort} />)
    const trait = TRAIT_BY_ID[voldemort.wizard.traits![0]!]!
    expect(screen.getByText(trait.name)).toBeInTheDocument()
  })

  it('fires onClick when clickable', async () => {
    const handler = vi.fn()
    render(<WizardCardRow drafted={harry()} onClick={handler} />)
    await userEvent.click(screen.getByText('Harry Potter'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not use a vertical card width', () => {
    const { container } = render(<WizardCardRow drafted={harry()} />)
    expect(container.querySelector('.w-56')).toBeNull()
  })
})
