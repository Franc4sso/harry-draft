// tests/screens/MenuResume.test.tsx
// Guards the "Continua" CTA against finished runs: a run that reached a terminal
// phase (win/defeat) lingers in localStorage but must NOT be offered as resumable —
// clicking it would just re-open the end screen ("continua" that continues nothing).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MenuScreen } from '@/components/screens/MenuScreen'
import { PROFILE_KEY } from '@/lib/metaStore'
import { saveRun, loadRun } from '@/lib/runStore'
import type { RunState } from '@/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const mkRun = (phase: RunState['phase']): RunState => ({
  seed: 'seed-1', phase, team: [], activeSynergies: [], stage: 0, relics: [], area: 1,
})

describe('MenuScreen — resumable-run guard', () => {
  beforeEach(() => { push.mockClear(); localStorage.clear() })

  it('offers Continua for an in-progress run', () => {
    saveRun(mkRun('map'))
    render(<MenuScreen />)
    expect(screen.getByTestId('continue-cta')).toBeInTheDocument()
  })

  it('hides Continua for a finished (win) run AND drops the stale save', () => {
    saveRun(mkRun('win'))
    render(<MenuScreen />)
    expect(screen.queryByTestId('continue-cta')).toBeNull()
    expect(loadRun()).toBeNull()
  })

  it('hides Continua for a defeated run AND drops the stale save', () => {
    saveRun(mkRun('defeat'))
    render(<MenuScreen />)
    expect(screen.queryByTestId('continue-cta')).toBeNull()
    expect(loadRun()).toBeNull()
  })

  it('offers both game modes as distinct, labelled doorways', () => {
    localStorage.removeItem(PROFILE_KEY)
    render(<MenuScreen />)
    // Two co-equal ModeDoor cards: Campagna (play-cta) and Infinita (endless-cta).
    expect(screen.getByTestId('play-cta')).toHaveTextContent(/campagna/i)
    expect(screen.getByTestId('endless-cta')).toHaveTextContent(/infinita/i)
  })
})
