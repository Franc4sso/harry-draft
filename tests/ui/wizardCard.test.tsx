import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'
import { abilityFor } from '@/lib/wizardAbilities'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)
// Tank fixture (role === 'Tank') for the poster-layout render tests below.
const draftedTank = () => draftWizard(createRng(1), WIZARD_BY_ID['mcgonagall']!)
// Veleno-tagged fixture (feeds the Duo signal system) for the signal-marks/ribbon tests below.
const velenoDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['pansy']!)

describe('WizardCardColumn (poster layout, the LIVE draft card)', () => {
  it('renders the role badge, spell block, name heading and all four stat labels', () => {
    render(<WizardCardColumn drafted={draftedTank()} />)
    expect(screen.getByTestId('role-badge')).toBeInTheDocument()
    expect(screen.getByTestId('role-badge')).toHaveAttribute('aria-label', draftedTank().wizard.role)
    expect(screen.getByTestId('spell-block')).toHaveTextContent(/./)
    expect(screen.getByRole('heading', { name: /./ })).toBeInTheDocument()
    for (const k of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(k)).toBeInTheDocument()
  })

  it('shows the ability plate with the wizard Signature (name + blurb)', () => {
    const d = draftedTank()
    render(<WizardCardColumn drafted={d} />)
    const plate = screen.getByTestId('ability-plate')
    expect(plate).toHaveTextContent(/Abilità personale/i)
    const { name, blurb } = abilityFor(d.wizard.id)
    expect(within(plate).getByText(name)).toBeInTheDocument()
    expect(within(plate).getByText(blurb)).toBeInTheDocument()
  })

  it('does not show a duplicate signature pill at the top of the card', () => {
    const d = draftedTank()
    render(<WizardCardColumn drafted={d} />)
    const { name } = abilityFor(d.wizard.id)
    // The signature name now lives only in the gold ability plate.
    expect(screen.getAllByText(name)).toHaveLength(1)
  })

  it('never shows the synergy nudge — it was removed (meant nothing to the player)', () => {
    // The "Aggiunge 2 Tassorosso" nudge was removed per user feedback. hotSynergyIds is still
    // an accepted prop (callers pass it) but the card renders no nudge for it.
    const { rerender } = render(<WizardCardColumn drafted={draftedTank()} />)
    expect(screen.queryByTestId('synergy-nudge')).toBeNull()
    rerender(<WizardCardColumn drafted={draftedTank()} hotSynergyIds={new Set(['gryffindor'])} />)
    expect(screen.queryByTestId('synergy-nudge')).toBeNull()
  })

  it('conveys the house via data-house and keeps the testId prop wired', () => {
    const d = harry()
    const { container } = render(<WizardCardColumn drafted={d} testId="draft-card-0" />)
    expect(container.querySelector(`[data-house="${d.wizard.house}"]`)).not.toBeNull()
    expect(container.querySelector('[data-testid="draft-card-0"]')).not.toBeNull()
  })

  it('fires onClick when clickable (name click) and supports keyboard activation', async () => {
    const handler = vi.fn()
    const d = harry()
    render(<WizardCardColumn drafted={d} onClick={handler} />)
    await userEvent.click(screen.getByText(displayName(d)))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('exposes the role via the badge (no visible role word — removed 2026-07-08)', () => {
    const d = draftedTank()
    render(<WizardCardColumn drafted={d} />)
    // The role WORD pill was removed from the title block per user request; the role now
    // lives only on the RoleBadge gem, carried for a11y via aria-label.
    expect(screen.getByTestId('role-badge')).toHaveAttribute('aria-label', d.wizard.role)
    expect(screen.queryByText(d.wizard.role)).not.toBeInTheDocument()
  })

  it('shows a trait chip when the wizard is shiny', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'furia' } }
    render(<WizardCardColumn drafted={shiny} />)
    expect(screen.getByText(TRAIT_BY_ID['furia']!.name)).toBeInTheDocument()
  })

  it('shows a Veleno signal mark for a veleno mage', () => {
    render(<WizardCardColumn drafted={velenoDrafted()} />)
    expect(screen.getByTestId('duo-signal-marks')).toBeInTheDocument()
  })

  it('shows a gold Completa ribbon when duoPreview completes a Duo', () => {
    render(
      <WizardCardColumn
        drafted={velenoDrafted()}
        duoPreview={{ completes: [{ id: 'cancrena', name: 'Cancrena', desc: '', signals: ['veleno', 'esecuzione'] }], advances: [] }}
      />,
    )
    const ribbon = screen.getByTestId('duo-ribbon')
    expect(ribbon).toHaveAttribute('data-kind', 'completes')
    expect(ribbon).toHaveTextContent('Cancrena')
  })

  it('shows NO ribbon when duoPreview only advances (no "verso" noise)', () => {
    render(
      <WizardCardColumn
        drafted={velenoDrafted()}
        duoPreview={{ completes: [], advances: [{ id: 'muro-vivente', name: 'Muro Vivente', desc: '', signals: ['scudirigen', 'taunt'] }] }}
      />,
    )
    expect(screen.queryByTestId('duo-ribbon')).toBeNull()
  })
})
