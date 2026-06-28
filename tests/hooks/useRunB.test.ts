import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { clearRun } from '@/lib/runStore'

/** Two deterministic starter picks from the draft session for a given seed. */
function twoPicks(seed: string) {
  let s = startDraft(seed)
  s = pickFrom(s, 0)
  s = pickFrom(s, 0)
  return s.picks
}

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('useRunB FSM', () => {
  it('starts in the draft phase with an empty team', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    expect(result.current.view).toBe('draft')
    expect(result.current.run.team).toHaveLength(0)
  })

  it('completeDraft builds a 2-wizard team and enters the map', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.completeDraft(twoPicks('seed-c')))
    expect(result.current.view).toBe('map')
    expect(result.current.run.team).toHaveLength(2)
    expect(result.current.reachable.length).toBeGreaterThan(0)
  })

  it('resuming reads a saved run instead of restarting', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    // a fresh hook on the same key resumes mid-run
    const second = renderHook(() => useRunB('seed-c'))
    expect(second.result.current.view).toBe('map')
    expect(second.result.current.run.team).toHaveLength(2)
  })

  it('resuming during a combat phase rebuilds the battle snapshot (no null crash)', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    const fight = first.result.current.reachable.find(n => n.type === 'battle' || n.type === 'elite')
    expect(fight).toBeTruthy()
    act(() => first.result.current.chooseNode(fight!.id))
    expect(first.result.current.view).toBe('battle')

    // Simulate a page reload / HMR remount: a brand-new hook reads the saved run,
    // which is persisted in the 'battle' phase. The battle snapshot is ephemeral
    // (not persisted) so it must be rebuilt, or the battle/victory view null-crashes.
    const reloaded = renderHook(() => useRunB('seed-c'))
    expect(reloaded.result.current.view).toBe('battle')
    expect(reloaded.result.current.battle).not.toBeNull()
    expect(reloaded.result.current.battle!.enemy.length).toBeGreaterThan(0)

    // And again after committing into the victory phase.
    act(() => first.result.current.commitBattle())
    if (first.result.current.view === 'victory') {
      const reloaded2 = renderHook(() => useRunB('seed-c'))
      expect(reloaded2.result.current.view).toBe('victory')
      expect(reloaded2.result.current.battle).not.toBeNull()
    }
  })

  it('restart clears the save and returns to the draft', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.completeDraft(twoPicks('seed-c')))
    act(() => result.current.restart())
    expect(result.current.view).toBe('draft')
    expect(result.current.run.team).toHaveLength(0)
  })
})
