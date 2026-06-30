import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapScreen } from '@/components/screens/MapScreen'
import { generateArea, mapRngChannel } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'

describe('MapScreen', () => {
  it('renders the start node and its reachable nodes', () => {
    const map = generateArea(createRng('smoke').fork(mapRngChannel), 'smoke', 0, { teamSize: 2, teamMax: 5 })
    render(<MapScreen map={map} currentNodeId={map[0]!.id} reachableIds={map[0]!.next} onChoose={() => {}} />)
    expect(screen.getByText('Scegli il tuo cammino')).toBeDefined()
  })
})
