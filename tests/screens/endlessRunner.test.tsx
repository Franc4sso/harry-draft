import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EndlessRunner } from '@/components/screens/EndlessRunner'

beforeEach(() => { try { localStorage.clear() } catch {} })

describe('EndlessRunner', () => {
  it('routes the initial draft phase to the campaign DraftScreen (no house pick)', () => {
    render(<EndlessRunner seed="endless-runner-seed" />)

    // DraftScreen's screen-draft candidate UI is present...
    expect(screen.getByTestId('draft-pick-0')).toBeInTheDocument()
    expect(screen.getByTestId('draft-screen')).toBeInTheDocument()

    // ...and the retired house-pick UI is gone.
    expect(screen.queryByTestId('endless-starter-pick')).toBeNull()
    expect(screen.queryByTestId('endless-house-Grifondoro')).toBeNull()
    expect(screen.queryByText(/scegli la tua casa/i)).toBeNull()
  })
})
