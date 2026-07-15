import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { MenuScreen } from '@/components/screens/MenuScreen'
import { ResultScreen } from '@/components/screens/ResultScreen'

beforeEach(() => {
  push.mockClear()
})

describe('MenuScreen play', () => {
  it('launches a run without asking for a seed', () => {
    render(<MenuScreen />)
    // No seed field to fill in — the run is summoned straight away.
    expect(screen.queryByLabelText(/seed/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /gioca/i }))
    expect(push).toHaveBeenCalledWith('/play')
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

describe('ResultScreen main-menu exit', () => {
  it('offers a "Menu principale" button that calls onMenu (defeat is not a dead end)', () => {
    const onMenu = vi.fn()
    render(
      <ResultScreen outcome="defeat" seed="s" stageReached={2} enemyCount={5}
        onRestart={() => {}} onCollection={() => {}} onMenu={onMenu} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /menu principale/i }))
    expect(onMenu).toHaveBeenCalledTimes(1)
  })
  it('omits the menu button when no onMenu handler is wired', () => {
    render(
      <ResultScreen outcome="defeat" seed="s" stageReached={2} enemyCount={5} onRestart={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: /menu principale/i })).not.toBeInTheDocument()
  })
})
