import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftProgress } from '@/components/draft/DraftProgress'
import { DraftSlot } from '@/components/draft/DraftSlot'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const card = draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('DraftProgress', () => {
  it('shows the current pick number while drafting', () => {
    render(<DraftProgress picked={2} total={5} />)
    expect(screen.getByText(/Mago 3 \/ 5/i)).toBeInTheDocument()
  })
})

describe('DraftSlot', () => {
  it('renders the card and fires onPick on click', async () => {
    const onPick = vi.fn()
    render(<DraftSlot drafted={card} onPick={onPick} />)
    await userEvent.click(screen.getByText(card.wizard.name))
    expect(onPick).toHaveBeenCalledOnce()
  })
  it('does not fire onPick when disabled', async () => {
    const onPick = vi.fn()
    render(<DraftSlot drafted={card} onPick={onPick} disabled />)
    await userEvent.click(screen.getByText(card.wizard.name))
    expect(onPick).not.toHaveBeenCalled()
  })
})
