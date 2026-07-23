import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)
// Veleno-tagged fixture (feeds the Duo signal system), mirrors tests/ui/wizardCard.test.tsx.
const velenoDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['pansy']!)

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

  it('shows a trait chip when the wizard is shiny', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'furia' } }
    render(<WizardCardRow drafted={shiny} />)
    expect(screen.getByText(TRAIT_BY_ID['furia']!.name)).toBeInTheDocument()
  })

  it('shows no trait chip when the wizard is not shiny', () => {
    // Query the chip by testid, not by trait name: a trait name like "Esecuzione" also
    // appears as a Combo-signal label on the card, so a text query would false-positive.
    render(<WizardCardRow drafted={{ ...harry(), shiny: undefined }} />)
    expect(screen.queryByTestId('trait-chip')).toBeNull()
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

describe('WizardCardRow Duo affordance', () => {
  it('shows Duo signal marks for a veleno mage', () => {
    render(<WizardCardRow drafted={velenoDrafted()} />)
    expect(screen.getByTestId('duo-signal-marks')).toBeInTheDocument()
  })

  it('non mostra MAI il ribbon Duo: la preview vive nel DuoTracker del rail', () => {
    render(<WizardCardRow drafted={velenoDrafted()} />)
    expect(screen.queryByTestId('duo-ribbon')).toBeNull()
  })

  it('esclude i tag-signal archetipo sulla Row (come la Column)', () => {
    // Ernie è un Tank scudirigen: il taunt "Bersaglio" resta, la pill "Scudo/Rigen"
    // (tag-signal archetipo, già raccontata altrove) sparisce.
    const d = draftWizard(createRng(1), WIZARD_BY_ID['ernie']!)
    render(<WizardCardRow drafted={d} />)
    expect(screen.getByText('Bersaglio')).toBeInTheDocument()
    expect(screen.queryByText('Scudo/Rigen')).not.toBeInTheDocument()
  })
})
