import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

// Strip Framer Motion animations so screens render synchronously without
// AnimatePresence exit-deferral (mirrors the playFlow test approach).
vi.mock('framer-motion', () => {
  const passthrough = (tag: string) => {
    const Comp = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
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

const { CampaignRunner } = await import('@/components/screens/CampaignRunner')

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('CampaignRunner', () => {
  it('runs team → battle → result and reaches a decisive screen', async () => {
    const t = team(['harry', 'hermione', 'snape', 'dumbledore', 'mcgonagall'], 3)
    render(<CampaignRunner seed="run-seed" team={t} onRestart={vi.fn()} />)

    // Team view first.
    expect(screen.getByText(/La tua squadra/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /combatti/i }))

    // Graph progression: confirming the team now lands on the run map.
    expect(await screen.findByText(/Scegli il tuo cammino/i)).toBeInTheDocument()
    // Click the first *reachable* (enabled) node to start the first fight.
    const choosable = screen.getAllByRole('button').find(b => !(b as HTMLButtonElement).disabled)!
    await userEvent.click(choosable)

    // Battle view: first fight is floor 1 → "Sfida 1 di 4".
    expect(await screen.findByText(/Sfida 1 di 4/i)).toBeInTheDocument()

    // Skip the replay, then settle the result.
    await userEvent.click(screen.getByRole('button', { name: /salta/i }))
    await userEvent.click(await screen.findByRole('button', { name: /continua|vedi esito/i }))

    // Either we won the stage (Vittoria) or lost the run (Sconfitta).
    const settled = await screen.findByText(/Vittoria|Sconfitta/i)
    expect(settled).toBeInTheDocument()
  })

  it('lets the player abandon the run from the team screen', async () => {
    const onRestart = vi.fn()
    const t = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 5)
    render(<CampaignRunner seed="x" team={t} onRestart={onRestart} />)
    await userEvent.click(screen.getByRole('button', { name: /nuova run/i }))
    expect(onRestart).toHaveBeenCalledOnce()
  })
})
