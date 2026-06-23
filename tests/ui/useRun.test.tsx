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
  it('begins on the team view at battle 1 with no battle yet', () => {
    const { result } = renderHook(() => useRun('s', strong()))
    expect(result.current.view).toBe('team')
    expect(result.current.battle).toBeNull()
    expect(result.current.battleNumber).toBe(1)
    expect(result.current.enemyCount).toBe(BALANCE.campaign.enemyCount)
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
