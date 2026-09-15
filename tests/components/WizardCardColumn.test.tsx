import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!) // tier 1 — legendary
const snape = () => draftWizard(createRng(1), WIZARD_BY_ID['snape']!) // tier 2 — epic
const hermione = () => draftWizard(createRng(1), WIZARD_BY_ID['hermione']!) // tier 3 — rare
const seamus = () => draftWizard(createRng(1), WIZARD_BY_ID['seamus']!) // tier 4 — common

// WizardCardColumn è stato cancellato (Task 11): la densità "poster" ora è
// WizardCard density="full". Il vecchio sistema di ornamenti PER TIER (corona
// leggendaria/filigrana epica, testId tier-legendary-crown/tier-epic-filigree) è stato
// sostituito — per design, Task 7 — da RarityPips: le stesse quattro tacche per ogni
// tier, accese in proporzione alla rarità (vedi tests/cards/RarityPips.test.tsx).
describe('WizardCard density="full" (poster layout)', () => {
  it('renders name, spell name, and the four stat labels', () => {
    const d = harry()
    render(<WizardCard drafted={d} density="full" testId="col-0" />)
    expect(screen.getByTestId('col-0')).toBeInTheDocument()
    expect(screen.getByText(displayName(d))).toBeInTheDocument()
    expect(screen.getByText(d.spell.name)).toBeInTheDocument()
    for (const l of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(l)).toBeInTheDocument()
  })

  it('renders without the affiliation strip (removed per approved mockup)', () => {
    render(<WizardCard drafted={harry()} density="full" />)
    expect(screen.queryByTestId('affiliation-strip')).toBeNull()
  })

  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(<WizardCard drafted={harry()} density="full" onClick={onClick} testId="col-0" />)
    screen.getByTestId('col-0').click()
    expect(onClick).toHaveBeenCalled()
  })

  describe('rarity pips (replace the old per-tier crown/filigree)', () => {
    it('lights all four pips for tier 1 (legendary)', () => {
      render(<WizardCard drafted={harry()} density="full" />)
      expect(document.querySelectorAll('[data-lit="true"]')).toHaveLength(4)
    })
    it('lights one pip for tier 4 (common)', () => {
      render(<WizardCard drafted={seamus()} density="full" />)
      expect(document.querySelectorAll('[data-lit="true"]')).toHaveLength(1)
    })
    it('lights a proportionate number of pips for tier 2 and tier 3', () => {
      const { unmount } = render(<WizardCard drafted={snape()} density="full" />)
      const t2 = document.querySelectorAll('[data-lit="true"]').length
      unmount()
      render(<WizardCard drafted={hermione()} density="full" />)
      const t3 = document.querySelectorAll('[data-lit="true"]').length
      expect(t2).toBeGreaterThan(t3)
      expect(t3).toBeGreaterThan(1)
    })
  })
})
