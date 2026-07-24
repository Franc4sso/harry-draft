import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapScreen } from '@/components/screens/MapScreen'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'

describe('MapScreen with area-scoped ids', () => {
  it('renders area floors and reports the chosen node', async () => {
    const map = generateArea(createRng('m').fork(4).fork(0), 'm', 0, { teamSize: 2, teamMax: 5 })
    const entry = map.find(n => n.id.includes('f0n'))!
    const onChoose = vi.fn()
    render(
      <MapScreen map={map} currentNodeId={entry.id} reachableIds={entry.next} area={0} areasTotal={3} onChoose={onChoose} />,
    )
    expect(screen.getByText(/Area 1/)).toBeInTheDocument()
    const target = map.find(n => n.id === entry.next[0])!
    await userEvent.click(screen.getByTestId(`node-${target.id}`))
    expect(onChoose).toHaveBeenCalledWith(target.id)
  }, 15000)

  it('shows an infinite total (∞), never a bogus "/ 1", when no areasTotal is given (endless)', () => {
    const map = generateArea(createRng('m').fork(4).fork(0), 'm', 2, { teamSize: 2, teamMax: 5 })
    const entry = map.find(n => n.id.includes('n'))!
    render(
      <MapScreen map={map} currentNodeId={entry.id} reachableIds={entry.next} area={2} onChoose={vi.fn()} />,
    )
    expect(screen.getByText(/Area 3 \/ ∞/)).toBeInTheDocument()
    expect(screen.queryByText(/Area 3 \/ 1/)).toBeNull()
  })
})
