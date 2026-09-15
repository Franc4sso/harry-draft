import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)
// Veleno-tagged fixture (feeds the Duo signal system), mirrors tests/cards/WizardCard.test.tsx.
const velenoDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['pansy']!)

// WizardCardRow è stato sostituito da WizardCard density="row" (Task 11 — i tre componenti
// vecchi sono cancellati). Non riscritti qui: la casa (data-house/il bordo colorato per
// casata) — Task 8 disegna la cornice SOLO su tierFrame(tier), niente più bordo per casa
// (vedi task-8-brief.md §Step 3.1); i segnali Duo su carta (duo-signal-marks/tag-signal
// esclusi dal nastro) — rimossi apposta: la preview Duo vive ora nel DuoTracker del rail
// (vedi memoria "Duo UX: no card ribbon", user: "MAI più ribbon Completa sulle card").
describe('WizardCard density="row"', () => {
  // Density row non mostra più il nome della magia (solo full/combat) — scelta di
  // design dichiarata nel brief del Task 8: "a destra nome, barra vita e una riga di
  // statistiche compatta", niente riga magia. Il nome resta, le statistiche restano;
  // "e il nome della magia" è stato tolto da questo test (resta coperto altrove per
  // full/combat, es. tests/cards/WizardCard.test.tsx).
  it('renders name and all four stat labels', () => {
    const d = harry()
    render(<WizardCard drafted={d} density="row" />)
    expect(screen.getByText(displayName(d))).toBeInTheDocument()
    for (const stat of ['HP', 'ATT', 'DIF', 'VEL']) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
  })

  it('shows the card portrait image', () => {
    const d = harry()
    const { container } = render(<WizardCard drafted={d} density="row" />)
    expect(container.querySelector('img[data-variant="card"]')).not.toBeNull()
  })

  it('exposes the role as a colored text label', () => {
    const d = harry()
    render(<WizardCard drafted={d} density="row" />)
    expect(screen.getByText(d.wizard.role)).toBeInTheDocument()
  })

  it('exposes the trait via the shiny foil tooltip, not a trait chip', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'furia' } }
    render(<WizardCard drafted={shiny} density="row" />)
    // La chip tratto blu è stata rimossa: il tratto vive ora nel tooltip del marcatore foil.
    expect(screen.queryByTestId('trait-chip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('shiny-foil'))
    expect(screen.getByText(new RegExp(TRAIT_BY_ID['furia']!.name))).toBeInTheDocument()
  })

  it('shows no trait chip when the wizard is not shiny', () => {
    render(<WizardCard drafted={{ ...harry(), shiny: undefined }} density="row" />)
    expect(screen.queryByTestId('trait-chip')).toBeNull()
  })

  it('fires onClick when clickable', async () => {
    const handler = vi.fn()
    const d = harry()
    render(<WizardCard drafted={d} density="row" onClick={handler} />)
    await userEvent.click(screen.getByText(displayName(d)))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not use a vertical card width', () => {
    const { container } = render(<WizardCard drafted={harry()} density="row" />)
    expect(container.querySelector('.w-56')).toBeNull()
  })
})

describe('WizardCard density="row" Marchio', () => {
  it('shows the granted-tag Marchio badge for a veleno mage with grantedTags', () => {
    const d = { ...velenoDrafted(), grantedTags: ['veleno'] }
    render(<WizardCard drafted={d} density="row" />)
    expect(screen.getByTestId('marchio-badge')).toBeInTheDocument()
  })
})
