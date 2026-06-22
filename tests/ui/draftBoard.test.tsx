import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const candidates = WIZARDS.slice(0, 5).map((w, i) => draftWizard(createRng(i + 1), w))

describe('DraftBoard', () => {
  it('renders all candidate cards and the progress', () => {
    render(<DraftBoard candidates={candidates} picked={0} total={5} onPick={() => {}} />)
    for (const c of candidates) expect(screen.getByText(c.wizard.name)).toBeInTheDocument()
    expect(screen.getByText(/Mago 1 \/ 5/i)).toBeInTheDocument()
  })
  it('calls onPick with the clicked index', async () => {
    const onPick = vi.fn()
    render(<DraftBoard candidates={candidates} picked={0} total={5} onPick={onPick} />)
    await userEvent.click(screen.getByText(candidates[2]!.wizard.name))
    expect(onPick).toHaveBeenCalledWith(2)
  })
})
