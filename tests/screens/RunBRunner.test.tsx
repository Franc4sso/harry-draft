import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
})
import { RunBRunner } from '@/components/screens/RunBRunner'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('RunBRunner', () => {
  it(`drives draft → pick ${STARTER_PICKS} → map`, async () => {
    render(<RunBRunner seed="seed-runner" />)
    expect(screen.getByTestId('draft-screen')).toBeInTheDocument()
    // pick first card on each of the STARTER_PICKS starter screens
    for (let i = 0; i < STARTER_PICKS; i++) {
      await userEvent.click(screen.getByTestId('draft-pick-0'))
    }
    expect(screen.getByText(/Scegli il tuo cammino/)).toBeInTheDocument()
  }, 15000)

  it('shows the team+synergy bar on map but not during draft', async () => {
    render(<RunBRunner seed="seed-runner" />)
    // draft phase: no persistent bar
    expect(screen.getByTestId('draft-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('team-synergy-bar')).not.toBeInTheDocument()
    // drive to map
    for (let i = 0; i < STARTER_PICKS; i++) {
      await userEvent.click(screen.getByTestId('draft-pick-0'))
    }
    expect(screen.getByText(/Scegli il tuo cammino/)).toBeInTheDocument()
    // map phase: bar is mounted as a persistent strip
    expect(screen.getByTestId('team-synergy-bar')).toBeInTheDocument()
  })
})
