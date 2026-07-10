import { describe, it, expect, afterEach } from 'vitest'
import { replayRun, type RunLog, ENGINE_VERSION } from '@/game/engine/endlessReplay'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import { scoreForEndlessRun } from '@/game/engine/endless'
import { registerCoreResolvers } from '@/game/engine/runEngine'

registerCoreResolvers()

afterEach(() => setDraftPoolRestriction(null))

// Legal draft picks for a seed: drive the same DraftSession replayRun will, pick index 0 each screen.
function legalDraftPicks(seed: string): string[] {
  setDraftPoolRestriction(null)
  let s = startDraft(seed, STARTER_PICKS)
  const ids: string[] = []
  for (let i = 0; i < STARTER_PICKS; i++) { ids.push(s.current[0]!.wizard.id); s = pickFrom(s, 0) }
  return ids
}
const baseLog = (seed: string, over: Partial<RunLog> = {}): RunLog =>
  ({ v: 1, engine: ENGINE_VERSION, seed, draftPicks: legalDraftPicks(seed), actions: [], ...over })

describe('replayRun draft', () => {
  it('reconstructs the starting team from draftPicks (valid)', () => {
    const seed = 'replay-a'
    const out = replayRun(baseLog(seed))
    expect(out.valid).toBe(true)
    expect(out.state.team.map(d => d.wizard.id)).toEqual(legalDraftPicks(seed))
    expect(out.state.phase).toBe('map')
  })
  it('rejects a draft pick not on its screen', () => {
    const out = replayRun(baseLog('replay-a', { draftPicks: ['harry', 'harry', 'harry'] }))
    // 'harry' cannot legally be picked 3× (removed after first screen); at least one pick is off-screen
    expect(out.valid).toBe(false)
    expect(out.reason).toBe('illegal draft pick')
  })
  it('rejects an incomplete draft', () => {
    const seed = 'replay-a'
    const out = replayRun(baseLog(seed, { draftPicks: legalDraftPicks(seed).slice(0, 2) }))
    expect(out.valid).toBe(false)
    expect(out.reason).toBe('incomplete draft')
  })
  it('rejects an engine-version mismatch', () => {
    const out = replayRun(baseLog('replay-a', { engine: 'endless-1' }))
    expect(out.valid).toBe(false)
  })
})

describe('replayRun', () => {
  it('rejects an action that is a no-op / illegal in its state', () => {
    // A recruit-pick sent to a relic node's resolver no-ops (wrong choice kind for the
    // node) — the resolver's own guard, not an anti-cheat special case — and must
    // invalidate the replay.
    const log = baseLog('replay-seed', {
      actions: [
        { t: 'move', nodeId: 'a0f1n0' },
        { t: 'resolve', choice: { kind: 'recruit-pick', wizardId: 'harry' } },
      ],
    })
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  // The seed/draftPicks/first-move below were discovered by driving the real engine
  // (startDraft -> pickFrom -> confirmDraftPicks -> reachable -> moveTo) for seed
  // 'replay-seed': legalDraftPicks('replay-seed') is ["cedric","arthur","george"], and one
  // of the reachable nodes from the start is a0f1n0, a 'relic' node offering exactly
  // ["fortezza-vivente","marcia-di-guerra","patto-vorace"] (deterministic per seed+node id,
  // independent of which wizards were drafted — relicOffer keys off state.relics, not team).
  const REAL_SEED = 'replay-seed'
  const REAL_STARTERS = legalDraftPicks(REAL_SEED)
  const REAL_FIRST_MOVE = 'a0f1n0' // relic node
  const REAL_RELIC_OFFER_IDS: string[] = ['fortezza-vivente', 'marcia-di-guerra', 'patto-vorace']
  const REAL_RELIC_OFFER_ID_0 = REAL_RELIC_OFFER_IDS[0]!

  it('rejects a relic-pick id never present in the REAL offer at a real relic node (the bug the reviewer reproduced)', () => {
    // Sanity: the id below must genuinely not be one of the node's offered relics.
    expect(REAL_RELIC_OFFER_IDS).not.toContain('totally-bogus-relic-id')
    const log = baseLog(REAL_SEED, {
      draftPicks: REAL_STARTERS,
      actions: [
        { t: 'move', nodeId: REAL_FIRST_MOVE },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'totally-bogus-relic-id' } },
      ],
    })
    const out = replayRun(log)
    expect(out.valid).toBe(false)
    expect(out.reason).toMatch(/illegal resolve/i)
  })

  it('accepts a legitimate skip at a real relic node (skip must not be flagged as cheating)', () => {
    const log = baseLog(REAL_SEED, {
      draftPicks: REAL_STARTERS,
      actions: [
        { t: 'move', nodeId: REAL_FIRST_MOVE },
        { t: 'resolve', choice: { kind: 'skip' } },
      ],
    })
    const out = replayRun(log)
    expect(out.valid).toBe(true)
    // Skip must not have granted a relic.
    expect(out.state.relics.length).toBe(0)
  })

  it('accepts a legitimate relic-pick for an id that IS in the real offer', () => {
    const log = baseLog(REAL_SEED, {
      draftPicks: REAL_STARTERS,
      actions: [
        { t: 'move', nodeId: REAL_FIRST_MOVE },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: REAL_RELIC_OFFER_ID_0 } },
      ],
    })
    const out = replayRun(log)
    expect(out.valid).toBe(true)
    expect(out.state.relics.length).toBe(1)
    expect(out.state.relics[0]?.relic.id).toBe(REAL_RELIC_OFFER_ID_0)
  })

  it('a recorded valid run replays to valid:true and a scorable state', () => {
    // RECORDED (2026-07-10, Task 2 — draftPicks replay rework): driven by the real engine
    // via startDraft('replay-fixture-1')/pickFrom (index = strongest by powerOf() at each
    // screen, mirroring the near-optimal greedy bot policy used elsewhere in this suite,
    // e.g. tests/engine/endlessScaling.test.ts's pickNode) -> confirmDraftPicks(..., {
    // endless:true }) -> reachable/moveTo/resolveCurrent, dumping the exact move/resolve
    // action sequence up to and including the area-2 boss fight, and reading the final
    // score off the state via scoreForEndlessRun. Superseded the old house/starterIds-based
    // fixture recorded under the pre-Task-2 chooseStarters draft path.
    const log: RunLog = {
      v: 1,
      engine: ENGINE_VERSION,
      seed: 'replay-fixture-1',
      draftPicks: ['cedric', 'crabbe', 'hagrid'],
      actions: [
        { t: 'move', nodeId: 'a0f1n0' },
        { t: 'resolve', choice: { kind: 'recruit-pick', wizardId: 'neville' } },
        { t: 'move', nodeId: 'a0f2n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a0f3n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a0f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a1f1n1' },
        { t: 'resolve', choice: { kind: 'recruit-pick', wizardId: 'susan' } },
        { t: 'move', nodeId: 'a1f2n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a1f3n1' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'ampolla-veleno' } },
        { t: 'move', nodeId: 'a1f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a2f1n1' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a2f2n0' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'medaglione-serpeverde' } },
        { t: 'move', nodeId: 'a2f3n1' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'collezionista-anime' } },
        { t: 'move', nodeId: 'a2f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
      ],
    }
    const out = replayRun(log)
    expect(out.valid).toBe(true)
    expect(scoreForEndlessRun(out.state)).toBe(1610)
  })

  it('rejects a log whose engine version does not match', () => {
    const log = baseLog('replay-seed', { engine: 'stale-engine-version' })
    const out = replayRun(log)
    expect(out.valid).toBe(false)
    expect(out.reason).toMatch(/engine/i)
  })

  it('rejects a log with a malformed/unknown action tag rather than throwing or skipping it', () => {
    // Cast an unknown action tag through, simulating a hand-crafted/tampered challenge
    // code that slipped past decodeChallenge (which only validates v/seed/actions).
    const log = baseLog('replay-seed', {
      actions: [{ t: 'bogus' } as unknown as RunLog['actions'][number]],
    })
    expect(() => replayRun(log)).not.toThrow()
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  it('rejects a log whose draftPicks is not a string array', () => {
    const log = baseLog('replay-seed')
    // @ts-expect-error deliberately malformed draftPicks
    log.draftPicks = 'not-an-array'
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })
})
