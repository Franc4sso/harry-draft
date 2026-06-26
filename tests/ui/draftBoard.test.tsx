import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { displayName } from '@/lib/displayName'

const candidates = WIZARDS.slice(0, 5).map((w, i) => draftWizard(createRng(i + 1), w))

describe('DraftBoard', () => {
  it('renders all candidate cards and the progress', () => {
    render(<DraftBoard candidates={candidates} picked={0} total={5} onPick={() => {}} />)
    for (const c of candidates) expect(screen.getByText(displayName(c))).toBeInTheDocument()
    expect(screen.getByText(/Mago 1 \/ 5/i)).toBeInTheDocument()
  })
  it('calls onPick with the clicked index', async () => {
    const onPick = vi.fn()
    render(<DraftBoard candidates={candidates} picked={0} total={5} onPick={onPick} />)
    await userEvent.click(screen.getByText(displayName(candidates[2]!)))
    expect(onPick).toHaveBeenCalledWith(2)
  })
})
