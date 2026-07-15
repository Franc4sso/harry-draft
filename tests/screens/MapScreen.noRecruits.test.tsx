import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapScreen } from '@/components/screens/MapScreen'
import type { RunNode } from '@/types'

function makeMap(): RunNode[] {
  return [
    { id: 'a0f0n0', type: 'battle', next: ['a0f1n0'], resolved: false },
    { id: 'a0f1n0', type: 'recruit', next: [], resolved: false },
  ] as unknown as RunNode[]
}

describe('MapScreen — noRecruits (Voto Infrangibile)', () => {
  it('marks the recruit node visually disabled/barred and shows the reason when noRecruits', () => {
    const map = makeMap()
    render(
      <MapScreen map={map} currentNodeId="a0f0n0" reachableIds={['a0f1n0']} onChoose={() => {}} noRecruits />,
    )
    const node = screen.getByTestId('node-a0f1n0')
    expect(node.getAttribute('data-blocked')).toBe('true')
    expect(screen.getByTestId('node-a0f1n0-reason')).toHaveTextContent(/Il Voto Infrangibile è stato giurato/i)
  })

  it('without noRecruits, the recruit node is not marked blocked', () => {
    const map = makeMap()
    render(
      <MapScreen map={map} currentNodeId="a0f0n0" reachableIds={['a0f1n0']} onChoose={() => {}} />,
    )
    const node = screen.getByTestId('node-a0f1n0')
    expect(node.getAttribute('data-blocked')).toBeNull()
    expect(screen.queryByTestId('node-a0f1n0-reason')).toBeNull()
  })
})
