import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TutorialProvider } from '@/components/tutorial/TutorialProvider'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import type { TutorialCtx } from '@/components/tutorial/steps'

const ctx = (o: Partial<TutorialCtx> = {}): TutorialCtx => ({ phase: 'draft', hasActiveDuo: false, ...o })

function mount(active: boolean, c = ctx()) {
  return render(
    <TutorialProvider active={active} ctx={c}>
      <div data-testid="draft-pick-0">card</div>
      <TutorialOverlay />
    </TutorialProvider>,
  )
}

describe('TutorialOverlay', () => {
  it('renders the current step title & body when active', () => {
    mount(true)
    expect(screen.getByText('Pesca la tua squadra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avanti/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salta/i })).toBeInTheDocument()
  })
  it('Avanti advances to the next step', () => {
    mount(true)
    fireEvent.click(screen.getByRole('button', { name: /Avanti/i }))
    expect(screen.getByText('I ruoli si contrano')).toBeInTheDocument()
  })
  it('Salta hides the overlay entirely', () => {
    mount(true)
    fireEvent.click(screen.getByRole('button', { name: /Salta/i }))
    expect(screen.queryByText('Pesca la tua squadra')).toBeNull()
  })
  it('renders nothing when inactive', () => {
    mount(false)
    expect(screen.queryByText('Pesca la tua squadra')).toBeNull()
  })
})
