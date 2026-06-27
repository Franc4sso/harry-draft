// NOTE: This test was updated when PlayFlow was flipped from the legacy
// DraftScreen → CampaignRunner flow to the new RunBRunner loop (Task 10).
// The old draft-to-team interaction test is retired here; the full
// house → starter → map flow is covered in tests/screens/RunBRunner.test.tsx.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { clearRun } from '@/lib/runStore'

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
  it('delegates to the new run loop — shows house selection on fresh start', () => {
    render(<PlayFlow seed="flow-seed" />)
    expect(screen.getByText(/Scegli la tua Casa/i)).toBeInTheDocument()
  })
})
