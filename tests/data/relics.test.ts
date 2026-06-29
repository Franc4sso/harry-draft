import { describe, it, expect } from 'vitest'
import { RELICS, RELIC_BY_ID } from '@/data/relics'

describe('relics data', () => {
  it('has at least 16 relics with unique ids', () => {
    expect(RELICS.length).toBeGreaterThanOrEqual(16)
    expect(new Set(RELICS.map(r => r.id)).size).toBe(RELICS.length)
  })
  it('covers all four rarities', () => {
    expect(new Set(RELICS.map(r => r.rarity))).toEqual(
      new Set(['comune', 'non-comune', 'rara', 'epica']),
    )
  })
  it('every relic has a non-empty name and desc', () => {
    for (const r of RELICS) {
      expect(r.name.length).toBeGreaterThan(0)
      expect(r.desc.length).toBeGreaterThan(0)
    }
  })
  it('every relic has either a bonus, a trigger, a keywordMult, grantsExecute, or grantsShieldConvert', () => {
    for (const r of RELICS) {
      const hasBonus = !!r.bonus
      const hasTrigger = !!(r.triggers?.length)
      const hasKeywordMult = !!(r.keywordMult && Object.keys(r.keywordMult).length > 0)
      const hasGrantsExecute = !!r.grantsExecute
      const hasGrantsShieldConvert = !!r.grantsShieldConvert
      expect(hasBonus || hasTrigger || hasKeywordMult || hasGrantsExecute || hasGrantsShieldConvert, `relic ${r.id} has nothing`).toBe(true)
    }
  })
  it('limits trigger relics to at most 3 (v1)', () => {
    const triggers = RELICS.filter(r => r.triggers?.length)
    expect(triggers.length).toBeLessThanOrEqual(3)
  })
  it('conditional relics reference real houses/roles', () => {
    const houses = ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']
    const roles = ['Attaccante', 'Tank', 'Supporto', 'Controllo']
    for (const r of RELICS) {
      if (r.condition?.house) expect(houses).toContain(r.condition.house)
      if (r.condition?.role) expect(roles).toContain(r.condition.role)
    }
  })
  it('exposes a lookup map', () => {
    expect(RELIC_BY_ID[RELICS[0]!.id]).toBe(RELICS[0])
  })
})

describe('relic trigger migration', () => {
  it('pietra-resurrezione uses onBattleStart shield trigger', () => {
    const t = RELIC_BY_ID['pietra-resurrezione']!.triggers
    expect(t).toEqual([{ hook: 'onBattleStart', effects: [{ kind: 'shield', amount: 30 }] }])
  })
  it('boccino-doro uses onHit veleno trigger', () => {
    const t = RELIC_BY_ID['boccino-doro']!.triggers
    expect(t).toEqual([{ hook: 'onHit', effects: [
      { kind: 'applyStatus', target: 'enemy', chance: 0.25, statusId: 'veleno' },
    ] }])
  })
})
