import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

describe('BattleResult.alliesLost', () => {
  it('counts left-side deaths (lopsided: 1 weak left vs 3 heavy attackers)', () => {
    const fragileBase = WIZARDS.find(w => w.role === 'Supporto')!
    const heavyBase = WIZARDS.find(w => w.id === 'voldemort')!
    const left = [draftWizard(createRng(1), fragileBase)]
    const right = [
      draftWizard(createRng(2), heavyBase),
      draftWizard(createRng(3), heavyBase),
      draftWizard(createRng(4), heavyBase),
    ]
    const result = simulateBattle(left, right, createRng(5))
    expect(result.alliesLost).toBeGreaterThanOrEqual(1)
  })

  it('is 0 when no left unit dies (3 heavy attackers vs 1 trivial right unit)', () => {
    const heavyBase = WIZARDS.find(w => w.id === 'voldemort')!
    const fragileBase = WIZARDS.find(w => w.role === 'Supporto')!
    const left = [
      draftWizard(createRng(2), heavyBase),
      draftWizard(createRng(3), heavyBase),
      draftWizard(createRng(4), heavyBase),
    ]
    const right = [draftWizard(createRng(1), fragileBase)]
    const result = simulateBattle(left, right, createRng(5))
    expect(result.alliesLost).toBe(0)
  })
})
