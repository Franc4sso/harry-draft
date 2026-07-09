import { describe, it, expect } from 'vitest'
import { encodeChallenge, decodeChallenge } from '@/lib/challengeCode'
import { ENGINE_VERSION, type RunLog } from '@/game/engine/endlessReplay'

const sample: RunLog = {
  v: 1, engine: ENGINE_VERSION, seed: 's1', house: 'Grifondoro',
  starterIds: ['harry', 'ron'],
  actions: [
    { t: 'move', nodeId: 'a0f1n0' },
    { t: 'resolve', choice: { kind: 'combat-ack' } },
    { t: 'set-spell', wizardId: 'harry', spellId: 'expelliarmus' },
  ],
}

describe('challenge code', () => {
  it('round-trips a RunLog through encode/decode', () => {
    expect(decodeChallenge(encodeChallenge(sample))).toEqual(sample)
  })
  it('throws on malformed input', () => {
    expect(() => decodeChallenge('not-valid-base64url!!')).toThrow()
  })
  it('throws on unknown version', () => {
    const bad = encodeChallenge({ ...sample, v: 999 as unknown as 1 })
    expect(() => decodeChallenge(bad)).toThrow()
  })
})
