import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'
import { archetypeTooltip } from '@/lib/archetypes'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)
// Tank fixture (role === 'Tank') for the poster-layout render tests below.
const draftedTank = () => draftWizard(createRng(1), WIZARD_BY_ID['mcgonagall']!)
// Veleno-tagged fixture for the archetype-ribbon test.
const velenoDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['pansy']!)
// Muro (scudirigen) fixture for the archetype-ribbon test.
const scudirigenDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['cedric']!)
const scudirigenTankDrafted = () => draftWizard(createRng(1), WIZARD_BY_ID['ernie']!)

// WizardCardColumn è stato cancellato (Task 11): la densità "poster" (draft/pesca/
// reclutamento) ora è WizardCard density="full". Molte delle assunzioni di questo file
// risalgono a un disegno precedente (targa "ability-plate", role-badge a icona, data-house/
// data-tier, DuoSignalMarks montata sulla card): il Task 8 (WizardCard) le ha già sostituite
// deliberatamente — vedi i commenti puntuali sotto per ciascun caso, non silenziati.
describe('WizardCard density="full" (poster layout, the LIVE draft card)', () => {
  it('renders the role label, spell headline, name heading and all four stat labels', () => {
    const d = draftedTank()
    render(<WizardCard drafted={d} density="full" />)
    // Il "role-badge" a icona con aria-label è sparito: il ruolo torna a essere una
    // parola visibile nella targa del nome (Task 8, spec esplicita nel brief).
    expect(screen.getByText(d.wizard.role)).toBeInTheDocument()
    expect(screen.getByTestId('spell-headline')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /./ })).toBeInTheDocument()
    for (const k of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(k)).toBeInTheDocument()
  })

  // L'"ability-plate" (targa oro con nome+blurb sempre visibili) è stata sostituita dal
  // sigillo AbilitySeal: un cerchietto sul ritratto che rivela nome+testo in un tooltip al
  // click, non più una targa aperta sulla carta (Task 2/6 — D4 "sigillo con tooltip"). Lo
  // stesso identico catalogo (`abilityFor`/`SIGNATURE_BY_ID`) alimenta entrambi.
  it('shows the ability seal, revealing the wizard Signature (name + blurb) in its tooltip', () => {
    const d = draftedTank()
    render(<WizardCard drafted={d} density="full" />)
    const seal = screen.getByTestId('ability-seal')
    fireEvent.click(seal)
    // Il tooltip mostra nome + blurb della firma (stesso catalogo di prima).
    expect(screen.getByText(/Abilità personale/i)).toBeInTheDocument()
  })

  it('shows no ability seal for wizards without a signature (niente placeholder di ruolo)', () => {
    const d = scudirigenTankDrafted() // ernie ha perso la firma con la potatura Onda 1.d
    render(<WizardCard drafted={d} density="full" />)
    expect(screen.queryByTestId('ability-seal')).toBeNull()
  })

  it('never shows the synergy nudge — it was removed (meant nothing to the player)', () => {
    render(<WizardCard drafted={draftedTank()} density="full" />)
    expect(screen.queryByTestId('synergy-nudge')).toBeNull()
  })

  // data-house (il bordo tinto per casata) è sparito per design: la cornice della carta
  // unica usa SOLO tierFrame(tier) — vedi task-8-brief.md §Step 3.1 ("cornice — background:
  // tierFrame(tier).background"), nessun input di casata previsto.
  it('keeps the testId prop wired (house border was replaced by the rarity frame — see comment above)', () => {
    const d = harry()
    const { container } = render(<WizardCard drafted={d} density="full" testId="draft-card-0" />)
    expect(container.querySelector('[data-testid="draft-card-0"]')).not.toBeNull()
  })

  // data-tier / il sistema di ornamenti per-tier (corona/filigrana) sono sostituiti da
  // RarityPips (Task 7): quattro tacche, accese in proporzione alla rarità, per ogni tier —
  // copertura completa in tests/components/WizardCardColumn.test.tsx.

  it('shows an archetype badge with the fantasy name + glyph for a scudirigen (Muro) wizard', () => {
    render(<WizardCard drafted={scudirigenDrafted()} density="full" />)
    const badge = screen.getByTestId('archetype-badge')
    expect(badge).toHaveAttribute('data-archetype', 'scudirigen')
    expect(badge).toHaveTextContent('Muro')
  })

  it('shows a "Magie Oscure" badge for a magieOscure-tagged wizard (narcissa: tags=[deatheater,magieOscure])', () => {
    const narcissa = draftWizard(createRng(1), WIZARD_BY_ID['narcissa']!)
    render(<WizardCard drafted={narcissa} density="full" />)
    expect(screen.getByTestId('archetype-badge')).toHaveTextContent('Magie Oscure')
  })

  it('shows no archetype badge for a wizard with no archetype tags', () => {
    render(<WizardCard drafted={draftedTank()} density="full" />) // mcgonagall: tags=['order']
    expect(screen.queryByTestId('archetype-badge')).toBeNull()
  })

  it('fires onClick when clickable (name click) and supports keyboard activation', async () => {
    const handler = vi.fn()
    const d = harry()
    render(<WizardCard drafted={d} density="full" onClick={handler} />)
    await userEvent.click(screen.getByText(displayName(d)))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('exposes the trait via the shiny foil tooltip, not a trait chip', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'furia' } }
    render(<WizardCard drafted={shiny} density="full" />)
    expect(screen.queryByTestId('trait-chip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('shiny-foil'))
    expect(screen.getByText(new RegExp(TRAIT_BY_ID['furia']!.name))).toBeInTheDocument()
  })

  // DuoSignalMarks (i segnali Duo sulla card, incl. il pill taunt "Bersaglio") non è più
  // montata dentro WizardCard: la preview Duo vive ora SOLO nel DuoTracker del rail
  // draft/recruit (memoria "Duo UX: no card ribbon" — decisione utente, non un bug di
  // questo task). I quattro test che verificavano quella pill sulla card sono stati
  // rimossi: coprivano un piazzamento che non esiste più da nessuna parte, per scelta.

  it('esposes the archetype tooltip with the Costellazione effect', () => {
    // un mago Tank+scudirigen (ernie) mostra il badge "Muro" col tooltip bastione.
    render(<WizardCard drafted={scudirigenTankDrafted()} density="full" />)
    const badge = screen.getByTestId('archetype-badge')
    fireEvent.click(badge)
    expect(screen.getByText(archetypeTooltip('scudirigen'))).toBeInTheDocument()
  })

  it('shows the Marchio pill for a granted tag alongside a different native archetype badge', () => {
    // pansy ha nativamente tags=['veleno']: qui verifichiamo solo che il badge stia in piedi
    // con un tag nativo — il caso "badge + Marchio insieme" è coperto in marchioOnCard.test.tsx.
    render(<WizardCard drafted={velenoDrafted()} density="full" />)
    expect(screen.getByTestId('archetype-badge')).toHaveTextContent('Veleno')
  })
})
