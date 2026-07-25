import { describe, it, expect, afterEach } from 'vitest'
import { startRunB, confirmDraftPicks, starterOffer, STARTER_PICKS } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { setDraftPoolRestriction } from '@/game/engine/draft'

afterEach(() => setDraftPoolRestriction(null))

// Build 3 real drafted wizards deterministically via the (kept) starterOffer helper.
function threeStarters(seed: string) {
  setDraftPoolRestriction(null)
  return starterOffer(seed, 'Grifondoro').slice(0, STARTER_PICKS)
}

describe('confirmDraftPicks endless threading', () => {
  // Onda 1.e (2026-07-25, Task 1 review round 1): shop/spellForge no longer exist in
  // ANY mode (see tests/engine/nodeGen.test.ts), so asserting their absence here is now
  // vacuous — it would pass even if endless threading were broken. `altare` is the sole
  // remaining type excluded in endless mode, so it's the meaningful replacement: this
  // still proves confirmDraftPicks threads `endless` into area-0 generation correctly.
  it('endless area 0 excludes altare nodes', () => {
    const seed = 'endless-draft-1'
    const picked = threeStarters(seed)
    const s = confirmDraftPicks({ ...startRunB(seed), endless: true }, picked, createRng(seed))
    const types = new Set(s.map!.map(n => n.type))
    expect(types.has('altare')).toBe(false)
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(STARTER_PICKS)
  })
  it('campaign area 0 is unchanged (endless falsy) — team + map still build, altare still guaranteed', () => {
    const seed = 'campaign-draft-1'
    const picked = threeStarters(seed)
    const s = confirmDraftPicks(startRunB(seed), picked, createRng(seed))
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(STARTER_PICKS)
    expect(s.map!.filter(n => n.type === 'altare')).toHaveLength(1)
  })
})
