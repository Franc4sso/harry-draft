import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import { draftWizard, guaranteeOffensiveSpell, spellIsOffensive } from '@/game/engine/statRoll'

describe('a Supporto never enters battle with an attack spell', () => {
  it('every Supporto\'s static pool is only Cura or Difesa', () => {
    for (const w of WIZARDS.filter(x => x.role === 'Supporto')) {
      for (const s of w.spellPool ?? []) {
        const t = SPELL_BY_ID[s]?.type
        expect(['Cura', 'Difesa'], `${w.id}:${s}`).toContain(t)
      }
    }
  })

  it('draftWizard never resolves a Supporto to an offensive spell for player drafts and normal-enemy drafts', () => {
    // Covers every path that does NOT opt into `guaranteeOffense` (player draft/recruit/
    // run-engine reroll, and normal (non elite/boss) enemy teams via teamGen's
    // pickTowardBudget with guaranteeOffense=false). preferOffense is exercised too
    // (normal enemies still get the soft offensive bias) since it never overrides a
    // Supporto's pool-restricted role bias — Supporto's own pool has zero offensive
    // spells post Task 2, so `preferOffense`'s filter finds nothing and no-ops.
    const supportos = WIZARDS.filter(x => x.role === 'Supporto')
    for (const w of supportos) {
      for (let s = 0; s < 20; s++) {
        const dw = draftWizard(createRng(`supporto-${w.id}-${s}`), w, false, true, false)
        const t = SPELL_BY_ID[dw.spell.id]?.type
        expect(['Cura', 'Difesa'], `${w.id} seed ${s} -> ${dw.spell.id}`).toContain(t)
      }
    }
  })

  // REVERSED AGAIN 2026-07-07 (USER DECISION, Task 3c, final): the previous "exclude
  // Supporto entirely from enemy elite/boss" fix is now wrong. Final decision: enemy
  // elite/boss teams may field ≤1 Supporto, alongside other roles, and that Supporto
  // MUST be able to attack. So `guaranteeOffensiveSpell` no longer special-cases
  // Supporto at all — a pool-less Supporto forced through the guarantee now gets the
  // universal `base_attack` fallback, same as every other role. This only ever fires on
  // the enemy elite/boss path (`guaranteeOffense=true`, see teamGen.ts's ≤1-Supporto
  // cap) — the test above (`draftWizard never resolves a Supporto to an offensive spell
  // for player drafts...`) still holds for every path that does NOT opt into
  // guaranteeOffense, so "a Supporto never enters PLAYER battle with an attack spell"
  // (this describe block's title) remains true.
  it('guaranteeOffensiveSpell now gives a pool-less Supporto base_attack (enemy elite/boss only; player Supporto never reach this path)', () => {
    const supportoNoOffense = WIZARDS.filter(w =>
      w.role === 'Supporto' && !w.spellPool.some(id => spellIsOffensive(SPELL_BY_ID[id])))
    expect(supportoNoOffense.length).toBeGreaterThan(0)
    for (const w of supportoNoOffense) {
      const start = SPELL_BY_ID[w.spellPool[0]!]!
      const out = guaranteeOffensiveSpell(w, start)
      expect(out.id, `${w.id} → ${out.id}`).toBe('base_attack')
      expect(spellIsOffensive(out), `${w.id} → ${out.id}`).toBe(true)
    }
  })
})
