import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TutorialProvider, useTutorial } from '@/components/tutorial/TutorialProvider'
import type { TutorialCtx } from '@/components/tutorial/steps'

function Probe() {
  const { visibleStep, advance, skip, active } = useTutorial()
  return (
    <div>
      <span data-testid="active">{String(active)}</span>
      <span data-testid="step">{visibleStep?.id ?? 'none'}</span>
      <button onClick={advance}>adv</button>
      <button onClick={skip}>skip</button>
    </div>
  )
}
const ctx = (o: Partial<TutorialCtx> = {}): TutorialCtx => ({ phase: 'draft', hasActiveDuo: false, ...o })

describe('TutorialProvider', () => {
  it('shows the draft step first, advances to ruoli in the draft phase', () => {
    render(<TutorialProvider active ctx={ctx()}><Probe /></TutorialProvider>)
    expect(screen.getByTestId('step').textContent).toBe('draft')
    fireEvent.click(screen.getByText('adv'))
    expect(screen.getByTestId('step').textContent).toBe('ruoli')
  })
  it('a step waits (null) until its phase gate holds', () => {
    const { rerender } = render(<TutorialProvider active ctx={ctx()}><Probe /></TutorialProvider>)
    fireEvent.click(screen.getByText('adv')) // -> ruoli
    fireEvent.click(screen.getByText('adv')) // -> autobattle, but phase is draft
    expect(screen.getByTestId('step').textContent).toBe('none')
    rerender(<TutorialProvider active ctx={ctx({ phase: 'battle' })}><Probe /></TutorialProvider>)
    expect(screen.getByTestId('step').textContent).toBe('autobattle')
  })
  it('skip() turns active off and hides the step', () => {
    render(<TutorialProvider active ctx={ctx()}><Probe /></TutorialProvider>)
    fireEvent.click(screen.getByText('skip'))
    expect(screen.getByTestId('active').textContent).toBe('false')
    expect(screen.getByTestId('step').textContent).toBe('none')
  })
  it('inactive provider never shows a step', () => {
    render(<TutorialProvider active={false} ctx={ctx()}><Probe /></TutorialProvider>)
    expect(screen.getByTestId('step').textContent).toBe('none')
  })
})
