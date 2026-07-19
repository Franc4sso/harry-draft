import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
// RunBRunner routes its "Collezione" button via useRouter — stub it since this
// test renders outside the Next.js App Router tree (mirrors tests/screens/RunBRunner.test.tsx).
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
})
import { RunBRunner } from '@/components/screens/RunBRunner'
import { TUTORIAL_SEED } from '@/game/engine/tutorialOffer'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('RunBRunner tutorial mode', () => {
  it('mounts the coach-mark overlay in tutorial mode at the draft', () => {
    render(<RunBRunner seed={TUTORIAL_SEED} tutorial />)
    // draft is the first screen; the draft step should render
    expect(screen.getByTestId('tutorial-coachmark')).toBeInTheDocument()
    expect(screen.getByText('Pesca la tua squadra')).toBeInTheDocument()
  })
  it('does NOT mount the overlay without tutorial mode', () => {
    render(<RunBRunner seed="normal-seed" />)
    expect(screen.queryByTestId('tutorial-coachmark')).toBeNull()
  })
})
