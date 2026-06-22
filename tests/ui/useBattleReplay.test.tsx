import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBattleReplay } from '@/hooks/useBattleReplay'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

function makeReplay() {
  const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
  const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
  return buildReplay(simulateBattle(l, r, createRng(42)), l, r)
}

describe('useBattleReplay', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts paused at the initial frame when autoPlay is off', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    expect(result.current.index).toBe(0)
    expect(result.current.playing).toBe(false)
    expect(result.current.entry).toBeNull()
  })

  it('advances one frame per step when playing', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: true, stepMs: 100 }))
    expect(result.current.index).toBe(0)
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current.index).toBe(1)
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current.index).toBe(2)
  })

  it('skip jumps to the last frame and stops', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => { result.current.skip() })
    expect(result.current.index).toBe(result.current.total - 1)
    expect(result.current.done).toBe(true)
    expect(result.current.playing).toBe(false)
  })

  it('honours speed multiplier', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: true, stepMs: 100 }))
    act(() => { result.current.setSpeed(2) })
    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current.index).toBe(1)
  })

  it('stops playing once it reaches the end', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => { result.current.skip() })
    act(() => { result.current.play() })
    act(() => { vi.advanceTimersByTime(10000) })
    expect(result.current.done).toBe(true)
  })
})
