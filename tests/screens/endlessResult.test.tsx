import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EndlessResult } from '@/components/screens/EndlessResult'

beforeEach(() => localStorage.clear())

describe('EndlessResult', () => {
  it('shows the final score and floor', () => {
    render(<EndlessResult score={2100} floor={21} challengeCode="abc" />)
    expect(screen.getByText(/2100/)).toBeInTheDocument()
    expect(screen.getByText(/21/)).toBeInTheDocument()
  })

  it('records the run as a local best on mount', () => {
    render(<EndlessResult score={2100} floor={21} challengeCode="abc" />)
    const bests = JSON.parse(localStorage.getItem('endless.bests') ?? '[]')
    expect(bests).toEqual([{ score: 2100, floor: 21 }])
  })

  it('prefills the nickname input from local storage', () => {
    localStorage.setItem('endless.nickname', 'Harry')
    render(<EndlessResult score={2100} floor={21} challengeCode="abc" />)
    expect(screen.getByDisplayValue('Harry')).toBeInTheDocument()
  })

  it('shows a disabled or no-op submit button (Task 9 wires the network call)', () => {
    render(<EndlessResult score={2100} floor={21} challengeCode="abc" />)
    expect(screen.getByRole('button', { name: /invia|submit/i })).toBeInTheDocument()
  })

  it('offers a way back to the main menu (not a dead end)', () => {
    render(<EndlessResult score={2100} floor={21} challengeCode="abc" />)
    const menu = screen.getByRole('link', { name: /menu principale/i })
    expect(menu).toHaveAttribute('href', '/')
  })
})
