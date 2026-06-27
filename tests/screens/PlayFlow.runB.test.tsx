import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

import { PlayFlow } from '@/components/screens/PlayFlow'
import { clearRun } from '@/lib/runStore'

beforeEach(() => {
  try { clearRun() } catch { /* ignore */ }
  localStorage.clear()
})

describe('PlayFlow → new loop', () => {
  it('starts the new loop at house selection', () => {
    render(<PlayFlow seed="pf-seed" />)
    expect(screen.getByText(/Scegli la tua Casa/)).toBeInTheDocument()
  })
})
