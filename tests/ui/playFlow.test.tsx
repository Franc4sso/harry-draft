// NOTE: This test was updated when PlayFlow was flipped from the legacy
// DraftScreen → CampaignRunner flow to the new RunBRunner loop (Task 10).
// The old draft-to-team interaction test is retired here; the full
// draft → pick 2 → map flow is covered in tests/screens/RunBRunner.test.tsx.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { clearRun } from '@/lib/runStore'

// RunBRunner (mounted by PlayFlow) routes its "Collezione" button via useRouter —
// stub it since this test renders outside the Next.js App Router tree.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// Render Framer Motion synchronously without AnimatePresence's exit-deferral.
vi.mock('framer-motion', () => {
  const cache = new Map<string, (p: Record<string, unknown> & { children?: React.ReactNode }) => React.ReactNode>()
  const passthrough = (tag: string) => {
    if (!cache.has(tag)) {
      const Comp = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
        // Drop motion-only props so they don't hit the DOM.
        const { initial: _i, animate: _a, exit: _e, transition: _t, whileHover: _h, layout: _l, ...rest } = props
        void _i; void _a; void _e; void _t; void _h; void _l
        return require('react').createElement(tag, rest, children)
      }
      cache.set(tag, Comp)
    }
    return cache.get(tag)!
  }
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(tag) }),
    useReducedMotion: () => false,
  }
})

// Import AFTER the mock is registered.
const { PlayFlow } = await import('@/components/screens/PlayFlow')

beforeEach(() => {
  try { clearRun() } catch { /* ignore */ }
  localStorage.clear()
})

describe('PlayFlow', () => {
  it('delegates to the new run loop — shows the draft screen on fresh start', () => {
    render(<PlayFlow seed="flow-seed" />)
    expect(screen.getByTestId('draft-screen')).toBeInTheDocument()
  })
})
