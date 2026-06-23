import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VictoryScreen } from '@/components/screens/VictoryScreen'
import { BossScreen } from '@/components/screens/BossScreen'
import { ResultScreen } from '@/components/screens/ResultScreen'
import type { BattleResult } from '@/types'

function fakeResult(winner: 'left' | 'right' = 'left'): BattleResult {
  return {
    winner,
    turns: 12,
    log: [],
    mvpId: 'harry',
    finalSnapshot: [
      { id: 'harry', side: 'left', hp: 50, maxHp: 100, alive: true },
      { id: 'ron', side: 'left', hp: 0, maxHp: 100, alive: false },
    ],
  }
}

describe('VictoryScreen', () => {
  it('shows the MVP and survivor count and advances', async () => {
    const onNext = vi.fn()
    render(
      <VictoryScreen
        result={fakeResult()} mvpName="Harry Potter" battleNumber={2}
        enemyCount={5} bossNext={false} onNext={onNext}
      />,
    )
    expect(screen.getByText(/Vittoria/i)).toBeInTheDocument()
    expect(screen.getByText(/Harry Potter/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /prossima sfida/i }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('offers the boss when it is next', () => {
    render(
      <VictoryScreen
        result={fakeResult()} mvpName="Harry Potter" battleNumber={5}
        enemyCount={5} bossNext onNext={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /boss/i })).toBeInTheDocument()
  })
})

describe('BossScreen', () => {
  it('shows the boss name and begins the fight', async () => {
    const onBegin = vi.fn()
    render(<BossScreen bossName="Lord Voldemort" onBegin={onBegin} />)
    expect(screen.getByText('Lord Voldemort')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /inizia/i }))
    expect(onBegin).toHaveBeenCalledOnce()
  })
})

describe('ResultScreen', () => {
  it('celebrates a win and restarts', async () => {
    const onRestart = vi.fn()
    render(<ResultScreen outcome="win" seed="abc" stageReached={6} enemyCount={5} onRestart={onRestart} />)
    expect(screen.getByText(/Campione/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /nuova run/i }))
    expect(onRestart).toHaveBeenCalledOnce()
  })

  it('reports a defeat with the stage reached', () => {
    render(<ResultScreen outcome="defeat" seed="abc" stageReached={3} enemyCount={5} onRestart={vi.fn()} />)
    expect(screen.getByText(/Sconfitta/i)).toBeInTheDocument()
    expect(screen.getByText(/sfida 3 di 5/i)).toBeInTheDocument()
  })
})
