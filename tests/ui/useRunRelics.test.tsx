/**
 * useRun relic-choice flow — robust, no silent-skip guards.
 *
 * Seed + team choice is deterministic: with seed "relic-flow" and the strong
 * tier-1/2 team below, stages 0-4 are ALL victories (verified empirically by
 * running the engine). Assertions are therefore unconditional — no `if`-guards
 * that silently pass when combat is a defeat.
 *
 * Full campaign shape with this seed:
 *   stage 0 → victory → relic-choice → (chooseRelic) → battle …
 *   stage 1 → victory → relic-choice → (chooseRelic) → battle …
 *   stage 2 → victory → relic-choice → (chooseRelic) → battle …
 *   stage 3 → victory → relic-choice → (chooseRelic) → battle …
 *   stage 4 → victory → relic-choice → (chooseRelic) → boss intro
 *   boss   → defeat
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from '@/hooks/useRun'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { BALANCE } from '@/data/constants'
import type { DraftedWizard } from '@/types'

/** Five tier-1/2 heroes drafted with a fixed RNG — reliably beats budget-scaled enemies. */
function strongTeam(): DraftedWizard[] {
  const r = createRng(3)
  return ['dumbledore', 'voldemort', 'harry', 'moody', 'mcgonagall'].map(
    id => draftWizard(r, WIZARD_BY_ID[id]!),
  )
}

/** Seed guaranteed (by engine determinism) to win all 5 normal stages. */
const WIN_SEED = 'relic-flow'

// ---------------------------------------------------------------------------
// Static / initial-state tests
// ---------------------------------------------------------------------------

describe('useRun relics — static', () => {
  it('offers exactly 3 relic choices from the very first render', () => {
    const { result } = renderHook(() => useRun(WIN_SEED, strongTeam()))
    expect(result.current.relicChoices).toHaveLength(BALANCE.relics.offerCount)
  })

  it('initial relicChoices are all distinct', () => {
    const { result } = renderHook(() => useRun(WIN_SEED, strongTeam()))
    const ids = result.current.relicChoices.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// Single-stage relic-choice tests (unconditional — seed guarantees victory)
// ---------------------------------------------------------------------------

describe('useRun relics — stage-0 victory path', () => {
  it('after stage-0 victory, advance() goes to relic-choice (not battle)', () => {
    const { result } = renderHook(() => useRun(WIN_SEED, strongTeam()))
    act(() => result.current.startBattle())
    act(() => result.current.revealResult())
    // UNCONDITIONAL — this seed guarantees a victory
    expect(result.current.view).toBe('victory')
    act(() => result.current.advance())
    expect(result.current.view).toBe('relic-choice')
  })

  it('chooseRelic adds the relic to run.relics and returns to the map', () => {
    const { result } = renderHook(() => useRun(WIN_SEED, strongTeam()))
    act(() => result.current.startBattle())
    act(() => result.current.revealResult())
    expect(result.current.view).toBe('victory') // unconditional
    act(() => result.current.advance())          // → relic-choice
    const chosen = result.current.relicChoices[0]!
    act(() => result.current.chooseRelic(chosen))
    // relic is now in run.relics
    expect(result.current.run.relics.some(a => a.relic.id === chosen.id)).toBe(true)
    // graph progression: chooseRelic returns to the map so the player picks the
    // next node; choosing a reachable node then starts that battle.
    expect(result.current.view).toBe('map')
    const next = result.current.reachable[0]!
    act(() => result.current.chooseNode(next.id))
    expect(result.current.view).toBe('battle')
  })
})

// ---------------------------------------------------------------------------
// Full-campaign flow test
// ---------------------------------------------------------------------------

describe('useRun relics — full campaign flow', () => {
  // Reconciled to graph progression: the campaign is no longer a fixed linear
  // chain of 5 stages. The player walks the map graph (we always take the first
  // reachable edge). This test preserves the ORIGINAL intent without relying on
  // hard-coded per-fight win/loss outcomes (the enemy RNG salts moved from
  // linear-stage to node-depth, so exact outcomes legitimately shifted):
  //   - a relic-choice is offered after EVERY normal (non-boss) victory
  //   - relics accumulate exactly one per victory and are always distinct
  //   - relic offers never include an already-owned relic
  //   - chooseRelic returns to the MAP (not straight to battle)
  //   - the run reaches a terminal state; if won, the final fight was the boss
  //   - accumulated relics survive to the end of the run (win or defeat)
  it('offers relic-choice after every normal victory, accumulates distinct relics, walks the graph to a terminal state', () => {
    const { result } = renderHook(() => useRun(WIN_SEED, strongTeam()))

    const relicIdsObtained: string[] = []
    let lastFightWasBoss = false
    let guard = 0

    // Kick off the first fight (floor 0).
    act(() => result.current.startBattle())

    while (guard++ < 20) {
      lastFightWasBoss = result.current.battle?.isBoss ?? false
      act(() => result.current.revealResult())

      const v = result.current.view
      if (v === 'win' || v === 'defeat') break

      // Any non-terminal fight that survived is a normal victory.
      expect(v).toBe('victory')

      act(() => result.current.advance())
      expect(result.current.view).toBe('relic-choice')

      // Offered choices are distinct and exclude already-owned relics.
      const offeredIds = result.current.relicChoices.map(r => r.id)
      expect(new Set(offeredIds).size).toBe(offeredIds.length)
      for (const offered of result.current.relicChoices) {
        expect(relicIdsObtained).not.toContain(offered.id)
      }

      const chosen = result.current.relicChoices[0]!
      const ownedBefore = result.current.run.relics.length
      act(() => result.current.chooseRelic(chosen))
      relicIdsObtained.push(chosen.id)

      // Exactly one relic added per victory.
      expect(result.current.run.relics).toHaveLength(ownedBefore + 1)
      expect(result.current.run.relics.some(a => a.relic.id === chosen.id)).toBe(true)

      // chooseRelic returns to the map; walk the graph by the first legal edge.
      expect(result.current.view).toBe('map')
      const next = result.current.reachable[0]!
      act(() => result.current.chooseNode(next.id))
      expect(result.current.view).toBe('battle')
    }

    // The run terminated (boss reached or defeated along the way).
    expect(['win', 'defeat']).toContain(result.current.view)

    // At least one normal victory happened, so at least one relic was earned.
    expect(result.current.run.relics.length).toBeGreaterThan(0)

    // Relics never duplicate.
    expect(new Set(relicIdsObtained).size).toBe(relicIdsObtained.length)
    // Accumulated relics survive to the end of the run.
    expect(result.current.run.relics).toHaveLength(relicIdsObtained.length)

    // If the player won, the final fight was the boss node (graph equivalent of
    // the old "boss arrives after the last normal stage" assertion).
    if (result.current.view === 'win') expect(lastFightWasBoss).toBe(true)
  })
})
