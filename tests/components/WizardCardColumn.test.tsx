import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!) // tier 1 — legendary
const snape = () => draftWizard(createRng(1), WIZARD_BY_ID['snape']!) // tier 2 — epic
const hermione = () => draftWizard(createRng(1), WIZARD_BY_ID['hermione']!) // tier 3 — rare
const seamus = () => draftWizard(createRng(1), WIZARD_BY_ID['seamus']!) // tier 4 — common

describe('WizardCardColumn', () => {
  it('renders name, spell name, and the four stat labels', () => {
    const d = harry()
    render(<WizardCardColumn drafted={d} testId="col-0" />)
    expect(screen.getByTestId('col-0')).toBeInTheDocument()
    expect(screen.getByText(displayName(d))).toBeInTheDocument()
    // The spell name shows once, in the spell block (the ability plate now
    // shows the wizard's Signature, a separate name, via abilityFor).
    expect(screen.getByText(d.spell.name)).toBeInTheDocument()
    for (const l of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(l)).toBeInTheDocument()
  })
  it('renders without the affiliation strip (removed per approved mockup)', () => {
    render(<WizardCardColumn drafted={harry()} />)
    expect(screen.queryByTestId('affiliation-strip')).toBeNull()
  })
  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(<WizardCardColumn drafted={harry()} onClick={onClick} testId="col-0" />)
    screen.getByTestId('col-0').click()
    expect(onClick).toHaveBeenCalled()
  })

  // Signature ornaments, ported from the approved mockup (.superpowers/design/rarity-borders.html):
  // the T1 crown and T2 filigree flourishes must appear ONLY on their own tier — no bleed to others.
  describe('tier ornaments', () => {
    it('renders the legendary crown on tier 1 only', () => {
      render(<WizardCardColumn drafted={harry()} testId="col-t1" />)
      expect(screen.getByTestId('tier-legendary-crown')).toBeInTheDocument()
    })
    it('renders the epic filigree on tier 2 only', () => {
      render(<WizardCardColumn drafted={snape()} testId="col-t2" />)
      expect(screen.getByTestId('tier-epic-filigree')).toBeInTheDocument()
    })
    it('omits the crown and filigree on tier 3 (rare)', () => {
      render(<WizardCardColumn drafted={hermione()} testId="col-t3" />)
      expect(screen.queryByTestId('tier-legendary-crown')).toBeNull()
      expect(screen.queryByTestId('tier-epic-filigree')).toBeNull()
    })
    it('omits the crown and filigree on tier 4 (common)', () => {
      render(<WizardCardColumn drafted={seamus()} testId="col-t4" />)
      expect(screen.queryByTestId('tier-legendary-crown')).toBeNull()
      expect(screen.queryByTestId('tier-epic-filigree')).toBeNull()
    })
    it('omits the filigree on tier 1 (no cross-tier bleed)', () => {
      render(<WizardCardColumn drafted={harry()} testId="col-t1b" />)
      expect(screen.queryByTestId('tier-epic-filigree')).toBeNull()
    })
    it('omits the crown on tier 2 (no cross-tier bleed)', () => {
      render(<WizardCardColumn drafted={snape()} testId="col-t2b" />)
      expect(screen.queryByTestId('tier-legendary-crown')).toBeNull()
    })
  })
})
