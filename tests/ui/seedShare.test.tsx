import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { MenuScreen } from '@/components/screens/MenuScreen'
import { ResultScreen } from '@/components/screens/ResultScreen'

beforeEach(() => {
  push.mockClear()
})

describe('MenuScreen seed input', () => {
  it('launches a run with the typed seed', async () => {
    render(<MenuScreen />)
    const input = screen.getByLabelText(/seed/i)
    await userEvent.type(input, 'myseed42')
    await userEvent.click(screen.getByRole('button', { name: /gioca/i }))
    expect(push).toHaveBeenCalledWith('/play?seed=myseed42')
  })

  it('launches with a random seed when the field is empty', async () => {
    render(<MenuScreen />)
    await userEvent.click(screen.getByRole('button', { name: /gioca/i }))
    expect(push).toHaveBeenCalledTimes(1)
    const arg = push.mock.calls[0]![0] as string
    expect(arg).toMatch(/^\/play\?seed=[a-z0-9]+$/)
  })

  it('trims surrounding whitespace from the typed seed', async () => {
    render(<MenuScreen />)
    await userEvent.type(screen.getByLabelText(/seed/i), '  spaced  ')
    await userEvent.click(screen.getByRole('button', { name: /gioca/i }))
    expect(push).toHaveBeenCalledWith('/play?seed=spaced')
  })
})

describe('ResultScreen copy seed', () => {
  it('copies the current seed to the clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(
      <ResultScreen outcome="win" seed="abc123" stageReached={6} enemyCount={5} onRestart={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /copia seed/i }))
    expect(writeText).toHaveBeenCalledWith('abc123')
  })
})
