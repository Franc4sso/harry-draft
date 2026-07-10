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
    const log: RunLog = { v: 1, engine: ENGINE_VERSION, seed: 's', house: 'Grifondoro', starterIds: ['nope'], actions: [] }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'X' })
    expect(res.status).toBe(400)
  })

  it('rejects an engine-version mismatch', async () => {
    const log: RunLog = { v: 1, engine: 'ancient-0', seed: 's', house: 'Grifondoro', starterIds: [], actions: [] }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'X' })
    expect(res.status).toBe(409)
  })

  // The whole point of the anti-cheat gate: a challenge code containing an INJECTED
  // illegal action (a relic-pick id never actually offered at that node) must be
  // rejected outright — never accepted with a score computed from the tampered state.
  it('rejects a tampered challenge with an injected illegal relic-pick, never inflating a score', async () => {
    const log: RunLog = {
      v: 1,
      engine: ENGINE_VERSION,
      seed: 'replay-seed',
      house: 'Grifondoro',
      starterIds: ['dumbledore', 'harry', 'mcgonagall'],
      actions: [
        { t: 'move', nodeId: 'a0f1n2' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'totally-bogus-relic-id' } },
      ],
    }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'Cheater' })
    expect(res.status).toBe(400)
    // Nothing must have been written to the leaderboard for a rejected submission.
    expect(written.length).toBe(0)
  })

  // A legitimately recorded run (same fixture as tests/engine/endlessReplay.test.ts's
  // "a recorded valid run replays to valid:true and a scorable state", known score 1610)
  // must be ACCEPTED, and the score in the response/write must be the SERVER-computed
  // one (1610) — a client-claimed score field doesn't even exist in the request shape,
  // so there is nothing for a forged number to override.
  it('accepts a legitimate recorded run and returns the SERVER-computed score, not any client number', async () => {
    written.length = 0
    const log: RunLog = {
      v: 1,
      engine: ENGINE_VERSION,
      seed: 'endless-ui-seed',
      house: 'Grifondoro',
      starterIds: ['dumbledore', 'harry', 'mcgonagall'],
      actions: [
        { t: 'move', nodeId: 'a0f1n1' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'mappa-malandrino' } },
        { t: 'move', nodeId: 'a0f2n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a0f3n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a0f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a1f1n2' },
        { t: 'resolve', choice: { kind: 'recruit-pick', wizardId: 'astoria' } },
        { t: 'move', nodeId: 'a1f2n2' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a1f3n1' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a1f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a2f1n1' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a2f2n0' },
        { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'marcia-di-guerra' } },
        { t: 'move', nodeId: 'a2f3n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
        { t: 'move', nodeId: 'a2f4n0' },
        { t: 'resolve', choice: { kind: 'combat-ack' } },
      ],
    }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'Legit' })
    expect(res.status).toBe(200)
    const body = res.body as { rank: number; score: number; floor: number }
    expect(body.score).toBe(1610)
    expect(body.rank).toBe(1)
    expect(written.length).toBe(1)
    const persisted = JSON.parse(written[0]!)
    expect(persisted[0]).toMatchObject({ nickname: 'Legit', score: 1610 })
  })
})
