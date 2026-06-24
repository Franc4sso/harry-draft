import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELLS } from '@/data/spells'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCard compact', () => {
  it('renders at the card width and shows the name and all four stat labels', () => {
    const { container } = render(<WizardCard drafted={harry()} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    for (const stat of ['HP', 'ATK', 'DIF', 'VEL']) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
    expect(container.querySelector('.w-56')).not.toBeNull()
  })

  it('fires onClick when clickable', async () => {
    const handler = vi.fn()
    render(<WizardCard drafted={harry()} onClick={handler} />)
    // Click the card body (the name) — not the role badge, which is its own button now.
    await userEvent.click(screen.getByText('Harry Potter'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('conveys the house via a house frame (not a text pill)', () => {
    const drafted = harry()
    const { container } = render(<WizardCard drafted={drafted} />)
    // The house is conveyed by the frame, which carries the house name for a11y.
    expect(container.querySelector(`[data-house="${drafted.wizard.house}"]`)).not.toBeNull()
    // No standalone text pill repeating the house name in the affiliation strip.
    const strip = screen.queryByTestId('affiliation-strip')
    if (strip) expect(within(strip).queryByText(drafted.wizard.house)).toBeNull()
  })

  it('conveys the role as an icon badge, not a text pill', () => {
    const drafted = harry()
    render(<WizardCard drafted={drafted} />)
    // RoleIcon exposes the role as its aria-label.
    expect(screen.getByLabelText(drafted.wizard.role)).toBeInTheDocument()
    const strip = screen.queryByTestId('affiliation-strip')
    if (strip) expect(within(strip).queryByText(drafted.wizard.role)).toBeNull()
  })

  it('reveals the role behaviour on tap without picking the card', async () => {
    const onPick = vi.fn()
    const drafted = harry() // Attaccante
    render(<WizardCard drafted={drafted} onClick={onPick} />)
    // No tooltip until the role badge is tapped.
    expect(screen.queryByRole('tooltip')).toBeNull()
    const trigger = screen.getByLabelText(drafted.wizard.role).closest('button')!
    fireEvent.click(trigger)
    // The behaviour blurb appears (Attaccante = armor penetration -> "difesa")...
    expect(screen.getByRole('tooltip')).toHaveTextContent(/difesa/i)
    // ...and tapping the badge did NOT pick the wizard.
    expect(onPick).not.toHaveBeenCalled()
  })

  it('shows the portrait (house crest no longer overlaid on the card)', () => {
    const drafted = harry()
    render(<WizardCard drafted={drafted} />)
    expect(screen.getByAltText(drafted.wizard.name)).toBeInTheDocument()
    // The crest was removed from the portrait — the house reads from the frame.
    expect(screen.queryByRole('img', { name: drafted.wizard.house })).toBeNull()
  })

  it('wraps content in a rarity frame', () => {
    const { container } = render(<WizardCard drafted={harry()} />)
    expect(container.querySelector('[data-rarity]')).not.toBeNull()
  })

  it('shows only special-synergy chips in the affiliation strip (no house/role pills)', () => {
    // Harry belongs to Golden Trio (a special group synergy).
    render(<WizardCard drafted={harry()} />)
    const strip = screen.queryByTestId('affiliation-strip')
    expect(strip).not.toBeNull()
    expect(within(strip!).getByText(/Golden Trio/i)).toBeInTheDocument()
  })

  it('explains effects as "name: description" lines (no pills)', () => {
    const incendio = SPELLS.find((s) => s.id === 'incendio')!
    const drafted = { ...harry(), spell: incendio }
    render(<WizardCard drafted={drafted} />)
    // Effect name present...
    expect(screen.getByText('Danno nel tempo:')).toBeInTheDocument()
    // ...followed by its plain-language description.
    expect(screen.getByText(/Infligge danno a ogni turno/i)).toBeInTheDocument()
  })

  it('shows what the move does — its numbers (power/precision)', () => {
    const incendio = SPELLS.find((s) => s.id === 'incendio')!
    const drafted = { ...harry(), spell: incendio }
    render(<WizardCard drafted={drafted} />)
    // formatSpellStats surfaces Potenza (power) and Precisione (hit chance) as
    // "label:" lines, consistent with the effect lines below them.
    expect(screen.getByText('Potenza:')).toBeInTheDocument()
    expect(screen.getByText('Precisione:')).toBeInTheDocument()
  })
})

import { TRAIT_BY_ID } from '@/data/traits'

it('renders trait chips with a tooltip for a wizard that has traits', () => {
  const voldemort = draftWizard(createRng(1), WIZARD_BY_ID['voldemort']!)
  render(<WizardCard drafted={voldemort} />)
  const trait = TRAIT_BY_ID[voldemort.wizard.traits![0]!]!
  expect(screen.getByText(trait.name)).toBeInTheDocument()
})

it('shows no trait chips for a trait-less wizard', () => {
  // ron has no traits field in data/wizards.ts
  const draftless = draftWizard(createRng(1), WIZARD_BY_ID['ron']!)
  render(<WizardCard drafted={draftless} />)
  // No chip matching any catalog trait name.
  for (const id of Object.keys(TRAIT_BY_ID)) {
    expect(screen.queryByText(TRAIT_BY_ID[id]!.name)).toBeNull()
  }
})
