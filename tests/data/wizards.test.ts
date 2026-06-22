import { describe, it, expect } from 'vitest'
import { WIZARDS, WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

describe('wizards data', () => {
  it('has at least 40 wizards with unique ids', () => {
    expect(WIZARDS.length).toBeGreaterThanOrEqual(40)
    expect(new Set(WIZARDS.map(w => w.id)).size).toBe(WIZARDS.length)
  })
  it('every wizard has a spell pool of 4-6 valid spells', () => {
    for (const w of WIZARDS) {
      expect(w.spellPool.length).toBeGreaterThanOrEqual(4)
      expect(w.spellPool.length).toBeLessThanOrEqual(6)
      for (const id of w.spellPool) expect(SPELL_BY_ID[id], `${w.id} -> ${id}`).toBeTruthy()
    }
  })
  it('ranges are ordered [min<=max] and positive', () => {
    for (const w of WIZARDS) {
      for (const k of ['hp', 'atk', 'def', 'spd'] as const) {
        const [lo, hi] = w.ranges[k]
        expect(lo).toBeGreaterThan(0)
        expect(hi).toBeGreaterThanOrEqual(lo)
      }
    }
  })
  it('covers all houses, roles, tiers', () => {
    expect(new Set(WIZARDS.map(w => w.house)).size).toBe(4)
    expect(new Set(WIZARDS.map(w => w.role)).size).toBe(4)
    expect(new Set(WIZARDS.map(w => w.tier)).size).toBe(4)
  })
  it('has wizards tagged for each group synergy', () => {
    const tags = new Set(WIZARDS.flatMap(w => w.tags ?? []))
    for (const t of ['weasley', 'order', 'deatheater', 'marauder', 'da', 'trio']) {
      expect(tags.has(t), `missing tag ${t}`).toBe(true)
    }
  })
  it('exposes lookup map', () => { expect(WIZARD_BY_ID['harry']).toBeTruthy() })
})
