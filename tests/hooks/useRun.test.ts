import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun, reachableFrom } from '@/hooks/useRun'
import { startRun, confirmTeam } from '@/game/engine/run'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function playerTeam() {
  const r = createRng(99)
  return WIZARDS.slice(0, 5).map(w => draftWizard(r, w))
}

describe('useRun map flow', () => {
  it('starts on the team view; entering the map exposes a current node and reachable next nodes', () => {
    const { result } = renderHook(() => useRun('seed-map', playerTeam()))
    expect(result.current.view).toBe('team')
    // current node + reachable derive from the generated graph straight away
    expect(result.current.currentNode).toBeDefined()
    expect(Array.isArray(result.current.reachable)).toBe(true)
    expect(result.current.reachable.length).toBeGreaterThan(0)

    act(() => result.current.enterMap())
    expect(result.current.view).toBe('map')
  })

  it('chooseNode advances along the graph and starts a battle', () => {
    const { result } = renderHook(() => useRun('seed-map', playerTeam()))
    const target = result.current.reachable[0]!.id

    act(() => result.current.chooseNode(target))

    expect(result.current.run.currentNodeId).toBe(target)
    expect(result.current.view).toBe('battle')
    expect(result.current.battle).not.toBeNull()
  })

  it('chooseRelic returns to the map instead of auto-starting the next battle', () => {
    const { result } = renderHook(() => useRun('seed-map', playerTeam()))
    const relic = result.current.relicChoices[0]!

    act(() => result.current.chooseRelic(relic))

    expect(result.current.view).toBe('map')
    expect(result.current.run.relics.map(r => r.relic)).toContain(relic)
  })

  it('battleNumber reflects node depth (start = 0) and bossNext tracks the boss node', () => {
    const { result } = renderHook(() => useRun('seed-map', playerTeam()))
    // The start node is floor 0 (the un-fought start position), so battleNumber
    // is 0; the first fought node (floor 1) reads "Sfida 1". bossNext is false
    // until the player sits on the boss node.
    expect(result.current.battleNumber).toBe(0)
    expect(result.current.bossNext).toBe(false)
    // Walking the first edge moves to floor 1 => "Sfida 1".
    const target = result.current.reachable[0]!.id
    act(() => result.current.chooseNode(target))
    expect(result.current.battleNumber).toBe(1)
  })
})

describe('reachableFrom (pure helper)', () => {
  it('returns the current node next nodes', () => {
    const s = confirmTeam(startRun('seed-map'), playerTeam())
    const r = reachableFrom(s)
    expect(r.map(n => n.id)).toEqual(s.map![0]!.next)
  })
})
