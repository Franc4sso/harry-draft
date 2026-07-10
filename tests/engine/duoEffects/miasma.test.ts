import { describe, it, expect } from 'vitest'
import { applyStatus } from '@/game/engine/status'
import { maybeSpreadPoison } from '@/game/engine/duoEffects/spreadOnDeath'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard, ActiveDuo, Side } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Model on tests/engine/duoEffects/cancrena.test.ts's `unit` helper.
function unit(side: Side, id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 1000, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [1000, 1000], atk: [80, 80], def: [30, 30], spd: [40, 40] }, spellPool: ['base_attack'] },
    stats, maxHp: 1000, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side, hp: 1000, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

const duo = (id: string): ActiveDuo => ({ duo: { id, name: '', desc: '', signals: ['veleno', 'controllo'] } })

function velenoStacks(u: BattleUnit): number {
  return u.statusEffects.find(e => e.statusId === 'veleno')?.stacks ?? 0
}

describe('maybeSpreadPoison — primitive (unit tests)', () => {
  it('a poisoned right unit dying jumps its veleno stacks to one OTHER living right unit', () => {
    const dead = unit('right', 'e1', { alive: false, hp: 0 })
    applyStatus(dead, 'veleno')
    applyStatus(dead, 'veleno')
    applyStatus(dead, 'veleno') // 3 stacks
    const b = unit('right', 'e2')
    const c = unit('right', 'e3')
    const rng = createRng('miasma-seed')
    maybeSpreadPoison(dead, [dead, b, c], rng)
    const total = velenoStacks(b) + velenoStacks(c)
    expect(total).toBe(3)
    // exactly one of them got it, not both split
    expect([velenoStacks(b), velenoStacks(c)].filter(s => s > 0).length).toBe(1)
  })

  it('left-side deaths never spread (player-only owner, enemy deaths only)', () => {
    const dead = unit('left', 'p1', { alive: false, hp: 0 })
    applyStatus(dead, 'veleno')
    const ally = unit('left', 'p2')
    const rng = createRng('seed')
    maybeSpreadPoison(dead, [dead, ally], rng)
    expect(velenoStacks(ally)).toBe(0)
  })

  it('a dead unit with zero veleno stacks does nothing', () => {
    const dead = unit('right', 'e1', { alive: false, hp: 0 })
    const other = unit('right', 'e2')
    const rng = createRng('seed')
    maybeSpreadPoison(dead, [dead, other], rng)
    expect(velenoStacks(other)).toBe(0)
  })

  it('empty pool (last enemy standing dies): no throw, no-op, and NO rng draw happens', () => {
    const dead = unit('right', 'e1', { alive: false, hp: 0 })
    applyStatus(dead, 'veleno')
    let drew = false
    const spyRng = createRng('seed')
    const rng = { ...spyRng, pick: <T,>(arr: readonly T[]): T => { drew = true; return spyRng.pick(arr) } }
    expect(() => maybeSpreadPoison(dead, [dead], rng)).not.toThrow()
    expect(drew).toBe(false)
  })

  it('additive to the veleno cap (8): recipient already at 6 stacks only gains up to the cap', () => {
    const dead = unit('right', 'e1', { alive: false, hp: 0 })
    for (let i = 0; i < 5; i++) applyStatus(dead, 'veleno') // 5 stacks
    const recipient = unit('right', 'e2')
    for (let i = 0; i < 6; i++) applyStatus(recipient, 'veleno') // 6 stacks
    const rng = createRng('seed')
    maybeSpreadPoison(dead, [dead, recipient], rng)
    expect(velenoStacks(recipient)).toBe(8) // capped, not 11
  })

  it('determinism: same seed -> same recipient across two independent runs', () => {
    const mk = () => {
      const dead = unit('right', 'e1', { alive: false, hp: 0 })
      applyStatus(dead, 'veleno')
      const b = unit('right', 'e2')
      const c = unit('right', 'e3')
      const d = unit('right', 'e4')
      return { dead, pool: [dead, b, c, d] }
    }
    const run1 = mk()
    maybeSpreadPoison(run1.dead, run1.pool, createRng('fixed-seed'))
    const run2 = mk()
    maybeSpreadPoison(run2.dead, run2.pool, createRng('fixed-seed'))
    const recipientOf = (pool: BattleUnit[]) => pool.find(u => u.wizard.id !== 'e1' && velenoStacks(u) > 0)?.wizard.id
    expect(recipientOf(run1.pool)).toBe(recipientOf(run2.pool))
  })

  it('pool sorted by wizard.id before the single rng.pick draw (deterministic, not array order)', () => {
    // Build a pool in NON-sorted insertion order; the primitive must sort before picking,
    // so the draw only depends on the seed + candidate set, never on caller ordering.
    const dead = unit('right', 'e1', { alive: false, hp: 0 })
    applyStatus(dead, 'veleno')
    const zebra = unit('right', 'zebra')
    const apple = unit('right', 'apple')
    const mango = unit('right', 'mango')
    const rngA = createRng('order-seed')
    maybeSpreadPoison(dead, [dead, zebra, apple, mango], rngA)
    const recipientA = [zebra, apple, mango].find(u => velenoStacks(u) > 0)?.wizard.id

    const dead2 = unit('right', 'e1', { alive: false, hp: 0 })
    applyStatus(dead2, 'veleno')
    const zebra2 = unit('right', 'zebra')
    const apple2 = unit('right', 'apple')
    const mango2 = unit('right', 'mango')
    const rngB = createRng('order-seed')
    maybeSpreadPoison(dead2, [mango2, dead2, zebra2, apple2], rngB) // different insertion order
    const recipientB = [zebra2, apple2, mango2].find(u => velenoStacks(u) > 0)?.wizard.id

    expect(recipientA).toBe(recipientB)
  })
})

describe('MIASMA — integration through simulateBattle', () => {
  it('battle owns MIASMA: a poisoning attacker vs multiple enemies runs end-to-end without ' +
     'throwing, across many seeds — exercises the 4 death-site call sites for real (direct-hit, ' +
     'DoT-tick, fatigue kills all occur naturally over the course of these battles)', () => {
    const leftDuos: ActiveDuo[] = [duo('miasma')]
    for (let seed = 0; seed < 25; seed++) {
      const left: DraftedWizard[] = [
        unit('left', 'p1', { spell: SPELL_BY_ID['serpensortia']! }),
        unit('left', 'p2', { spell: SPELL_BY_ID['serpensortia']! }),
      ]
      const right: DraftedWizard[] = [
        unit('right', 'e1'), unit('right', 'e2'), unit('right', 'e3'),
      ]
      const rng = createRng(`miasma-smoke-${seed}`)
      const result = simulateBattle(left, right, rng, { leftDuos, kind: 'normal' })
      expect(result.winner === 'left' || result.winner === 'right').toBe(true)
      expect(Number.isFinite(result.turns)).toBe(true)
    }
  })

  it('same seed -> identical battle log/result twice (replay parity unaffected by MIASMA wiring)', () => {
    const mkTeams = () => ({
      left: [unit('left', 'p1'), unit('left', 'p2')] as DraftedWizard[],
      right: [unit('right', 'e1'), unit('right', 'e2')] as DraftedWizard[],
    })
    const leftDuos: ActiveDuo[] = [duo('miasma')]
    const t1 = mkTeams()
    const r1 = simulateBattle(t1.left, t1.right, createRng('parity-seed'), { leftDuos, kind: 'normal' })
    const t2 = mkTeams()
    const r2 = simulateBattle(t2.left, t2.right, createRng('parity-seed'), { leftDuos, kind: 'normal' })
    expect(r1.log).toEqual(r2.log)
    expect(r1.winner).toBe(r2.winner)
  })
})
