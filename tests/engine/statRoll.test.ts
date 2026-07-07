import { describe, it, expect } from 'vitest'
import { fixedStats, draftWizard, guaranteeOffensiveSpell, spellIsOffensive } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID, WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

describe('fixedStats', () => {
  it('returns the rounded midpoint of each range', () => {
    const harry = WIZARD_BY_ID['harry']!
    // ranges: hp [86,107] atk [31,40] def [12,19] spd [26,35]
    expect(fixedStats(harry)).toEqual({ hp: 97, atk: 36, def: 16, spd: 31 })
  })

  it('is deterministic and independent of RNG', () => {
    const w = WIZARD_BY_ID['harry']!
    expect(fixedStats(w)).toEqual(fixedStats(w))
  })

  it('draftWizard uses fixed stats but still varies the spell by RNG', () => {
    const w = WIZARD_BY_ID['harry']!
    const a = draftWizard(createRng(1), w)
    const b = draftWizard(createRng(2), w)
    expect(a.stats).toEqual(b.stats)          // stats fixed
    expect(a.maxHp).toBe(a.stats.hp)
  })
})

describe('guaranteeOffensiveSpell — Supporto never gets an attack', () => {
  // A Supporto is a healer/warder: this slice bans it from ever holding a direct attack
  // (so no Supporto can be a boss-leader). When a Supporto with a pure-support pool is
  // forced through the strict offensive guarantee, it must fall back to a Cura/Difesa
  // spell — NEVER an Attacco/Controllo (and NEVER base_attack).
  const supportoWithNoOffense = (WIZARDS as typeof WIZARDS)
    .filter(w => w.role === 'Supporto' &&
      !w.spellPool.some(id => spellIsOffensive(SPELL_BY_ID[id])))

  it('there is at least one pure-support Supporto to exercise the clamp (e.g. pettigrew)', () => {
    expect(supportoWithNoOffense.length).toBeGreaterThan(0)
    expect(supportoWithNoOffense.some(w => w.id === 'pettigrew')).toBe(true)
  })

  it('every pure-support Supporto, forced offensive, keeps a Cura/Difesa spell (never Attacco/Controllo, never base_attack)', () => {
    for (const w of supportoWithNoOffense) {
      // Feed a non-offensive starting spell so the guarantee's fallback branch runs.
      const start = SPELL_BY_ID[w.spellPool[0]!]!
      const result = guaranteeOffensiveSpell(w, start)
      expect(spellIsOffensive(result), `${w.id} → ${result.id} is offensive`).toBe(false)
      expect(['Cura', 'Difesa']).toContain(result.type)
      expect(result.id, `${w.id} fell back to base_attack`).not.toBe('base_attack')
    }
  })

  it('routes a Supporto through the full draftWizard(guaranteeOffense=true) path to a non-offensive spell', () => {
    const pettigrew = WIZARD_BY_ID['pettigrew']!
    for (let s = 0; s < 25; s++) {
      const dw = draftWizard(createRng(`supporto-clamp-${s}`), pettigrew, false, true, true)
      expect(spellIsOffensive(dw.spell), `seed ${s} → ${dw.spell.id}`).toBe(false)
      expect(['Cura', 'Difesa']).toContain(dw.spell.type)
    }
  })

  it('a non-Supporto with no offensive pool still gets base_attack (behavior unchanged)', () => {
    // Synthetic Attaccante whose pool is all non-offensive → must fall back to base_attack.
    const dummy = {
      ...WIZARD_BY_ID['pettigrew']!,
      id: 'dummy_attaccante',
      role: 'Attaccante' as const,
    }
    const result = guaranteeOffensiveSpell(dummy, SPELL_BY_ID[dummy.spellPool[0]!]!)
    expect(result.id).toBe('base_attack')
  })
})
