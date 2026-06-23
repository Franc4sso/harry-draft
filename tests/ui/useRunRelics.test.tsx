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

  it('chooseRelic adds the relic to run.relics and transitions to battle', () => {
    const { result } = renderHook(() => useRun(WIN_SEED, strongTeam()))
    act(() => result.current.startBattle())
    act(() => result.current.revealResult())
    expect(result.current.view).toBe('victory') // unconditional
    act(() => result.current.advance())          // → relic-choice
    const chosen = result.current.relicChoices[0]!
    act(() => result.current.chooseRelic(chosen))
    // relic is now in run.relics
    expect(result.current.run.relics.some(a => a.relic.id === chosen.id)).toBe(true)
    // view transitions to battle (chooseRelic internally calls startBattle)
    expect(result.current.view).toBe('battle')
  })
})

// ---------------------------------------------------------------------------
// Full-campaign flow test
// ---------------------------------------------------------------------------

describe('useRun relics — full campaign flow', () => {
  it('visits relic-choice after EVERY normal victory (5 total); accumulates 5 relics; boss intro after 5th relic chosen', () => {
    const { result } = renderHook(() => useRun(WIN_SEED, strongTeam()))
    const enemyCount = BALANCE.campaign.enemyCount // 5

    const relicIdsObtained: string[] = []

    // -----------------------------------------------------------------------
    // Drive all 5 normal stages.
    // After stage 0 we call startBattle manually; subsequent stages are
    // started internally by chooseRelic (which calls startBattle for stages
    // 0-3, or goes to boss intro for stage 4). So the pattern per stage i is:
    //   [stage 0 only: startBattle()]
    //   revealResult()
    //   advance()       → always relic-choice
    //   chooseRelic()   → 'battle' for stages 0-3, 'boss' for stage 4
    // -----------------------------------------------------------------------
    act(() => result.current.startBattle()) // kick off stage 0

    for (let i = 0; i < enemyCount; i++) {
      act(() => result.current.revealResult())

      // UNCONDITIONAL: all 5 normal stages are victories with this seed
      expect(result.current.view).toBe('victory')

      act(() => result.current.advance())

      // ALL stages 0-4: advance always goes to relic-choice
      expect(result.current.view).toBe('relic-choice')

      // Offered choices are distinct from each other
      const offeredIds = result.current.relicChoices.map(r => r.id)
      expect(new Set(offeredIds).size).toBe(offeredIds.length)

      // Offered choices don't include already-owned relics
      for (const offered of result.current.relicChoices) {
        expect(relicIdsObtained).not.toContain(offered.id)
      }

      // Pick the first offered relic
      const chosen = result.current.relicChoices[0]!
      act(() => result.current.chooseRelic(chosen))
      relicIdsObtained.push(chosen.id)

      // Relics accumulate: after stage i we own i+1 relics
      expect(result.current.run.relics).toHaveLength(i + 1)

      if (i < enemyCount - 1) {
        // Stages 0-3: chooseRelic starts the next normal battle
        expect(result.current.view).toBe('battle')
      } else {
        // Stage 4: chooseRelic goes to boss intro (not battle yet)
        expect(result.current.view).toBe('boss')
        // 5 relics accumulated — one per normal stage
        expect(result.current.run.relics).toHaveLength(enemyCount)
      }
    }

    // -----------------------------------------------------------------------
    // Boss fight: player loses (this seed deterministically ends in defeat)
    // -----------------------------------------------------------------------
    expect(result.current.view).toBe('boss')
    act(() => result.current.startBattle())
    act(() => result.current.revealResult())
    expect(result.current.view).toBe('defeat')

    // All 5 accumulated relics are still in run.relics after defeat
    expect(result.current.run.relics).toHaveLength(enemyCount)

    // All acquired relic IDs are distinct (no duplicates ever offered/chosen)
    expect(new Set(relicIdsObtained).size).toBe(relicIdsObtained.length)
  })
})
