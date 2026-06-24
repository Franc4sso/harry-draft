import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VictoryScreen } from '@/components/screens/VictoryScreen'
import type { BattleResult } from '@/types'

const baseResult = (snap: BattleResult['finalSnapshot']): BattleResult => ({
  winner: 'left', turns: 3, log: [], mvpId: 'a', finalSnapshot: snap, snapshots: [],
})

describe('VictoryScreen attrition', () => {
  it('names a wizard that fell this battle', () => {
    const result = baseResult([
      { id: 'a', side: 'left', hp: 50, maxHp: 100, alive: true },
      { id: 'b', side: 'left', hp: 0, maxHp: 100, alive: false },
    ])
    render(
      <VictoryScreen
        result={result} mvpName="A" battleNumber={1} enemyCount={4} bossNext={false}
        onNext={() => {}} fallenNames={['B']}
      />,
    )
    expect(screen.getByText(/B/)).toBeDefined()
    expect(screen.getByText(/Caduti|perso/i)).toBeDefined()
  })

  it('shows no death notice when nobody fell', () => {
    const result = baseResult([{ id: 'a', side: 'left', hp: 90, maxHp: 100, alive: true }])
    render(
      <VictoryScreen
        result={result} mvpName="A" battleNumber={1} enemyCount={4} bossNext={false}
        onNext={() => {}} fallenNames={[]}
      />,
    )
    expect(screen.queryByText(/Caduti/i)).toBeNull()
  })
})
