import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { clearRun, saveRun } from '@/lib/runStore'
import { loadProfile } from '@/lib/metaStore'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { createDraftPool, setDraftPoolRestriction } from '@/game/engine/draft'
import { STARTER_WIZARDS } from '@/data/unlocks'
import type { RunState } from '@/types'

/** Two deterministic starter picks from the draft session for a given seed. */
function twoPicks(seed: string) {
  let s = startDraft(seed)
  s = pickFrom(s, 0)
  s = pickFrom(s, 0)
  return s.picks
}

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })
afterEach(() => setDraftPoolRestriction(null))

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

  // Regression: "Nuova run" must roll a FRESH seed, not replay the mount-time seed.
  // The seed prop is computed once (URL ?seed= or a one-off randomSeed()) and frozen,
  // so a restart that reused it made every new run identical — same draft, same map,
  // same fights — and the ResultScreen/DraftScreen "seed:" readout never changed.
  it('restart rolls a new seed (a fresh run is not a replay of the last one)', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    expect(result.current.run.seed).toBe('seed-c')
    act(() => result.current.completeDraft(twoPicks('seed-c')))
    act(() => result.current.restart())
    // The new run must NOT reuse the initial seed (randomSeed() is 8 chars over a
    // 36-glyph alphabet → collision with 'seed-c' is impossible, and even a random
    // collision would be ~36^-8).
    expect(result.current.run.seed).not.toBe('seed-c')
  })

  // Regression: a wizard unlocked by the reward ceremony at the end of a run must be
  // usable in the very next same-session run. Before the fix, the draft/relic pool
  // restriction was only computed once (mount-time useMemo) and restart() never
  // recomputed it, so a freshly-unlocked wizard stayed invisible to createDraftPool()
  // until a full page reload remounted the hook.
  it('restart refreshes the draft pool restriction with unlocks earned by the run that just ended', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))

    // Splice onto the final area (clearAreaAndAdvance is pure, reads state.area/seed
    // only) so advanceArea() drives the real engine transition into 'win', which
    // triggers recordRunEnd and unlocks 'dolohov'/'neville' etc. via the first-win
    // milestone (data/unlocks.ts) — a wizard NOT in STARTER_WIZARDS.
    saveRun({ ...first.result.current.run, area: 2 }) // last area index (BALANCE.map.areas - 1)
    const second = renderHook(() => useRunB('seed-c'))
    act(() => second.result.current.advanceArea())
    expect(second.result.current.view).toBe('win')

    const unlockedWizardIds = second.result.current.runReward!.unlocked
      .filter(u => u.kind === 'wizard')
      .map(u => u.id)
    expect(unlockedWizardIds.length).toBeGreaterThan(0)
    expect(unlockedWizardIds.some(id => !STARTER_WIZARDS.includes(id))).toBe(true)

    act(() => second.result.current.restart())

    const pool = createDraftPool()
    for (const id of unlockedWizardIds) {
      if (!STARTER_WIZARDS.includes(id)) expect(pool.some(w => w.id === id)).toBe(true)
    }
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
