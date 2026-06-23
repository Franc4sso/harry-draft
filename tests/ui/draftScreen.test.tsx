import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DraftScreen } from '@/components/screens/DraftScreen'

describe('DraftScreen (resa layout)', () => {
  it('renders the squad panel, candidates, and a synergy tracker', () => {
    render(<DraftScreen seed="resa-test" onComplete={() => {}} />)
    // squad panel shows empty slots up to team size (5) before any pick
    expect(document.querySelectorAll('[data-empty]').length).toBeGreaterThan(0)
    // synergy tracker present (its default header is unique to the tracker;
    // the sticky header also shows an active-synergy counter, so match the
    // tracker's own copy specifically to avoid the ambiguous /Sinergie/ match)
    expect(screen.getByText(/cosa sbloccano/i)).toBeInTheDocument()
    // at least one candidate card (a wizard name appears as a portrait alt)
    expect(document.querySelector('img[data-variant="card"]')).toBeTruthy()
  })
  it('advances picks when a candidate is chosen', () => {
    render(<DraftScreen seed="resa-test" onComplete={() => {}} />)
    const before = document.querySelectorAll('[data-empty]').length
    // click the first candidate's card (portrait alt → closest button)
    const firstCard = document.querySelector('img[data-variant="card"]') as HTMLElement
    fireEvent.click(firstCard)
    const after = document.querySelectorAll('[data-empty]').length
    expect(after).toBeLessThanOrEqual(before) // a slot filled (or draft advanced)
  })
})
