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

  // RESOLVED 2026-07-07 (USER DECISION): the previously-flagged exception is now closed.
  // `guaranteeOffense=true` (enemy ELITE/BOSS drafts) used to hand a pool-less Supporto
  // the `base_attack` fallback, conflicting with "a Supporto never attacks". Fixed on BOTH
  // sides: (1) guaranteeOffensiveSpell now falls a Supporto back to a Cura (episkey), never
  // base_attack; (2) elite/boss enemy drafts EXCLUDE Supporto from the candidate pool
  // (teamGen.ts budgetWindow's excludeSupporto), so no Supporto is ever fielded where the
  // no-harmless-enemy invariant applies — keeping attackMoveGuarantee.test.ts green without
  // any Supporto ever holding an attack. The boss-leader ban (data/bosses.ts MURO_ALT now
  // uses marcus, an Attaccante, not pettigrew) is the third leg of the same fix.
  it('guaranteeOffensiveSpell keeps a pool-less Supporto non-offensive (Cura, not base_attack)', () => {
    const supportoNoOffense = WIZARDS.filter(w =>
      w.role === 'Supporto' && !w.spellPool.some(id => spellIsOffensive(SPELL_BY_ID[id])))
    expect(supportoNoOffense.length).toBeGreaterThan(0)
    for (const w of supportoNoOffense) {
      const start = SPELL_BY_ID[w.spellPool[0]!]!
      const out = guaranteeOffensiveSpell(w, start)
      expect(spellIsOffensive(out), `${w.id} → ${out.id}`).toBe(false)
      expect(out.id, `${w.id} fell back to base_attack`).not.toBe('base_attack')
    }
  })
})
