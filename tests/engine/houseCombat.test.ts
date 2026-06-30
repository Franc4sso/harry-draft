import { describe, it, expect } from 'vitest'
import { dodged, computeDamage } from '@/game/engine/combat/effects'
import { resolveAction } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit, Spell } from '@/types'

function unit(id: string, hp: number, opts: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, spell: SPELL_BY_ID['base_attack']!, stats: { hp, atk: 40, def: 10, spd: 10 },
    maxHp: hp, side: 'left', buffedStats: { hp, atk: 40, def: 10, spd: 10 }, hp,
    cooldowns: {}, statusEffects: [], alive: true, ...opts } as unknown as BattleUnit
}
const atkSpell: Spell = { id: 'a', name: 'A', desc: '', type: 'Attacco', power: 2, hitChance: 1 }

describe('house combat mechanics', () => {
  it('Grifondoro dodgeBonus raises dodge frequency', () => {
    // Over many seeds, a target with dodgeBonus dodges more often than one without.
    let withBonus = 0, without = 0
    for (let i = 0; i < 300; i++) {
      const rng1 = createRng('d' + i), rng2 = createRng('d' + i)
      const attacker = unit('harry', 200, { side: 'left' })
      const tgtA = unit('hermione', 200, { side: 'right', dodgeBonus: 0.5 })
      const tgtB = unit('hermione', 200, { side: 'right' })
      if (dodged(rng1, attacker, tgtA)) withBonus++
      if (dodged(rng2, attacker, tgtB)) without++
    }
    expect(withBonus).toBeGreaterThan(without)
  })
  it('Corvonero critBonus raises crit damage (more first-hit damage over seeds)', () => {
    // A caster with critBonus deals >= damage on average; assert at least one seed crits bigger.
    const target = () => unit('harry', 1000, { side: 'right' })
    let bonusMax = 0, plainMax = 0
    for (let i = 0; i < 200; i++) {
      const flagsA: any[] = [], flagsB: any[] = []
      const caster = unit('luna', 200, { side: 'left', critBonus: { chance: 1, mult: 1 } }) // always crit, +1 mult
      const plain = unit('luna', 200, { side: 'left' })
      bonusMax = Math.max(bonusMax, computeDamage(createRng('c' + i), caster, target(), 2, flagsA))
      plainMax = Math.max(plainMax, computeDamage(createRng('c' + i), plain, target(), 2, flagsB))
    }
    expect(bonusMax).toBeGreaterThan(plainMax)
  })
  it('Tassorosso damageReduction lowers damage taken', () => {
    const caster = unit('harry', 200, { side: 'left' })
    const tough = unit('cedric', 1000, { side: 'right', damageReduction: 0.5 })
    const soft = unit('cedric', 1000, { side: 'right' })
    const dTough = (resolveAction(createRng('r'), 1, caster, tough, atkSpell).value ?? 0)
    const dSoft = (resolveAction(createRng('r'), 1, caster, soft, atkSpell).value ?? 0)
    expect(dTough).toBeLessThan(dSoft)
  })
  it('Serpeverde cunning adds damage only to a WOUNDED target', () => {
    const caster = unit('voldemort', 200, { side: 'left', cunning: { threshold: 0.5, bonus: 0.5 } })
    const wounded = { ...unit('harry', 1000, { side: 'right' }), hp: 100 }   // 10% HP → below 0.5
    const healthy = unit('harry', 1000, { side: 'right' })                    // 100% HP → above 0.5
    const dW = (resolveAction(createRng('s'), 1, caster, wounded as any, atkSpell).value ?? 0)
    const dH = (resolveAction(createRng('s'), 1, caster, healthy, atkSpell).value ?? 0)
    expect(dW).toBeGreaterThan(dH)
  })
})
