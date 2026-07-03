import { describe, it, expect } from 'vitest'
import { STARTER_WIZARDS, MILESTONES, UNLOCK_COSTS } from '@/data/unlocks'
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
  it('includes all tier-1 and tier-2 wizards (power-representative pool)', () => {
    const tier12 = WIZARDS.filter(w => w.tier === 1 || w.tier === 2).map(w => w.id)
    for (const id of tier12) expect(STARTER_WIZARDS).toContain(id)
  })
})

describe('reachability: nothing is permanently unreachable', () => {
  it('every non-starter wizard is unlockable via a milestone or purchasable', () => {
    const milestoneWizards = new Set(
      MILESTONES.filter(m => m.unlock.kind === 'wizard').map(m => m.unlock.id),
    )
    for (const w of WIZARDS) {
      const reachable = STARTER_WIZARDS.includes(w.id) || milestoneWizards.has(w.id) || UNLOCK_COSTS.wizard > 0
      expect(reachable).toBe(true) // purchasable fallback (cost>0) guarantees reachability
    }
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
