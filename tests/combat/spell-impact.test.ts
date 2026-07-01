import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { canAct } from '@/game/engine/status'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Harness copied from tests/engine/combat/statusIntegration.test.ts.
function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

const SEEDS = 30

describe('tarantallegra', () => {
  it('applies its spd debuff', () => {
    const caster = unit('c', 'tarantallegra')
    const target = unit('t', 'base_attack', { side: 'right' })
    resolveAction(createRng(1), 1, caster, target, SPELL_BY_ID['tarantallegra']!)
    const slow = target.statusEffects.find(e => e.kind === 'debuff' && e.stat === 'spd')
    expect(slow?.amount).toBe(30)
  })

  it('can stun the target (action-preventing) across seeds — probabilistic', () => {
    let stunnedAtLeastOnce = false
    for (let seed = 1; seed <= SEEDS; seed++) {
      const caster = unit('c', 'tarantallegra')
      const target = unit('t', 'base_attack', { side: 'right' })
      resolveAction(createRng(seed), 1, caster, target, SPELL_BY_ID['tarantallegra']!)
      if (!canAct(target)) {
        stunnedAtLeastOnce = true
        break
      }
    }
    expect(stunnedAtLeastOnce).toBe(true)
  })
})

describe('fianto (Fianto Duri)', () => {
  it('grants the caster an absorbing shield', () => {
    const caster = unit('c', 'fianto')
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['fianto']!)
    const shield = caster.statusEffects.find(e => e.statusId === 'shield')
    expect(shield).toBeDefined()
    expect(shield!.absorbLeft).toBeGreaterThan(0)
  })

  it('the shield actually absorbs a subsequent attack', () => {
    const caster = unit('c', 'fianto')
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['fianto']!)
    const shieldBefore = caster.statusEffects.find(e => e.statusId === 'shield')!.absorbLeft ?? 0
    const attacker = unit('a', 'base_attack', { side: 'right', buffedStats: { hp: 120, atk: 20, def: 0, spd: 40 } })
    const hpBefore = caster.hp
    resolveAction(createRng(2), 2, attacker, caster, SPELL_BY_ID['flipendo']!)
    expect(caster.hp).toBe(hpBefore)
    const shieldAfter = caster.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft ?? 0
    expect(shieldAfter).toBeLessThan(shieldBefore)
  })
})
