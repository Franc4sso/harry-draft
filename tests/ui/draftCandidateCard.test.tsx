import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('DraftCandidateCard', () => {
  // The affiliation-strip (synergy pills atop the card) was removed per the
  // approved mockup — synergies still surface via the synergy nudge at the
  // bottom of the card and the synergy tracker panel, so no info is lost.
  it('renders the candidate card for the drafted wizard', () => {
    const drafted = harry()
    render(<DraftCandidateCard drafted={drafted} />)
    expect(screen.getByText(displayName(drafted))).toBeInTheDocument()
    expect(screen.queryByTestId('affiliation-strip')).toBeNull()
  })
  it('fires onConsider on pointer enter and onPick on click', () => {
    const onConsider = vi.fn(); const onPick = vi.fn()
    const drafted = harry()
    const { container } = render(<DraftCandidateCard drafted={drafted} onConsider={onConsider} onPick={onPick} />)
    fireEvent.pointerEnter(container.firstChild as Element)
    expect(onConsider).toHaveBeenCalled()
    fireEvent.click(screen.getByText(displayName(drafted)))
    expect(onPick).toHaveBeenCalled()
  })
  it('fires onConsider on focus', () => {
    const onConsider = vi.fn()
    const { container } = render(<DraftCandidateCard drafted={harry()} onConsider={onConsider} />)
    fireEvent.focus(container.firstChild as Element)
    expect(onConsider).toHaveBeenCalled()
  })
})
