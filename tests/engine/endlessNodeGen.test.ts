import { describe, it, expect } from 'vitest'
import { chooseStarters, starterOffer, startRunB } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'

// Onda 1.e (2026-07-25, Task 1 review round 1): this file originally guarded shop/
// spellForge exclusion from endless area 0. Those two types are gone from the game now
// (they're never generated in ANY mode — see tests/engine/nodeGen.test.ts), so that
// specific manifestation is moot. But the file's real value was never "shop/spellForge
// specifically" — it was the ONLY regression guard for chooseStarters correctly threading
// `endless: true` into the area-0 generateArea call. `altare` is now the sole remaining
// type excluded in endless mode (see game/engine/nodeGen.ts) and depends on that exact
// same flag-threading mechanism, so the guard is revived here for `altare` instead of
// retired. tests/engine/altareNode.test.ts covers the endless exclusion via generateArea
// directly; it does NOT cover the real call chain (chooseStarters → generateArea), which
// is what actually broke in the original 136/300 soft-lock bug — that's this file's job.
describe('endless map generation — altare exclusion via the real flag-threading chain', () => {
  // Regression for the area-0 shop soft-lock (fixed before Onda 1.e): chooseStarters
  // (unlike advanceEndlessArea) used to call generateArea WITHOUT threading the endless
  // flag, so area 0 of an endless run could roll a node the endless controller has no
  // handler for, render null, and leave the player stuck with no score and no way out.
  // Measured 136/300 area-0 endless maps hit this before the fix. Drive the SAME entry
  // point live endless play and endlessReplay.ts both use: startRunB with endless:true
  // set BEFORE chooseStarters (chooseStarters reads state.endless to decide whether to
  // exclude altare from area 0, same as every later area already does).
  it('endless area 0 (via chooseStarters) never generates an altare node, across many seeds', () => {
    for (let i = 0; i < 300; i++) {
      const seed = `endless-area0-softlock-${i}`
      const offer = starterOffer(seed, 'Grifondoro')
      const starterIds = offer.slice(0, 3).map(d => d.wizard.id)
      const s = chooseStarters({ ...startRunB(seed), endless: true }, 'Grifondoro', starterIds, createRng(seed))
      for (const n of s.map ?? []) {
        expect(n.type).not.toBe('altare')
      }
    }
  })

  // Campaign's own area-0 entry (chooseStarters called WITHOUT state.endless set) must be
  // completely unaffected: this is the exact same call campaignBalanceB's harness exercises
  // via confirmDraftPicks/chooseStarters, and campaign area 0 has always guaranteed exactly
  // one altare (Fase 3, 2026-07-22 — see tests/engine/altareNode.test.ts). This is a guard
  // against a future edit accidentally flipping the default and silently excluding altare
  // from campaign area 0 too (which must stay byte-identical per this branch's constraints).
  it('campaign area 0 (chooseStarters without endless) is unaffected and still guarantees exactly one altare', () => {
    for (let i = 0; i < 50; i++) {
      const seed = `campaign-area0-unaffected-${i}`
      const offer = starterOffer(seed, 'Grifondoro')
      const starterIds = offer.slice(0, 3).map(d => d.wizard.id)
      const s = chooseStarters(startRunB(seed), 'Grifondoro', starterIds, createRng(seed))
      expect((s.map ?? []).filter(n => n.type === 'altare')).toHaveLength(1)
    }
  })
})
