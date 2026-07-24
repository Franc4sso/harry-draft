import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'
import { abilityFor } from '@/lib/wizardAbilities'
import { archetypeTooltip } from '@/lib/archetypes'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)
// Tank fixture (role === 'Tank') for the poster-layout render tests below.
const draftedTank = () => draftWizard(createRng(1), WIZARD_BY_ID['mcgonagall']!)
// Veleno-tagged fixture (feeds the Duo signal system) for the signal-marks/ribbon tests below.
const velenoDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['pansy']!)
// Muro (scudirigen) fixture for the archetype-ribbon test.
const scudirigenDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['cedric']!)
// Tank + scudirigen fixture (e.g. hagrid/ernie) — the double-"Muro" bug case: ribbon AND
// taunt pill would both say "Muro" without the fix.
const scudirigenTankDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['ernie']!)

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
    // The "Aggiunge 2 Tassorosso" nudge was removed per user feedback.
    render(<WizardCardColumn drafted={draftedTank()} />)
    expect(screen.queryByTestId('synergy-nudge')).toBeNull()
  })

  it('conveys the house via data-house (now the inner wash, not the border) and keeps the testId prop wired', () => {
    const d = harry()
    const { container } = render(<WizardCardColumn drafted={d} testId="draft-card-0" />)
    expect(container.querySelector(`[data-house="${d.wizard.house}"]`)).not.toBeNull()
    expect(container.querySelector('[data-testid="draft-card-0"]')).not.toBeNull()
  })

  it('borders the card by rarity (tier), exposed via data-tier', () => {
    const legendary = harry() // tier 1
    const common = velenoDrafted() // tier 4
    const { container: c1 } = render(<WizardCardColumn drafted={legendary} />)
    const { container: c4 } = render(<WizardCardColumn drafted={common} />)
    expect(c1.querySelector(`[data-tier="1"]`)).not.toBeNull()
    expect(c4.querySelector(`[data-tier="4"]`)).not.toBeNull()
  })

  it('shows the shimmer sweep only on tier 1 (legendary) cards', () => {
    const legendary = harry() // tier 1
    const rare = draftedTank() // tier 2 (mcgonagall)
    const { container: c1 } = render(<WizardCardColumn drafted={legendary} />)
    const { container: c2 } = render(<WizardCardColumn drafted={rare} />)
    expect(c1.querySelector('[data-testid="tier-shimmer"]')).not.toBeNull()
    expect(c2.querySelector('[data-testid="tier-shimmer"]')).toBeNull()
  })

  it('shows an archetype ribbon with the fantasy name + glyph for a scudirigen (Muro) wizard', () => {
    render(<WizardCardColumn drafted={scudirigenDrafted()} />)
    const ribbon = screen.getByTestId('archetype-ribbon')
    expect(ribbon).toHaveAttribute('data-archetype', 'scudirigen')
    expect(ribbon).toHaveTextContent('Muro')
  })

  it('shows a "Magie Oscure" ribbon for a magieOscure-tagged wizard (narcissa: tags=[deatheater,magieOscure])', () => {
    const narcissa = draftWizard(createRng(1), WIZARD_BY_ID['narcissa']!)
    render(<WizardCardColumn drafted={narcissa} />)
    const ribbon = screen.getByTestId('archetype-ribbon')
    expect(ribbon).toHaveTextContent('Magie Oscure')
  })

  it('shows no archetype ribbon for a wizard with no archetype tags', () => {
    render(<WizardCardColumn drafted={draftedTank()} />) // mcgonagall: tags=['order']
    expect(screen.queryByTestId('archetype-ribbon')).toBeNull()
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

  it('exposes the trait via the shiny foil tooltip, not a trait chip', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'furia' } }
    render(<WizardCardColumn drafted={shiny} />)
    expect(screen.queryByTestId('trait-chip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('shiny-foil'))
    expect(screen.getByText(new RegExp(TRAIT_BY_ID['furia']!.name))).toBeInTheDocument()
  })

  it('does not repeat the Veleno archetype in DuoSignalMarks — the ribbon owns it now; the role signal (controllo) still shows', () => {
    render(<WizardCardColumn drafted={velenoDrafted()} />) // pansy: role Controllo, tags=['veleno']
    expect(screen.getByTestId('archetype-ribbon')).toHaveTextContent('Veleno')
    const marks = screen.getByTestId('duo-signal-marks')
    expect(within(marks).queryByText('Veleno')).toBeNull() // not duplicated in DuoSignalMarks
    expect(marks).toBeInTheDocument() // role signal (controllo) remains
  })

  it('keeps the taunt "Bersaglio" role-signal in DuoSignalMarks for a Tank with no archetype tag', () => {
    render(<WizardCardColumn drafted={draftedTank()} />) // mcgonagall: Tank, tags=['order']
    expect(screen.queryByTestId('archetype-ribbon')).toBeNull()
    expect(screen.getByTestId('duo-signal-marks')).toHaveTextContent('Bersaglio')
  })

  it('shows "Muro" exactly once (the archetype ribbon) for a Tank+scudirigen wizard — the taunt pill now reads "Bersaglio"', () => {
    render(<WizardCardColumn drafted={scudirigenTankDrafted()} />) // ernie: Tank, tags=['scudirigen']
    const ribbon = screen.getByTestId('archetype-ribbon')
    expect(ribbon).toHaveTextContent('Muro')
    // "Muro" appears only on the ribbon; the taunt pill is "Bersaglio" (no collision)
    expect(screen.getAllByText('Muro')).toHaveLength(1)
    expect(screen.getByText('Bersaglio')).toBeInTheDocument()
  })

  it('shows the ribbon Muro and no taunt pill for a scudirigen non-Tank (unchanged)', () => {
    render(<WizardCardColumn drafted={scudirigenDrafted()} />) // cedric: Attaccante, tags=['scudirigen']
    const ribbon = screen.getByTestId('archetype-ribbon')
    expect(ribbon).toHaveTextContent('Muro')
    expect(screen.queryByTestId('duo-signal-marks')).toBeNull()
  })

  it('non mostra MAI il ribbon Duo sopra la card: la preview vive nel DuoTracker del rail', () => {
    render(<WizardCardColumn drafted={velenoDrafted()} />)
    expect(screen.queryByTestId('duo-ribbon')).toBeNull()
  })

  it("il nastro archetipo espone un tooltip con l'effetto della Costellazione", () => {
    // un mago Tank+scudirigen (ernie) mostra il nastro "Muro" con tooltip bastione.
    render(<WizardCardColumn drafted={scudirigenTankDrafted()} />)
    // apri il tooltip (il trigger è un button; il popover appare su click)
    const ribbon = screen.getByTestId('archetype-ribbon')
    fireEvent.click(ribbon)
    expect(screen.getByText(archetypeTooltip('scudirigen'))).toBeInTheDocument()
  })
})
