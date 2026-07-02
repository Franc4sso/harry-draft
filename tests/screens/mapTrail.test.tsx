import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MapScreen } from '@/components/screens/MapScreen'
import type { RunNode } from '@/types'

const map: RunNode[] = [
  { id: 'a0f0n0', type: 'battle', next: ['a0f1n0'], resolved: false } as RunNode,
  { id: 'a0f1n0', type: 'elite', next: [], resolved: false } as RunNode,
]

describe('map live trail', () => {
  it('renders a single stroked path per live edge (no dual-animation flicker)', () => {
    const { container } = render(
      <MapScreen map={map} currentNodeId="a0f0n0" reachableIds={['a0f1n0']} onChoose={() => {}} area={0} areasTotal={1} />,
    )
    // Live edge: one main stroke marked data-live-edge; glow twin is aria-hidden data-edge-glow.
    expect(container.querySelectorAll('[data-live-edge]').length).toBe(1)
    expect(container.querySelectorAll('[data-edge-glow]').length).toBe(1)
  })
})
