import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayFlow } from '@/components/screens/PlayFlow'
import { BALANCE } from '@/data/constants'

describe('PlayFlow', () => {
  it('starts in draft and reaches the team screen after a full draft', async () => {
    render(<PlayFlow seed="flow-seed" />)
    // draft phase: progress visible
    expect(screen.getByText(/Mago 1 \//i)).toBeInTheDocument()

    // pick the first card teamSize times by clicking the first visible card each round
    for (let i = 0; i < BALANCE.draft.teamSize; i++) {
      const cards = screen.getAllByRole('button')
      // the wizard cards are role=button; click the first card-like button
      // find a card button (has a tabindex via WizardCard) — click the first one that isn't a nav
      const card = cards[0]!
      await userEvent.click(card)
    }

    // team phase
    expect(await screen.findByText(/La tua squadra/i)).toBeInTheDocument()
    expect(screen.getByText(/Sinergie attive/i)).toBeInTheDocument()
  })
})
