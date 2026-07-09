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

  // The seed/house/starterIds/first-move below were discovered by driving the real engine
  // (startRunB -> chooseStarters -> reachable -> moveTo) for seed 'replay-seed' house
  // 'Grifondoro': starterOffer offers ["dumbledore","harry","mcgonagall","..."] and the
  // FIRST reachable node from the start is a0f1n2, a 'relic' node offering exactly
  // ["giratempo","fiala-supporto","pensatoio"] (deterministic per seed+node id).
  const REAL_SEED = 'replay-seed'
  const REAL_HOUSE: RunLog['house'] = 'Grifondoro'
  const REAL_STARTERS = ['dumbledore', 'harry', 'mcgonagall']
  const REAL_FIRST_MOVE = 'a0f1n2' // relic node
  const REAL_RELIC_OFFER_IDS: string[] = ['giratempo', 'fiala-supporto', 'pensatoio']
  const REAL_RELIC_OFFER_ID_0 = REAL_RELIC_OFFER_IDS[0]!

  it('rejects a relic-pick id never present in the REAL offer at a real relic node (the bug the reviewer reproduced)', () => {
    // Sanity: the id below must genuinely not be one of the node's offered relics.
    expect(REAL_RELIC_OFFER_IDS).not.toContain('totally-bogus-relic-id')
    const log = baseLog([
      { t: 'move', nodeId: REAL_FIRST_MOVE },
      { t: 'resolve', choice: { kind: 'relic-pick', relicId: 'totally-bogus-relic-id' } },
    ])
    log.house = REAL_HOUSE
    log.starterIds = REAL_STARTERS
    const out = replayRun(log)
    expect(out.valid).toBe(false)
    expect(out.reason).toMatch(/illegal resolve/i)
  })

  it('accepts a legitimate skip at a real relic node (skip must not be flagged as cheating)', () => {
    const log = baseLog([
      { t: 'move', nodeId: REAL_FIRST_MOVE },
      { t: 'resolve', choice: { kind: 'skip' } },
    ])
    log.house = REAL_HOUSE
    log.starterIds = REAL_STARTERS
    const out = replayRun(log)
    expect(out.valid).toBe(true)
    // Skip must not have granted a relic.
    expect(out.state.relics.length).toBe(0)
  })

  it('accepts a legitimate relic-pick for an id that IS in the real offer', () => {
    const log = baseLog([
      { t: 'move', nodeId: REAL_FIRST_MOVE },
      { t: 'resolve', choice: { kind: 'relic-pick', relicId: REAL_RELIC_OFFER_ID_0 } },
    ])
    log.house = REAL_HOUSE
    log.starterIds = REAL_STARTERS
    const out = replayRun(log)
    expect(out.valid).toBe(true)
    expect(out.state.relics.length).toBe(1)
    expect(out.state.relics[0]?.relic.id).toBe(REAL_RELIC_OFFER_ID_0)
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
