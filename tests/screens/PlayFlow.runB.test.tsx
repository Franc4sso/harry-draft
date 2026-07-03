import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// RunBRunner (mounted by PlayFlow) routes its "Collezione" button via useRouter —
// stub it since this test renders outside the Next.js App Router tree.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

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
  it('starts the new loop at the draft screen', () => {
    render(<PlayFlow seed="pf-seed" />)
    expect(screen.getByTestId('draft-screen')).toBeInTheDocument()
  })
})
