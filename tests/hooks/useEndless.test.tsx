import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEndless } from '@/hooks/useEndless'
import { decodeChallenge } from '@/lib/challengeCode'
import { replayRun } from '@/game/engine/endlessReplay'
import { scoreForEndlessRun } from '@/game/engine/endless'
import { clearRun } from '@/lib/runStore'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import type { DraftedWizard } from '@/types'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

/** Greedily drafts STARTER_PICKS wizards (always index 0) from a fresh, seeded
 *  DraftSession — mirrors endlessReplay's own reconstruction loop so the picks
 *  driveToWipeout records are guaranteed legal against a real live draft. */
function draftStarters(seed: string): DraftedWizard[] {
  let session = startDraft(seed, STARTER_PICKS)
  while (session.picks.length < STARTER_PICKS) {
    session = pickFrom(session, 0)
  }
  return session.picks
}

/** Greedily drives an endless run to wipeout, using only the controller's own
 *  offered starters + reachable nodes. Combat auto-acks (deterministic — no
 *  choice). Recruit/relic nodes are skipped (a legal, non-cheating action per
 *  replayRun's exemption for {kind:'skip'}) to keep the walk simple and
 *  reviewable. Event nodes take the first offered choice. Infirmary auto-acks.
 *  Shop/spellForge nodes are avoided when an alternative reachable node exists
 *  (Task 5, not yet landed, is what excludes them from endless map gen; a real
 *  player CAN still encounter them today) — if genuinely unavoidable the test
 *  fails loudly rather than silently mis-recording, so a stuck seed is visible. */
function driveToWipeout(result: { current: ReturnType<typeof useEndless> }): string[] {
  const picked = draftStarters(result.current.run.seed)
  act(() => result.current.completeDraft(picked))
  expect(result.current.run.phase).toBe('map')

  let guard = 0
  const MAX_STEPS = 2000
  while (result.current.score === null) {
    guard++
    if (guard > MAX_STEPS) throw new Error(`driveToWipeout exceeded ${MAX_STEPS} steps without a wipeout`)

    const view = result.current.view
    if (view === 'map' || view === 'victory') {
      // 'victory' (a non-boss combat win) is a UI-only pause: reachable()/moveTo()
      // don't gate on phase, so the walk can move on exactly like from 'map' — no
      // resolver call, no PlayerAction needed (matches what replayRun expects: it
      // never special-cases 'victory', relying entirely on the next 'move' action).
      const options = result.current.reachable
      if (options.length === 0) throw new Error('no reachable nodes from a map/victory view')
      const nonShop = options.filter(n => n.type !== 'shop' && n.type !== 'spellForge')
      const target = (nonShop.length > 0 ? nonShop : options)[0]!
      act(() => result.current.chooseNode(target.id))
    } else if (view === 'battle') {
      act(() => result.current.commitBattle())
    } else if (view === 'recruit') {
      act(() => result.current.skipRecruit())
    } else if (view === 'relic') {
      const node = result.current.currentNode
      if (!node) throw new Error('relic view with no currentNode')
      const offer = relicOffer(result.current.run, node, createRng(result.current.run.seed))
      if (offer.length === 0) throw new Error('relic view with an empty offer')
      act(() => result.current.chooseRelic(offer[0]!.id))
    } else if (view === 'infirmary') {
      act(() => result.current.ackInfirmary())
    } else if (view === 'event') {
      const ev = result.current.currentEvent
      if (!ev) throw new Error('event view with no currentEvent')
      const choice = ev.choices[0]!
      act(() => result.current.chooseEventOption(choice.id))
    } else if (view === 'spellForge') {
      const wizardId = result.current.run.team[0]?.wizard.id
      if (!wizardId) throw new Error('spellForge view with empty team')
      act(() => result.current.chooseSpellUpgrade(wizardId))
    } else if (view === 'area-cleared' || view === 'win') {
      act(() => result.current.advanceArea())
    } else if (view === 'shop') {
      // Should be unreachable given the nonShop routing above, but guard defensively
      // rather than spin forever if a seed truly has no alternative.
      throw new Error('walk entered a shop node despite avoidance routing')
    } else {
      throw new Error(`unhandled view in driveToWipeout: ${view}`)
    }
  }
  return picked.map(d => d.wizard.id)
}

describe('useEndless record + replay parity', () => {
  it('a played run recorded to a challenge code replays to the SAME score', () => {
    const { result } = renderHook(() => useEndless('endless-ui-seed'))
    const draftPicks = driveToWipeout(result)

    const code = result.current.getChallengeCode()
    const played = result.current.score!
    expect(played).not.toBeNull()

    const decoded = decodeChallenge(code)
    expect(decoded.draftPicks).toEqual(draftPicks)

    const { state, valid } = replayRun(decoded)
    expect(valid).toBe(true)
    expect(scoreForEndlessRun(state)).toBe(played)
  })
})
