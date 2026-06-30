import { describe, it, expect } from 'vitest'
import { SYNERGIES } from '@/data/synergies'

describe('house synergies use the new model', () => {
  it('slytherin no longer grants flat atk (the imbalance root is gone)', () => {
    for (const id of ['slytherin2', 'slytherin3', 'slytherin4']) {
      const s = SYNERGIES.find(x => x.id === id)!
      expect(s.bonus.atk ?? 0).toBe(0)   // mechanic moved to houseEffects (cunning)
    }
  })
  it('hufflepuff keeps regen (loyalty support stays)', () => {
    expect((SYNERGIES.find(x => x.id === 'hufflepuff4')!.bonus.regen ?? 0)).toBeGreaterThan(0)
  })
  it('all four houses still have 3 tiers with the house requirement', () => {
    for (const fam of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']) {
      const tiers = SYNERGIES.filter(s => s.kind === 'house' && s.requires.house === fam)
      expect(tiers.length).toBe(3)
    }
  })
})
