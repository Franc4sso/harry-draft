import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AreaClearedScreen } from '@/components/screens/AreaClearedScreen'

describe('AreaClearedScreen', () => {
  it('continues to the next area', async () => {
    const onContinue = vi.fn()
    render(<AreaClearedScreen area={0} areasTotal={3} summary={{ areasCleared: 1, teamSize: 3, avgLevel: 2, relics: 1 }} onContinue={onContinue} />)
    expect(screen.getByText(/Area 1 completata/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Prosegui/ }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('tells the player their team has fully recovered', () => {
    render(<AreaClearedScreen area={0} areasTotal={3} summary={{ areasCleared: 1, teamSize: 3, avgLevel: 2, relics: 1 }} onContinue={vi.fn()} />)
    expect(screen.getByText(/piena salute/i)).toBeInTheDocument()
  })
})
