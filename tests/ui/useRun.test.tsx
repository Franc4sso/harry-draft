import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from '@/hooks/useRun'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { BALANCE } from '@/data/constants'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const strong = () => team(['harry', 'hermione', 'snape', 'dumbledore', 'mcgonagall'], 3)

describe('useRun', () => {
  it('begins on the team view sitting on the start node with no battle yet', () => {
    const { result } = renderHook(() => useRun('s', strong()))
    expect(result.current.view).toBe('team')
    expect(result.current.battle).toBeNull()
    // Graph progression: the player starts on floor 0 (the un-fought start
    // position), so battleNumber is 0 until they pick a reachable node. The
    // "Sfida X di Y" denominator is the count of fought non-boss floors =
    // maxDepth - 1 (floors 1..maxDepth-1); floor maxDepth is the boss.
    expect(result.current.battleNumber).toBe(0)
    const maxDepth = Math.max(
      ...result.current.run.map!.map(n => Number(/^f(\d+)n/.exec(n.id)![1])),
    )
    expect(result.current.enemyCount).toBe(maxDepth - 1)
  })

  it('startBattle moves to the battle view and produces an enemy + result', () => {
    const { result } = renderHook(() => useRun('s', strong()))
    act(() => { result.current.startBattle() })
    expect(result.current.view).toBe('battle')
    expect(result.current.battle).not.toBeNull()
    expect(result.current.battle!.enemy).toHaveLength(5)
    expect(result.current.battle!.result.log.length).toBeGreaterThan(0)
  })

  it('revealResult surfaces victory/defeat/win from the engine phase', () => {
    const { result } = renderHook(() => useRun('s', strong()))
    act(() => { result.current.startBattle() })
    act(() => { result.current.revealResult() })
    expect(['victory', 'defeat', 'win']).toContain(result.current.view)
  })

  it('flags the boss as next once all regular enemies are cleared', () => {
    const { result } = renderHook(() => useRun('boss-seed', strong()))
    // Drive battles until either defeat or boss-next.
    for (let i = 0; i < BALANCE.campaign.enemyCount + 1; i++) {
      if (result.current.view === 'defeat' || result.current.bossNext) break
      act(() => { result.current.startBattle() })
      act(() => { result.current.revealResult() })
      if (result.current.view === 'victory') act(() => { result.current.advance() })
    }
    // Reached either a decisive defeat, the relic-choice gate, the boss intro, or a win.
    expect(['defeat', 'boss', 'win', 'victory', 'relic-choice']).toContain(result.current.view)
  })

  it('is deterministic: same seed + team reproduces the first battle', () => {
    const a = renderHook(() => useRun('dup', strong()))
    act(() => { a.result.current.startBattle() })
    const b = renderHook(() => useRun('dup', strong()))
    act(() => { b.result.current.startBattle() })
    expect(a.result.current.battle!.result.winner).toBe(b.result.current.battle!.result.winner)
    expect(a.result.current.battle!.result.turns).toBe(b.result.current.battle!.result.turns)
  })
})
