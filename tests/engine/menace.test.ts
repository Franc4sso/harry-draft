import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'

function enemy() {
  return [draftWizard(createRng('m'), WIZARD_BY_ID['voldemort']!)]
}

describe('menace buff', () => {
  it('multiplies enemy stats by (1 + menacePct)', () => {
    const plain = toBattleUnits(enemy(), 'right', [])
    const menaced = toBattleUnits(enemy(), 'right', [], [], 0.5)
    expect(menaced[0]!.buffedStats.atk).toBe(Math.round(plain[0]!.buffedStats.atk * 1.5))
    expect(menaced[0]!.maxHp).toBe(Math.round(plain[0]!.buffedStats.hp * 1.5))
  })

  it('menacePct 0 is identical to no menace', () => {
    const a = toBattleUnits(enemy(), 'right', [])
    const b = toBattleUnits(enemy(), 'right', [], [], 0)
    expect(b[0]!.buffedStats).toEqual(a[0]!.buffedStats)
  })
})
