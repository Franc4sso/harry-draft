import { describe, it, expect } from 'vitest'
import { replayRun, type RunLog, ENGINE_VERSION } from '@/game/engine/endlessReplay'
import { registerCoreResolvers } from '@/game/engine/runEngine'

registerCoreResolvers()

// A valid RunLog is best produced by RECORDING a real run (see Task 4). For this unit
// test, drive a minimal known-good sequence and a known-bad one.
function baseLog(actions: RunLog['actions']): RunLog {
  return { v: 1, engine: ENGINE_VERSION, seed: 'replay-seed', house: 'Grifondoro', starterIds: [], actions }
}

describe('replayRun', () => {
  it('rejects a log whose starterIds are not in the offered starters (illegal draft)', () => {
    const log = baseLog([])
    log.starterIds = ['definitely-not-a-real-wizard-id']
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  it('rejects an action that is a no-op / illegal in its state', () => {
    // A relic-pick for a relic never offered at that node must invalidate the replay.
    const log = baseLog([{ t: 'resolve', choice: { kind: 'relic-pick', relicId: 'no-such-relic' } }])
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  it('a recorded valid run replays to valid:true and a scorable state', () => {
    // This case is filled in once Task 4 can RECORD a real log; wire that recorded log here.
    // Until then, assert the shape contract only.
    const out = replayRun(baseLog([]))
    expect(out).toHaveProperty('valid')
    expect(out).toHaveProperty('state')
  })

  it('rejects a log whose engine version does not match', () => {
    const log = baseLog([])
    log.engine = 'stale-engine-version'
    const out = replayRun(log)
    expect(out.valid).toBe(false)
    expect(out.reason).toMatch(/engine/i)
  })

  it('rejects a log with a malformed/unknown action tag rather than throwing or skipping it', () => {
    const log = baseLog([])
    // Cast an unknown action tag through, simulating a hand-crafted/tampered challenge
    // code that slipped past decodeChallenge (which only validates v/seed/actions).
    log.actions = [{ t: 'bogus' } as unknown as RunLog['actions'][number]]
    expect(() => replayRun(log)).not.toThrow()
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  it('rejects a log whose house is missing or not a valid House', () => {
    const log = baseLog([])
    // @ts-expect-error deliberately invalid house to simulate a tampered/malformed log
    log.house = 'NotAHouse'
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  it('rejects a log whose starterIds is not a string array', () => {
    const log = baseLog([])
    // @ts-expect-error deliberately malformed starterIds
    log.starterIds = 'not-an-array'
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })
})
