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
vi.mock('framer-motion', () => {
  const passthrough = (tag: string) => {
    const Comp = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
      // Drop motion-only props so they don't hit the DOM.
      const { initial: _i, animate: _a, exit: _e, transition: _t, whileHover: _h, layout: _l, ...rest } = props
      void _i; void _a; void _e; void _t; void _h; void _l
      return require('react').createElement(tag, rest, children)
    }
    return Comp
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

    // draft phase: first screen visible
    expect(screen.getByText(/Mago 1 \//i)).toBeInTheDocument()

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
