import { describe, it, expect } from 'vitest'
import { STARTER_WIZARDS, MILESTONES, WIZARD_COST_BY_TIER, RELIC_COST_BY_RARITY } from '@/data/unlocks'
import { WIZARDS } from '@/data/wizards'

const byId = new Map(WIZARDS.map(w => [w.id, w]))

describe('starter wizard set invariants', () => {
  it('is 18-22 ids and every id exists', () => {
    expect(STARTER_WIZARDS.length).toBeGreaterThanOrEqual(18)
    expect(STARTER_WIZARDS.length).toBeLessThanOrEqual(22)
    for (const id of STARTER_WIZARDS) expect(byId.has(id)).toBe(true)
  })
  it('covers all houses and roles', () => {
    const houses = new Set(STARTER_WIZARDS.map(id => byId.get(id)!.house))
    const roles = new Set(STARTER_WIZARDS.map(id => byId.get(id)!.role))
    expect(houses).toEqual(new Set(['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']))
    expect(roles.size).toBe(4)
  })
  it('has >=3 Grifondoro, the trio, and >=3 veleno', () => {
    const grif = STARTER_WIZARDS.filter(id => byId.get(id)!.house === 'Grifondoro')
    expect(grif.length).toBeGreaterThanOrEqual(3)
    for (const id of ['harry', 'ron', 'hermione']) expect(STARTER_WIZARDS).toContain(id)
    const veleno = STARTER_WIZARDS.filter(id => (byId.get(id)!.tags ?? []).includes('veleno'))
    expect(veleno.length).toBeGreaterThanOrEqual(3)
  })
  it('mirrors the natural rarity curve instead of flooding with high-rarity picks', () => {
    const tierOf = (id: string) => byId.get(id)!.tier
    const tier1 = STARTER_WIZARDS.filter(id => tierOf(id) === 1)
    const tier4 = STARTER_WIZARDS.filter(id => tierOf(id) === 4)
    const highRarity = STARTER_WIZARDS.filter(id => tierOf(id) === 1 || tierOf(id) === 2)
    // Not all 3 legendaries forced in — the draft should still surface tier-1s rarely.
    expect(tier1.length).toBeLessThanOrEqual(2)
    // The old set had ZERO commons; guard against regressing back to that.
    expect(tier4.length).toBeGreaterThanOrEqual(5)
    // High-rarity (tier1+tier2) share was 65% before this fix; keep it well under half.
    expect(highRarity.length / STARTER_WIZARDS.length).toBeLessThanOrEqual(0.4)
  })
})

describe('reachability: nothing is permanently unreachable', () => {
  it('every non-starter wizard is unlockable via a milestone or purchasable', () => {
    const milestoneWizards = new Set(
      MILESTONES.filter(m => m.unlock.kind === 'wizard').map(m => m.unlock.id),
    )
    for (const w of WIZARDS) {
      const reachable = STARTER_WIZARDS.includes(w.id) || milestoneWizards.has(w.id) || WIZARD_COST_BY_TIER[w.tier] > 0
      expect(reachable).toBe(true) // purchasable fallback (cost>0) guarantees reachability
    }
  })
  it('every wizard tier and relic rarity has a positive unlock cost', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      expect(WIZARD_COST_BY_TIER[tier]).toBeGreaterThan(0)
    }
    for (const rarity of ['comune', 'non-comune', 'rara', 'epica'] as const) {
      expect(RELIC_COST_BY_RARITY[rarity]).toBeGreaterThan(0)
    }
  })
  it('cost strictly increases with rarity', () => {
    expect(WIZARD_COST_BY_TIER[4]).toBeLessThan(WIZARD_COST_BY_TIER[3])
    expect(WIZARD_COST_BY_TIER[3]).toBeLessThan(WIZARD_COST_BY_TIER[2])
    expect(WIZARD_COST_BY_TIER[2]).toBeLessThan(WIZARD_COST_BY_TIER[1])
    expect(RELIC_COST_BY_RARITY['comune']).toBeLessThan(RELIC_COST_BY_RARITY['non-comune'])
    expect(RELIC_COST_BY_RARITY['non-comune']).toBeLessThan(RELIC_COST_BY_RARITY['rara'])
    expect(RELIC_COST_BY_RARITY['rara']).toBeLessThan(RELIC_COST_BY_RARITY['epica'])
  })
  it('every milestone unlock id is a real, non-starter id', () => {
    for (const m of MILESTONES) {
      if (m.unlock.kind === 'wizard') {
        expect(byId.has(m.unlock.id)).toBe(true)
        expect(STARTER_WIZARDS).not.toContain(m.unlock.id)
      }
    }
  })
})
