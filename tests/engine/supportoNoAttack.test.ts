import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import { draftWizard, spellIsOffensive } from '@/game/engine/statRoll'

describe('a Supporto never enters battle with an attack spell', () => {
  it('every Supporto\'s signature is only Cura or Difesa', () => {
    for (const w of WIZARDS.filter(x => x.role === 'Supporto')) {
      const t = SPELL_BY_ID[w.spellPool[0]!]?.type
      expect(['Cura', 'Difesa'], `${w.id}:${w.spellPool[0]}`).toContain(t)
    }
  })

  it('draftWizard never resolves a Supporto to an offensive spell, for any caller', () => {
    // Task 3 removed the per-unit offense bias entirely (preferOffense/guaranteeOffense):
    // draftWizard now has no way to force a Supporto onto a damaging spell, for player
    // drafts, normal-enemy drafts, or elite/boss drafts alike. Any enemy-team-wide
    // toughness guarantee lives at the team level (teamGen.ts's ensureOffense), never by
    // overriding an individual Supporto's kit.
    const supportos = WIZARDS.filter(x => x.role === 'Supporto')
    for (const w of supportos) {
      for (let s = 0; s < 20; s++) {
        const dw = draftWizard(createRng(`supporto-${w.id}-${s}`), w)
        expect(spellIsOffensive(dw.spell), `${w.id} seed ${s} -> ${dw.spell.id}`).toBe(false)
        const t = SPELL_BY_ID[dw.spell.id]?.type
        expect(['Cura', 'Difesa'], `${w.id} seed ${s} -> ${dw.spell.id}`).toContain(t)
      }
    }
  })
})
