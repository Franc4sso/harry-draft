import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapScreen } from '@/components/screens/MapScreen'
import type { RunNode } from '@/types'

const node = (over: Partial<RunNode>): RunNode => ({ id: 'a0f1n0', type: 'battle', next: [], ...over })

describe('MapScreen telegraph', () => {
  const base = {
    currentNodeId: 'a0f0n0', reachableIds: ['a0f1n0'], onChoose: () => {}, area: 0, areasTotal: 3,
  }
  it('renders synergy badges for a combat node with preview', () => {
    const map: RunNode[] = [
      node({ id: 'a0f0n0', type: 'battle', next: ['a0f1n0'] }),
      node({ id: 'a0f1n0', type: 'battle', next: [], preview: { synergyIds: ['slytherin3'] } }),
    ]
    render(<MapScreen map={map} {...base} />)
    expect(screen.getByTestId('telegraph-a0f1n0')).toBeInTheDocument()
    expect(screen.getByTestId('telegraph-a0f1n0').querySelector('[data-synergy="slytherin3"]')).toBeTruthy()
  })

  it('renders NO telegraph for a node without synergies', () => {
    const map: RunNode[] = [
      node({ id: 'a0f0n0', type: 'battle', next: ['a0f1n0'] }),
      node({ id: 'a0f1n0', type: 'battle', next: [], preview: { synergyIds: [] } }),
    ]
    render(<MapScreen map={map} {...base} />)
    expect(screen.queryByTestId('telegraph-a0f1n0')).toBeNull()
  })

  it('renders telegraph with boss name even when synergyIds is empty', () => {
    const map: RunNode[] = [
      node({ id: 'a0f0n0', type: 'battle', next: ['a0f1n0'] }),
      node({ id: 'a0f1n0', type: 'boss', next: [], preview: { synergyIds: [], bossName: 'Lord Voldemort' } }),
    ]
    render(<MapScreen map={map} {...base} />)
    expect(screen.getByTestId('telegraph-a0f1n0')).toBeInTheDocument()
    expect(screen.getByTestId('telegraph-a0f1n0').textContent).toContain('Lord Voldemort')
  })

  it('renders NO telegraph for a combat node with no preview at all', () => {
    const map: RunNode[] = [
      node({ id: 'a0f0n0', type: 'battle', next: ['a0f1n0'] }),
      node({ id: 'a0f1n0', type: 'battle', next: [] }),
    ]
    render(<MapScreen map={map} {...base} />)
    expect(screen.queryByTestId('telegraph-a0f1n0')).toBeNull()
  })
})
