import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftScreen } from '@/components/screens/DraftScreen'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import type { DraftedWizard } from '@/types'

describe('DraftScreen', () => {
  it('shows a screen of 3 candidates', () => {
    render(<DraftScreen seed="ds-seed" onComplete={() => {}} />)
    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`draft-pick-${i}`)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('draft-pick-3')).toBeNull()
    expect(screen.getByText(new RegExp(`Pesca 0/${STARTER_PICKS}`))).toBeInTheDocument()
  })

  it('fires onComplete with STARTER_PICKS wizards after picking', async () => {
    let picked: DraftedWizard[] | null = null
    const onComplete = vi.fn((team: DraftedWizard[]) => { picked = team })
    render(<DraftScreen seed="ds-seed" onComplete={onComplete} />)

    // pick the first candidate on each successive screen until the draft ends
    for (let i = 0; i < STARTER_PICKS; i++) {
      await userEvent.click(screen.getByTestId('draft-pick-0'))
    }

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(picked).toHaveLength(STARTER_PICKS)
  }, 15000)
})
