import { describe, it, expect } from 'vitest'
import { applyStatus } from '@/game/engine/status'
import { maybeSpitPoison } from '@/game/engine/duoEffects/spitOnHeal'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard, ActiveDuo, Side } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Model on tests/engine/duoEffects/miasma.test.ts's `unit` helper.
function unit(side: Side, id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 1000, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [1000, 1000], atk: [80, 80], def: [30, 30], spd: [40, 40] }, spellPool: ['base_attack'] },
    stats, maxHp: 1000, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side, hp: 1000, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

const duo = (id: string): ActiveDuo => ({ duo: { id, name: '', desc: '', signals: ['supporto', 'veleno'] } })

function velenoStacks(u: BattleUnit): number {
  return u.statusEffects.find(e => e.statusId === 'veleno')?.stacks ?? 0
}

describe('maybeSpitPoison — primitive (unit tests)', () => {
  it('applies 1 veleno dose to one living enemy', () => {
    const e1 = unit('right', 'e1')
    const e2 = unit('right', 'e2')
    const rng = createRng('untore-seed')
    maybeSpitPoison([e1, e2], rng, 'left:healer')
    const total = velenoStacks(e1) + velenoStacks(e2)
    expect(total).toBe(1)
    expect([velenoStacks(e1), velenoStacks(e2)].filter(s => s > 0).length).toBe(1)
  })

  it('skips dead enemies (only living units are candidates)', () => {
    const dead = unit('right', 'e1', { alive: false, hp: 0 })
    const alive = unit('right', 'e2')
    const rng = createRng('seed')
    maybeSpitPoison([dead, alive], rng, 'left:healer')
    expect(velenoStacks(dead)).toBe(0)
    expect(velenoStacks(alive)).toBe(1)
  })

  it('empty pool (no living enemies): no throw, no-op, and NO rng draw happens', () => {
    let drew = false
    const spyRng = createRng('seed')
    const rng = { ...spyRng, pick: <T,>(arr: readonly T[]): T => { drew = true; return spyRng.pick(arr) } }
    expect(() => maybeSpitPoison([], rng, 'left:healer')).not.toThrow()
    expect(drew).toBe(false)
  })

  it('all-dead pool: no throw, no-op, and NO rng draw happens', () => {
    const dead = unit('right', 'e1', { alive: false, hp: 0 })
    let drew = false
    const spyRng = createRng('seed')
    const rng = { ...spyRng, pick: <T,>(arr: readonly T[]): T => { drew = true; return spyRng.pick(arr) } }
    expect(() => maybeSpitPoison([dead], rng, 'left:healer')).not.toThrow()
    expect(drew).toBe(false)
  })

  it('determinism: same seed -> same recipient across two independent runs', () => {
    const mk = () => [unit('right', 'e1'), unit('right', 'e2'), unit('right', 'e3'), unit('right', 'e4')]
    const pool1 = mk()
    maybeSpitPoison(pool1, createRng('fixed-seed'), 'left:healer')
    const pool2 = mk()
    maybeSpitPoison(pool2, createRng('fixed-seed'), 'left:healer')
    const recipientOf = (pool: BattleUnit[]) => pool.find(u => velenoStacks(u) > 0)?.wizard.id
    expect(recipientOf(pool1)).toBe(recipientOf(pool2))
  })

  it('pool sorted by wizard.id before the single rng.pick draw (deterministic, not array order)', () => {
    const zebra = unit('right', 'zebra')
    const apple = unit('right', 'apple')
    const mango = unit('right', 'mango')
    const rngA = createRng('order-seed')
    maybeSpitPoison([zebra, apple, mango], rngA, 'left:healer')
    const recipientA = [zebra, apple, mango].find(u => velenoStacks(u) > 0)?.wizard.id

    const zebra2 = unit('right', 'zebra')
    const apple2 = unit('right', 'apple')
    const mango2 = unit('right', 'mango')
    const rngB = createRng('order-seed')
    maybeSpitPoison([mango2, zebra2, apple2], rngB, 'left:healer') // different insertion order
    const recipientB = [zebra2, apple2, mango2].find(u => velenoStacks(u) > 0)?.wizard.id

    expect(recipientA).toBe(recipientB)
  })

  it('credits the sourceId passed in (poison attributed to the healer, not the recipient)', () => {
    const e1 = unit('right', 'e1')
    const rng = createRng('seed')
    maybeSpitPoison([e1], rng, 'left:healer-id')
    expect(e1.statusEffects.find(e => e.statusId === 'veleno')?.sourceId).toBe('left:healer-id')
  })
})

describe('UNTORE — integration through simulateBattle', () => {
  it('a player heal with UNTORE stamped applies veleno to a living enemy', () => {
    // No player spell here casts veleno directly (episkey heals, base_attack hits) — so any
    // 'Veleno' DoT tick credited to the LEFT side against a RIGHT target can only have come
    // from UNTORE firing off the heal. Search across seeds for a battle that heals at least
    // once (episkey has a cooldown, so it won't fire every turn).
    const leftDuos: ActiveDuo[] = [duo('untore')]
    let sawUntorePoison = false
    for (let seed = 0; seed < 25 && !sawUntorePoison; seed++) {
      const L: DraftedWizard[] = [
        unit('left', 'healer', { spell: SPELL_BY_ID['episkey']! }),
        unit('left', 'wounded', { hp: 200 }),
      ]
      const R: DraftedWizard[] = [unit('right', 'e1'), unit('right', 'e2')]
      const rng = createRng(`untore-int-${seed}`)
      const result = simulateBattle(L, R, rng, { leftDuos, kind: 'normal' })
      sawUntorePoison = result.log.some(
        e => e.flags?.includes('dot') && e.actorSide === 'left' && e.targetSide === 'right' && e.action === 'Veleno',
      )
    }
    expect(sawUntorePoison).toBe(true)
  })

  it('battle owns UNTORE: runs end-to-end without throwing across many seeds', () => {
    const leftDuos: ActiveDuo[] = [duo('untore')]
    for (let seed = 0; seed < 15; seed++) {
      const L: DraftedWizard[] = [
        unit('left', 'healer', { spell: SPELL_BY_ID['episkey']! }),
        unit('left', 'wounded', { hp: 100 }),
      ]
      const R: DraftedWizard[] = [unit('right', 'e1'), unit('right', 'e2')]
      const rng = createRng(`untore-smoke-${seed}`)
      const result = simulateBattle(L, R, rng, { leftDuos, kind: 'normal' })
      expect(result.winner === 'left' || result.winner === 'right').toBe(true)
    }
  })

  it('same seed -> identical battle log/result twice (replay parity unaffected by UNTORE wiring)', () => {
    const mkTeams = () => ({
      left: [unit('left', 'healer', { spell: SPELL_BY_ID['episkey']! }), unit('left', 'p2')] as DraftedWizard[],
      right: [unit('right', 'e1'), unit('right', 'e2')] as DraftedWizard[],
    })
    const leftDuos: ActiveDuo[] = [duo('untore')]
    const t1 = mkTeams()
    const r1 = simulateBattle(t1.left, t1.right, createRng('untore-parity-seed'), { leftDuos, kind: 'normal' })
    const t2 = mkTeams()
    const r2 = simulateBattle(t2.left, t2.right, createRng('untore-parity-seed'), { leftDuos, kind: 'normal' })
    expect(r1.log).toEqual(r2.log)
    expect(r1.winner).toBe(r2.winner)
  })
})
