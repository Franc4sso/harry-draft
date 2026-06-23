import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapScreen } from '@/components/screens/MapScreen'
import { generateMap, mapRngChannel } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'

describe('MapScreen', () => {
  it('renders the start node and its reachable nodes', () => {
    const map = generateMap(createRng('smoke').fork(mapRngChannel))
    render(<MapScreen map={map} currentNodeId={map[0]!.id} reachableIds={map[0]!.next} onChoose={() => {}} />)
    expect(screen.getByText('Scegli il tuo cammino')).toBeDefined()
  })
})
