import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('DraftCandidateCard affiliation strip', () => {
  it('shows a single name-only strip: house + role + specials, no counts', () => {
    render(<DraftCandidateCard drafted={harry()} />)
    const strip = screen.getByTestId('affiliation-strip')
    expect(within(strip).getByText('Grifondoro')).toBeInTheDocument()
    expect(within(strip).getByText('Attaccante')).toBeInTheDocument()
    // never a count-prefixed label
    expect(within(strip).queryByText(/^\d/)).toBeNull()
  })
  it('marks a hot chip when its synergy id is in hotSynergyIds', () => {
    render(<DraftCandidateCard drafted={harry()} hotSynergyIds={new Set(['goldenTrio'])} />)
    const strip = screen.getByTestId('affiliation-strip')
    expect(strip.querySelector('[data-synergy="goldenTrio"][data-hot]')).not.toBeNull()
  })
  it('fires onConsider on pointer enter and onPick on click', () => {
    const onConsider = vi.fn(); const onPick = vi.fn()
    const { container } = render(<DraftCandidateCard drafted={harry()} onConsider={onConsider} onPick={onPick} />)
    fireEvent.pointerEnter(container.firstChild as Element)
    expect(onConsider).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Harry Potter'))
    expect(onPick).toHaveBeenCalled()
  })
  it('fires onConsider on focus', () => {
    const onConsider = vi.fn()
    const { container } = render(<DraftCandidateCard drafted={harry()} onConsider={onConsider} />)
    fireEvent.focus(container.firstChild as Element)
    expect(onConsider).toHaveBeenCalled()
  })
})
