import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCardRow', () => {
  it('renders name, all four stat labels and the spell name', () => {
    const d = harry()
    render(<WizardCardRow drafted={d} />)
    expect(screen.getByText(displayName(d))).toBeInTheDocument()
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

  it('shows a trait chip when the wizard is shiny', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'veleno' } }
    render(<WizardCardRow drafted={shiny} />)
    expect(screen.getByText(TRAIT_BY_ID['veleno']!.name)).toBeInTheDocument()
  })

  it('shows no trait chip when the wizard is not shiny', () => {
    render(<WizardCardRow drafted={{ ...harry(), shiny: undefined }} />)
    for (const id of Object.keys(TRAIT_BY_ID)) {
      expect(screen.queryByText(TRAIT_BY_ID[id]!.name)).toBeNull()
    }
  })

  it('fires onClick when clickable', async () => {
    const handler = vi.fn()
    const d = harry()
    render(<WizardCardRow drafted={d} onClick={handler} />)
    await userEvent.click(screen.getByText(displayName(d)))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not use a vertical card width', () => {
    const { container } = render(<WizardCardRow drafted={harry()} />)
    expect(container.querySelector('.w-56')).toBeNull()
  })
})
