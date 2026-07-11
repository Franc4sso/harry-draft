import { describe, it, expect, vi, afterEach } from 'vitest'
import { encodeChallenge, decodeChallenge } from '@/lib/challengeCode'
import { ENGINE_VERSION, type RunLog } from '@/game/engine/endlessReplay'

const sample: RunLog = {
  v: 1, engine: ENGINE_VERSION, seed: 's1',
  draftPicks: ['harry', 'ron'],
  actions: [
    { t: 'move', nodeId: 'a0f1n0' },
    { t: 'resolve', choice: { kind: 'combat-ack' } },
    { t: 'use-consumable', relicId: 'lacrime-fenice' },
  ],
}

describe('challenge code', () => {
  it('round-trips a RunLog through encode/decode', () => {
    expect(decodeChallenge(encodeChallenge(sample))).toEqual(sample)
  })
  it('round-trip preserves draftPicks', () => {
    const decoded = decodeChallenge(encodeChallenge(sample))
    expect(decoded.draftPicks).toEqual(['harry', 'ron'])
  })
  it('throws on malformed input', () => {
    expect(() => decodeChallenge('not-valid-base64url!!')).toThrow()
  })
  it('throws on unknown version', () => {
    const bad = encodeChallenge({ ...sample, v: 999 as unknown as 1 })
    expect(() => decodeChallenge(bad)).toThrow()
  })
})

// Vitest's jsdom environment runs on Node, which provides a real Buffer — so the tests
// above never exercise the browser-safe fallback path. Next.js does NOT polyfill Buffer
// for client-side bundles, and getChallengeCode() (hooks/useEndless.ts) is called from
// the client, so the fallback must be independently proven correct: stub Buffer as
// undefined to force toBase64url/fromBase64url down the TextEncoder/btoa/atob/TextDecoder
// branch, matching what an actual browser without Buffer would do.
describe('challenge code — browser fallback (no Buffer)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips a RunLog without relying on Buffer', () => {
    vi.stubGlobal('Buffer', undefined)
    expect(decodeChallenge(encodeChallenge(sample))).toEqual(sample)
  })

  it('round-trips non-ASCII text without Buffer', () => {
    vi.stubGlobal('Buffer', undefined)
    const withUnicode: RunLog = { ...sample, seed: 'sémé-🧙-ünïcödé' }
    expect(decodeChallenge(encodeChallenge(withUnicode))).toEqual(withUnicode)
  })
})
