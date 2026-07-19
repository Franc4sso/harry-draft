import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { StrictMode } from 'react'
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
})
import { DraftScreen } from '@/components/screens/DraftScreen'
import { tutorialStarterOffer } from '@/game/engine/tutorialOffer'

describe('DraftScreen fixed-offer draft (tutorial)', () => {
  // Regression: useFixedDraft.pick called setPicks INSIDE the setRemaining updater.
  // React StrictMode (on by default in `next dev`) double-invokes state updaters, so
  // the chosen wizard was appended to picks twice — the tutorial team came out as
  // [Ernie, Ernie, Cedric] (a wizard duplicated, the third guided pick dropped),
  // firing "two children with the same key" errors in battle.
  it('never duplicates a wizard when picking under StrictMode', () => {
    const offer = tutorialStarterOffer('Tassorosso').slice(0, 3)
    const onComplete = vi.fn()
    render(
      <StrictMode>
        <DraftScreen seed="tutorial" target={3} fixedOffer={offer} onComplete={onComplete} />
      </StrictMode>,
    )
    // Pick the leftmost remaining card three times (each pick removes it from view).
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('draft-pick-0'))
    }
    expect(onComplete).toHaveBeenCalledTimes(1)
    const firstCall = onComplete.mock.calls[0]
    expect(firstCall).toBeDefined()
    const team = firstCall![0] as { wizard: { id: string } }[]
    expect(team).toHaveLength(3)
    const ids = team.map((w) => w.wizard.id)
    expect(new Set(ids).size).toBe(3) // all three guided picks, none duplicated
    expect(new Set(ids)).toEqual(new Set(['ernie', 'cedric', 'sprout']))
  })
})
