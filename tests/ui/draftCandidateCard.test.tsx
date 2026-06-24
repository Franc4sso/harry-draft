import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('DraftCandidateCard affiliation strip', () => {
  it('shows a name-only special-synergy strip (house/role live on the frame, not the strip)', () => {
    const drafted = harry()
    render(<DraftCandidateCard drafted={drafted} />)
    const strip = screen.getByTestId('affiliation-strip')
    // Harry's special group synergy.
    expect(within(strip).getByText(/Golden Trio/i)).toBeInTheDocument()
    // House/role are no longer text pills in the strip.
    expect(within(strip).queryByText(drafted.wizard.house)).toBeNull()
    expect(within(strip).queryByText(drafted.wizard.role)).toBeNull()
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
