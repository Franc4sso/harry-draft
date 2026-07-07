import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELLS } from '@/data/spells'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)
// Tank fixture (role === 'Tank') for the poster-layout render tests below.
const draftedTank = () => draftWizard(createRng(1), WIZARD_BY_ID['mcgonagall']!)
// A wizard whose portrait file is missing — PortraitImage falls back to a crest;
// the card must still render the name/heading.
const draftedNoPortrait = () => {
  const d = harry()
  return { ...d, wizard: { ...d.wizard, id: '__no_such_portrait__' } }
}

describe('WizardCard compact', () => {
  it('renders at the card width and shows the name and all four stat labels', () => {
    const d = harry()
    const { container } = render(<WizardCard drafted={d} />)
    expect(screen.getByText(displayName(d))).toBeInTheDocument()
    for (const stat of ['HP', 'ATT', 'DIF', 'VEL']) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
    expect(container.querySelector('.w-56')).not.toBeNull()
  })

  it('renders name, role word, spell name and the four stats (poster layout)', () => {
    render(<WizardCard drafted={draftedTank()} />)
    expect(screen.getByRole('heading', { name: /./ })).toBeInTheDocument()
    expect(screen.getByTestId('role-badge')).toBeInTheDocument()
    expect(screen.getByTestId('spell-block')).toHaveTextContent(/./)
    for (const k of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(k)).toBeInTheDocument()
  })

  it('shows the synergy nudge only when hotSynergyIds is non-empty', () => {
    const { rerender } = render(<WizardCard drafted={draftedTank()} />)
    expect(screen.queryByTestId('synergy-nudge')).toBeNull()
    rerender(<WizardCard drafted={draftedTank()} hotSynergyIds={new Set(['gryffindor'])} />)
    expect(screen.getByTestId('synergy-nudge')).toBeInTheDocument()
  })

  it('falls back to an initial when the portrait is missing', () => {
    // PortraitImage already handles missing files; assert the card still renders the name.
    render(<WizardCard drafted={draftedNoPortrait()} />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('shows the ability plate with a name and blurb (Task 2 stub)', () => {
    render(<WizardCard drafted={draftedTank()} />)
    expect(screen.getByTestId('ability-plate')).toHaveTextContent(/Abilità personale/i)
  })

  it('fires onClick when clickable', async () => {
    const handler = vi.fn()
    const d = harry()
    render(<WizardCard drafted={d} onClick={handler} />)
    // Click the card body (the name) — not the role badge, which is its own button now.
    await userEvent.click(screen.getByText(displayName(d)))
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

  it('conveys the role as a badge (poster gem) and the role word next to the name, not a strip pill', () => {
    // Poster layout (approved mockup): the role gem sits over the portrait, and
    // the role WORD ("Tank"/"Controllo") shows next to the monumental name — the
    // old affiliation-strip role pill is gone (superseded, not duplicated).
    const drafted = harry()
    render(<WizardCard drafted={drafted} />)
    expect(screen.getByTestId('role-badge')).toHaveAttribute('aria-label', drafted.wizard.role)
    const strip = screen.queryByTestId('affiliation-strip')
    if (strip) expect(within(strip).queryByText(drafted.wizard.role)).toBeNull()
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

  it('shows a trait chip when the wizard is shiny', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'furia' } }
    render(<WizardCard drafted={shiny} />)
    expect(screen.getByText(TRAIT_BY_ID['furia']!.name)).toBeInTheDocument()
  })

  it('shows no trait chip when the wizard is not shiny', () => {
    render(<WizardCard drafted={{ ...harry(), shiny: undefined }} />)
    for (const id of Object.keys(TRAIT_BY_ID)) {
      expect(screen.queryByText(TRAIT_BY_ID[id]!.name)).toBeNull()
    }
  })
})

describe('WizardCardColumn (poster layout, the LIVE draft card)', () => {
  it('renders the role badge, spell block, name heading and all four stat labels', () => {
    render(<WizardCardColumn drafted={draftedTank()} />)
    expect(screen.getByTestId('role-badge')).toBeInTheDocument()
    expect(screen.getByTestId('role-badge')).toHaveAttribute('aria-label', draftedTank().wizard.role)
    expect(screen.getByTestId('spell-block')).toHaveTextContent(/./)
    expect(screen.getByRole('heading', { name: /./ })).toBeInTheDocument()
    for (const k of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(k)).toBeInTheDocument()
  })

  it('shows the ability plate fed by the temp stub (spell name + role blurb)', () => {
    const d = draftedTank()
    render(<WizardCardColumn drafted={d} />)
    const plate = screen.getByTestId('ability-plate')
    expect(plate).toHaveTextContent(/Abilità personale/i)
    expect(within(plate).getByText(d.spell.name)).toBeInTheDocument()
  })

  it('shows the synergy nudge only when hotSynergyIds is non-empty', () => {
    const { rerender } = render(<WizardCardColumn drafted={draftedTank()} />)
    expect(screen.queryByTestId('synergy-nudge')).toBeNull()
    rerender(<WizardCardColumn drafted={draftedTank()} hotSynergyIds={new Set(['gryffindor'])} />)
    expect(screen.getByTestId('synergy-nudge')).toBeInTheDocument()
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

  it('shows the role word (not the verb) next to the name', () => {
    const d = draftedTank()
    render(<WizardCardColumn drafted={d} />)
    expect(screen.getByText(d.wizard.role)).toBeInTheDocument()
  })

  it('shows a trait chip when the wizard is shiny', () => {
    const base = harry()
    const shiny = { ...base, shiny: { traitId: 'furia' } }
    render(<WizardCardColumn drafted={shiny} />)
    expect(screen.getByText(TRAIT_BY_ID['furia']!.name)).toBeInTheDocument()
  })
})
