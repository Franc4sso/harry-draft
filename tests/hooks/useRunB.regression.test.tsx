import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { clearRun } from '@/lib/runStore'
import { setDraftPoolRestriction } from '@/game/engine/draft'

/** Two deterministic starter picks from the draft session for a given seed
 *  (mirrors tests/hooks/useRunB.test.ts's twoPicks helper). */
function twoPicks(seed: string) {
  let s = startDraft(seed)
  s = pickFrom(s, 0)
  s = pickFrom(s, 0)
  return s.picks
}

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })
afterEach(() => setDraftPoolRestriction(null))

// Characterization: drive a fixed campaign run through a scripted sequence and snapshot
// the view transitions. This must produce IDENTICAL output before and after extraction.
describe('useRunB campaign behavior (regression guard for extraction)', () => {
  it('produces a stable view sequence for a fixed seed + scripted choices', () => {
    const { result } = renderHook(() => useRunB('regression-seed-1'))
    const views: string[] = [result.current.view]

    // Draft starters via the controller's public API, using the same deterministic
    // starter-pick helper the rest of the suite relies on.
    act(() => { result.current.completeDraft(twoPicks('regression-seed-1')) })
    views.push(result.current.view)

    // Walk reachable nodes, recording the view after each transition. Battles are
    // committed immediately so the walk can keep progressing across node types.
    for (let i = 0; i < 3; i++) {
      const node = result.current.reachable[0]
      if (!node) break
      act(() => { result.current.chooseNode(node.id) })
      views.push(result.current.view)
      if (result.current.view === 'battle') {
        act(() => { result.current.commitBattle() })
        views.push(result.current.view)
      }
    }

    // Snapshot the exact sequence. Regenerate ONLY if you intend to change campaign behavior.
    expect(views).toMatchSnapshot()
  })
})
