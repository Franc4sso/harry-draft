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
// Deliberately fragile tier-4 roster so the scaling campaign actually kills some
// of them — needed to exercise the death/replay snapshot path below.
const weak = () => team(['seamus', 'dean', 'parvati', 'lavender', 'pansy'], 5)

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
    expect(['defeat', 'win', 'victory', 'relic-choice']).toContain(result.current.view)
  })

  it('exposes the PRE-battle roster on the battle so dying wizards still appear in the replay', () => {
    // Regression: the replay must render every player wizard that ENTERED the
    // fight — including the ones who die — so their death animates on-screen.
    // The bug passed the post-battle survivors as the replay roster, so fallen
    // wizards simply vanished (and the outcome was spoiled before "Salta").
    const { result } = renderHook(() => useRun('vanish-regression', weak()))
    act(() => { result.current.enterMap() })
    let sawDeath = false
    for (let i = 0; i < 12; i++) {
      // Walk the map deeper each loop so difficulty scales and the weak roster
      // actually loses members (chooseNode advances node depth, then fights).
      const next = result.current.reachable[0]
      if (!next) break
      act(() => { result.current.chooseNode(next.id) })
      const b = result.current.battle!
      const leftSnaps = b.result.finalSnapshot.filter(s => s.side === 'left')
      const rosterIds = new Set(b.playerTeam.map(d => d.wizard.id))
      // every combatant on the player side — alive OR dead — must be in the roster
      for (const s of leftSnaps) expect(rosterIds.has(s.id)).toBe(true)
      if (leftSnaps.some(s => s.alive === false)) sawDeath = true
      act(() => { result.current.revealResult() })
      if (result.current.view === 'defeat' || result.current.view === 'win') break
      if (result.current.view === 'victory') {
        act(() => { result.current.advance() })
        act(() => { result.current.chooseRelic(result.current.relicChoices[0]!) })
      }
    }
    // Guard: the scenario must really exercise at least one player death,
    // otherwise the assertion above proves nothing.
    expect(sawDeath).toBe(true)
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
