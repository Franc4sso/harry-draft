import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'

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

  // KNOWN, DELIBERATE EXCEPTION — not covered by this suite:
  // `guaranteeOffense=true` (enemy ELITE/BOSS drafts only, wired from teamGen.ts) can
  // still hand a Supporto with an empty offensive pool (e.g. pettigrew) the universal
  // `base_attack` fallback via `guaranteeOffensiveSpell` in game/engine/statRoll.ts.
  // That is intentional, pre-existing, and itself guarded by
  // tests/engine/combat/attackMoveGuarantee.test.ts (commit 96bfd66, "guarantee enemy
  // wizards have an attack spell in elite/boss battles") — pettigrew/MURO_ALT is that
  // suite's canonical regression case for "a boss that can never deal damage is a free
  // win". Clamping guaranteeOffensiveSpell to keep Supporto non-offensive would silently
  // break that shipped anti-degenerate-boss guarantee. The two invariants conflict only
  // for enemy elite/boss Supporto units with zero offensive spells; player-side Supporto
  // wizards are never subject to guaranteeOffense (see draftWizard call sites), so the
  // "Supporto never attacks" guarantee holds everywhere the player experiences it.
  // Flagged in task-3-report.md for a scoping decision rather than force-resolved here.
})
