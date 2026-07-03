import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { clearRun, saveRun } from '@/lib/runStore'
import { loadProfile } from '@/lib/metaStore'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import type { RunState } from '@/types'

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

  // The generated area's graph only links adjacent floors, so reaching the boss/relic
  // node (always present — see nodeGen.ts guarantees) can require several intermediate
  // floors. Rather than driving a full playthrough, splice a direct edge from the
  // current node to the target node: this exercises chooseNode's real boss/relic-codex
  // branch against the target node's REAL pre-generated battle/preview/offer data,
  // without depending on the random floor-by-floor path a seed happens to produce.
  function withDirectEdgeTo(run: RunState, targetId: string): RunState {
    return {
      ...run,
      map: run.map!.map(n => (n.id === run.currentNodeId ? { ...n, next: [...n.next, targetId] } : n)),
    }
  }

  it('entering a boss battle marks the boss as seen in the codex', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    const bossNode = first.result.current.run.map!.find(n => n.type === 'boss')!
    expect(bossNode.preview?.bossName).toBeTruthy()
    expect(loadProfile().codex.bossesSeen).not.toContain(bossNode.preview!.bossName)

    saveRun(withDirectEdgeTo(first.result.current.run, bossNode.id))
    const second = renderHook(() => useRunB('seed-c'))
    act(() => second.result.current.chooseNode(bossNode.id))

    expect(second.result.current.view).toBe('battle')
    expect(loadProfile().codex.bossesSeen).toContain(bossNode.preview!.bossName)
  })

  it('entering a relic node marks every offered relic as seen in the codex', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    const relicNode = first.result.current.run.map!.find(n => n.type === 'relic')!
    const offer = relicOffer(first.result.current.run, relicNode, createRng(first.result.current.run.seed))
    expect(offer.length).toBeGreaterThan(0)
    expect(loadProfile().codex.relicsSeen).toHaveLength(0)

    saveRun(withDirectEdgeTo(first.result.current.run, relicNode.id))
    const second = renderHook(() => useRunB('seed-c'))
    act(() => second.result.current.chooseNode(relicNode.id))

    expect(second.result.current.view).toBe('relic')
    const seen = loadProfile().codex.relicsSeen
    for (const r of offer) expect(seen).toContain(r.id)
  })

  it('restart clears the save and returns to the draft', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.completeDraft(twoPicks('seed-c')))
    act(() => result.current.restart())
    expect(result.current.view).toBe('draft')
    expect(result.current.run.team).toHaveLength(0)
  })

  // Reaching the true 'win' phase through a full campaign would require playing out
  // every area's combat; instead splice the run onto the final area (clearAreaAndAdvance
  // is pure and only reads state.area/seed) so advanceArea() drives the REAL engine
  // transition into 'win' through the controller's public API.
  it('reaching win records currency + unlocks exactly once, even if re-triggered', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    const runsBefore = loadProfile().stats.runsPlayed

    saveRun({ ...first.result.current.run, area: 2 }) // last area index (BALANCE.map.areas - 1)
    const second = renderHook(() => useRunB('seed-c'))
    act(() => second.result.current.advanceArea())

    expect(second.result.current.view).toBe('win')
    expect(loadProfile().stats.runsPlayed).toBe(runsBefore + 1)
    expect(second.result.current.runReward).not.toBeNull()
    expect(second.result.current.runReward!.earned).toBeGreaterThan(0)

    // Re-triggering the terminal transition (e.g. an extra re-render/commit) must NOT
    // double-count: the rewardFiredRef guard blocks a second recordRunEnd call.
    act(() => second.result.current.advanceArea())
    expect(second.result.current.view).toBe('win')
    expect(loadProfile().stats.runsPlayed).toBe(runsBefore + 1)
  })
})
