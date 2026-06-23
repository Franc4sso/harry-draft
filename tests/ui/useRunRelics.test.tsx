import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from '@/hooks/useRun'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function team() {
  const r = createRng(1)
  return WIZARDS.slice(0, 5).map(w => draftWizard(r, w))
}

describe('useRun relics', () => {
  it('offers 3 relic choices', () => {
    const { result } = renderHook(() => useRun('seed-r', team()))
    expect(result.current.relicChoices).toHaveLength(3)
  })
  it('after a victory, advancing goes to relic-choice (not straight to battle)', () => {
    const { result } = renderHook(() => useRun('seed-r', team()))
    act(() => result.current.startBattle())   // fight stage 0
    act(() => result.current.revealResult())  // victory or defeat
    if (result.current.view === 'victory') {
      act(() => result.current.advance())
      expect(result.current.view).toBe('relic-choice')
    }
  })
  it('chooseRelic adds the relic and starts the next fight', () => {
    const { result } = renderHook(() => useRun('seed-r', team()))
    act(() => result.current.startBattle())
    act(() => result.current.revealResult())
    if (result.current.view === 'victory') {
      act(() => result.current.advance()) // -> relic-choice
      const chosen = result.current.relicChoices[0]!
      act(() => result.current.chooseRelic(chosen))
      expect(result.current.run.relics.some(a => a.relic.id === chosen.id)).toBe(true)
      expect(result.current.view).toBe('battle')
    }
  })
})
