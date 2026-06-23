import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BALANCE } from '@/data/constants'

// Render Framer Motion synchronously without AnimatePresence's exit-deferral.
// This test verifies the draft→team flow wiring, not the animation. Without
// the mock, exiting cards linger in the DOM during the popLayout transition,
// so `getAllByRole('button')[0]` can grab a stale exiting card under parallel
// test load — making the test flaky. Stripping the animation makes each click
// land deterministically on the current screen's cards.
//
// IMPORTANT: the cache below is required. The Proxy getter is called on every
// render, so without caching it creates a new component function each time.
// React treats a new function reference as a different component type and
// unmounts + remounts the subtree — detaching any DOM node userEvent is
// holding a reference to mid-click, so onClick never fires.
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
  }
})

// Import AFTER the mock is registered.
const { PlayFlow } = await import('@/components/screens/PlayFlow')

describe('PlayFlow', () => {
  it('starts in draft and reaches the team screen after a full draft', async () => {
    render(<PlayFlow seed="flow-seed" />)
    const total = BALANCE.draft.teamSize

    // draft phase: first screen visible (new layout uses heading instead of DraftProgress)
    expect(screen.getByText(/Scegli il 1/i)).toBeInTheDocument()

    for (let i = 0; i < total; i++) {
      // With animations stripped, the only role=button elements are the current
      // screen's wizard cards. Re-query each round and click the first.
      const cards = screen.getAllByRole('button')
      await userEvent.click(cards[0]!)
    }

    // After the final pick the flow transitions to the team screen.
    expect(await screen.findByText(/La tua squadra/i)).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getByText(/Sinergie attive/i)).toBeInTheDocument()
  })
})
