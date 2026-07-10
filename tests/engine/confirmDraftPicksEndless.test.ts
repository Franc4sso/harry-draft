import { describe, it, expect } from 'vitest'
import { startRunB, confirmDraftPicks, starterOffer, STARTER_PICKS } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { setDraftPoolRestriction } from '@/game/engine/draft'

// Build 3 real drafted wizards deterministically via the (kept) starterOffer helper.
function threeStarters(seed: string) {
  setDraftPoolRestriction(null)
  return starterOffer(seed, 'Grifondoro').slice(0, STARTER_PICKS)
}

describe('confirmDraftPicks endless threading', () => {
  it('endless area 0 excludes shop and spellForge nodes', () => {
    const seed = 'endless-draft-1'
    const picked = threeStarters(seed)
    const s = confirmDraftPicks({ ...startRunB(seed), endless: true }, picked, createRng(seed))
    const types = new Set(s.map!.map(n => n.type))
    expect(types.has('shop')).toBe(false)
    expect(types.has('spellForge')).toBe(false)
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(STARTER_PICKS)
  })
  it('campaign area 0 is unchanged (endless falsy) — team + map still build', () => {
    const seed = 'campaign-draft-1'
    const picked = threeStarters(seed)
    const s = confirmDraftPicks(startRunB(seed), picked, createRng(seed))
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(STARTER_PICKS)
  })
})
