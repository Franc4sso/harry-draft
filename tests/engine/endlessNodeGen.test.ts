import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { areaRng, chooseStarters, starterOffer, startRunB } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'

describe('endless map generation', () => {
  it('never generates shop or spellForge nodes across many endless areas', () => {
    for (let area = 1; area <= 20; area++) {
      const map = generateArea(areaRng('endless-mapgen', area), 'endless-mapgen', area,
        { teamSize: 3, teamMax: 5 }, true) // endless=true
      for (const n of map) {
        expect(n.type).not.toBe('shop')
        expect(n.type).not.toBe('spellForge')
      }
    }
  })

  // Regression for the area-0 shop soft-lock: chooseStarters (unlike advanceEndlessArea)
  // used to call generateArea WITHOUT threading the endless flag, so area 0 of an endless
  // run could roll a shop/spellForge node — nodes the endless controller (RunBRunner's
  // 'shop' case) has no handler for, renders null, and the player is stuck with no score
  // and no way out. Measured 136/300 area-0 endless maps hit this before the fix. Drive
  // the SAME entry point live endless play and endlessReplay.ts both use: startRunB with
  // endless:true set BEFORE chooseStarters (chooseStarters reads state.endless to decide
  // whether to exclude shop/spellForge from area 0, same as every later area already does).
  it('endless area 0 (via chooseStarters) never generates shop or spellForge nodes, across many seeds', () => {
    for (let i = 0; i < 300; i++) {
      const seed = `endless-area0-softlock-${i}`
      const offer = starterOffer(seed, 'Grifondoro')
      const starterIds = offer.slice(0, 3).map(d => d.wizard.id)
      const s = chooseStarters({ ...startRunB(seed), endless: true }, 'Grifondoro', starterIds, createRng(seed))
      for (const n of s.map ?? []) {
        expect(n.type).not.toBe('shop')
        expect(n.type).not.toBe('spellForge')
      }
    }
  })

  // Campaign's own area-0 entry (chooseStarters called WITHOUT state.endless set) must be
  // completely unaffected: this is the exact same call campaignBalanceB's harness exercises
  // via confirmDraftPicks/chooseStarters, and campaign area 0 has always been allowed to
  // roll shop/spellForge nodes (campaign HAS handlers for them). This is a guard against a
  // future edit accidentally flipping the default and silently changing campaign area-0
  // generation (which must stay byte-identical per this branch's constraints).
  it('campaign area 0 (chooseStarters without endless) is unaffected and may still generate shop/spellForge', () => {
    let sawShopOrForge = false
    for (let i = 0; i < 50; i++) {
      const seed = `campaign-area0-unaffected-${i}`
      const offer = starterOffer(seed, 'Grifondoro')
      const starterIds = offer.slice(0, 3).map(d => d.wizard.id)
      const s = chooseStarters(startRunB(seed), 'Grifondoro', starterIds, createRng(seed))
      if ((s.map ?? []).some(n => n.type === 'shop' || n.type === 'spellForge')) sawShopOrForge = true
    }
    expect(sawShopOrForge).toBe(true)
  })
})
