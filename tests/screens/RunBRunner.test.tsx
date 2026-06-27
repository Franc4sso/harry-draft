import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
})
import { RunBRunner } from '@/components/screens/RunBRunner'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('RunBRunner', () => {
  it('drives draft → pick 2 → map', async () => {
    render(<RunBRunner seed="seed-runner" />)
    expect(screen.getByTestId('draft-screen')).toBeInTheDocument()
    // pick first card on each of the two starter screens
    await userEvent.click(screen.getByTestId('draft-pick-0'))
    await userEvent.click(screen.getByTestId('draft-pick-0'))
    expect(screen.getByText(/Scegli il tuo cammino/)).toBeInTheDocument()
  })
})
