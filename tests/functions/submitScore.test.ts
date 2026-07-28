import { describe, it, expect, vi } from 'vitest'

const written: string[] = []
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async () => JSON.stringify([]),
    set: async (_k: string, v: string) => { written.push(v) },
  }),
}))

import { processSubmission } from '@/netlify/functions/submit-score'
import { encodeChallenge } from '@/lib/challengeCode'
import { ENGINE_VERSION, type RunLog } from '@/game/engine/endlessReplay'

describe('submit-score processing', () => {
  it('rejects a challenge with an illegal starter (invalid replay)', async () => {
    const log: RunLog = { v: 1, engine: ENGINE_VERSION, seed: 's', draftPicks: ['nope'], actions: [] }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'X' })
    expect(res.status).toBe(400)
  })

  it('rejects an engine-version mismatch', async () => {
    const log: RunLog = { v: 1, engine: 'ancient-0', seed: 's', draftPicks: [], actions: [] }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'X' })
    expect(res.status).toBe(409)
  })

  // The whole point of the anti-cheat gate: a challenge code containing an INJECTED
  // illegal action (a relic-pick id never actually offered at that node) must be
  // rejected outright — never accepted with a score computed from the tampered state.
  it('rejects a tampered challenge with an injected illegal relic-pick, never inflating a score', async () => {
    // Same seed/draftPicks/first-move as tests/engine/endlessReplay.test.ts's
    // REAL_SEED/REAL_STARTERS/REAL_FIRST_MOVE fixture: legalDraftPicks('replay-seed')
    // (index-0 pick at each of the 3 DraftSession screens) is ["cedric","arthur","george"],
    // and a0f1n0 is a real reachable relic node from the start of that run.
    const log: RunLog = {
      v: 1,
      engine: ENGINE_VERSION,
      seed: 'replay-seed',
      draftPicks: ['cedric', 'arthur', 'george'],
      actions: [
        { t: 'move', nodeId: 'a0f1n0' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'totally-bogus-relic-id' } },
      ],
    }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'Cheater' })
    expect(res.status).toBe(400)
    // Nothing must have been written to the leaderboard for a rejected submission.
    expect(written.length).toBe(0)
  })

  // A legitimately recorded run (driven by the real engine via
  // startDraft('replay-fixture-1')/pickFrom -> confirmDraftPicks(..., { endless:true }) ->
  // reachable/moveTo/resolveCurrent, known score 1875) must be ACCEPTED, and the score in
  // the response/write must be the SERVER-computed one (1875) — a client-claimed score
  // field doesn't even exist in the request shape, so there is nothing for a forged number
  // to override.
  // RE-RECORDED 2026-07-22 (Task 3, reliquie-flat): same fixture/relic-id shift as
  // tests/engine/endlessReplay.test.ts's "a recorded valid run replays..." test — pensatoio
  // joining JOKER_RELIC_IDS moved these three nodes' real offers. Re-measured against the
  // real engine (see that test's comment for the full offer dump); score re-confirmed 1875.
  // RE-RECORDED 2026-07-28 (Onda 1.f): cutting 5 relics from the pool re-dealt the two
  // non-joker relic nodes. Same offer dump as that test's comment; score still 1875.
  it('accepts a legitimate recorded run and returns the SERVER-computed score, not any client number', async () => {
    written.length = 0
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
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'sigillo-carnefice' } },
        { t: 'move', nodeId: 'a1f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a2f1n1' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a2f2n0' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'medaglione-serpeverde' } },
        { t: 'move', nodeId: 'a2f3n1' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'fame-vorace' } },
        { t: 'move', nodeId: 'a2f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
      ],
    }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'Legit' })
    expect(res.status).toBe(200)
    const body = res.body as { rank: number; score: number; floor: number }
    expect(body.score).toBe(1875)
    expect(body.rank).toBe(1)
    expect(written.length).toBe(1)
    const persisted = JSON.parse(written[0]!)
    expect(persisted[0]).toMatchObject({ nickname: 'Legit', score: 1875 })
  })
})
