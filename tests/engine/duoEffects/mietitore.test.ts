import { describe, it, expect } from 'vitest'
import { maybeReap } from '@/game/engine/duoEffects/reap'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard, ActiveDuo, Side } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Model on tests/engine/duoEffects/miasma.test.ts's `unit` helper. `statsOver` matters for
// simulateBattle-based integration tests (below): toBattleUnits rebuilds hp/buffedStats from
// `dw.stats`, NOT from any `hp` field on the caller's object, so a low/high starting HP for an
// integration scenario must be set via `statsOver.hp`.
function unit(
  side: Side, id: string, over: Partial<BattleUnit> = {},
  statsOver: Partial<{ hp: number; atk: number; def: number; spd: number }> = {},
): BattleUnit {
  const stats = { hp: 1000, atk: 80, def: 30, spd: 40, ...statsOver }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [1000, 1000], atk: [80, 80], def: [30, 30], spd: [40, 40] }, spellPool: ['base_attack'] },
    stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side, hp: stats.hp, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

const duo = (id: string): ActiveDuo => ({ duo: { id, name: '', desc: '', signals: ['attaccante', 'esecuzione'] } })

function raccoltoStacks(u: BattleUnit): number {
  return u.statusEffects.filter(e => e.statusId === 'raccolto').length
}

describe('maybeReap — primitive (unit tests)', () => {
  it('applies one raccolto stack (atk buff) to the killer', () => {
    const killer = unit('left', 'k1')
    maybeReap(killer)
    expect(raccoltoStacks(killer)).toBe(1)
    expect(killer.statusEffects[0]!.statusId).toBe('raccolto')
    expect(killer.statusEffects[0]!.stat).toBe('atk')
  })

  it('a second kill adds a second stack', () => {
    const killer = unit('left', 'k1')
    maybeReap(killer)
    maybeReap(killer)
    expect(raccoltoStacks(killer)).toBe(2)
  })

  it('credits the killer as sourceId', () => {
    const killer = unit('left', 'k1')
    maybeReap(killer)
    expect(killer.statusEffects[0]!.sourceId).toBe('left:k1')
  })
})

describe('MIETITORE — integration through simulateBattle', () => {
  it('a reaper-flagged left unit landing a killing blow gains a raccolto stack', () => {
    // One massively overpowered left attacker vs. a paper-thin enemy (dies turn 1) PLUS a tanky
    // survivor — the tanky one keeps the battle (and its snapshots) going for several more turns
    // after the kill, so the post-kill raccolto stamp actually lands in a captured snapshot.
    // (Snapshots are only taken at pushLog time, and the KO log line for the kill itself is
    // pushed BEFORE maybeReap runs; without a survivor the battle would end on that same KO and
    // the stamp — though genuinely applied in memory — would never appear in any snapshot.)
    const leftDuos: ActiveDuo[] = [duo('mietitore')]
    const L: DraftedWizard[] = [unit('left', 'killer', {}, { hp: 5000, atk: 500 })]
    const R: DraftedWizard[] = [unit('right', 'e1', {}, { hp: 10 }), unit('right', 'survivor', {}, { hp: 5000 })]
    const rng = createRng('mietitore-int-seed')
    const result = simulateBattle(L, R, rng, { leftDuos, kind: 'normal' })
    const lastSnap = result.snapshots[result.snapshots.length - 1]!
    const killerState = lastSnap['left:killer']
    const stacks = killerState?.statusEffects.filter(e => e.statusId === 'raccolto').length ?? 0
    expect(stacks).toBeGreaterThanOrEqual(1)
  })

  it('a second kill (two weak enemies) adds a second raccolto stack', () => {
    const leftDuos: ActiveDuo[] = [duo('mietitore')]
    const L: DraftedWizard[] = [unit('left', 'killer', {}, { hp: 5000, atk: 500 })]
    const R: DraftedWizard[] = [
      unit('right', 'e1', {}, { hp: 10 }), unit('right', 'e2', {}, { hp: 10 }), unit('right', 'survivor', {}, { hp: 5000 }),
    ]
    const rng = createRng('mietitore-int-seed-2')
    const result = simulateBattle(L, R, rng, { leftDuos, kind: 'normal' })
    const lastSnap = result.snapshots[result.snapshots.length - 1]!
    const stacks = lastSnap['left:killer']?.statusEffects.filter(e => e.statusId === 'raccolto').length ?? 0
    expect(stacks).toBe(2)
  })

  it('battle owns MIETITORE: runs end-to-end without throwing across many seeds', () => {
    const leftDuos: ActiveDuo[] = [duo('mietitore')]
    for (let seed = 0; seed < 15; seed++) {
      const L: DraftedWizard[] = [unit('left', 'p1'), unit('left', 'p2')]
      const R: DraftedWizard[] = [unit('right', 'e1'), unit('right', 'e2')]
      const rng = createRng(`mietitore-smoke-${seed}`)
      const result = simulateBattle(L, R, rng, { leftDuos, kind: 'normal' })
      expect(result.winner === 'left' || result.winner === 'right').toBe(true)
    }
  })

  it('a non-reaper killer gains nothing (no MIETITORE duo active)', () => {
    const L: DraftedWizard[] = [unit('left', 'killer', {}, { hp: 5000 })]
    const R: DraftedWizard[] = [unit('right', 'e1', {}, { hp: 10 })]
    const rng = createRng('no-mietitore-seed')
    const result = simulateBattle(L, R, rng) // no leftDuos at all -> stampDuoFields never sets .reaper
    expect(result.winner).toBe('left')
    const lastSnap = result.snapshots[result.snapshots.length - 1]!
    const stacks = lastSnap['left:killer']?.statusEffects.filter(e => e.statusId === 'raccolto').length ?? 0
    expect(stacks).toBe(0)
  })

  it('same seed -> identical battle log/result twice (replay parity unaffected by MIETITORE wiring)', () => {
    const mkTeams = () => ({
      left: [unit('left', 'p1'), unit('left', 'p2')] as DraftedWizard[],
      right: [unit('right', 'e1'), unit('right', 'e2')] as DraftedWizard[],
    })
    const leftDuos: ActiveDuo[] = [duo('mietitore')]
    const t1 = mkTeams()
    const r1 = simulateBattle(t1.left, t1.right, createRng('mietitore-parity-seed'), { leftDuos, kind: 'normal' })
    const t2 = mkTeams()
    const r2 = simulateBattle(t2.left, t2.right, createRng('mietitore-parity-seed'), { leftDuos, kind: 'normal' })
    expect(r1.log).toEqual(r2.log)
    expect(r1.winner).toBe(r2.winner)
  })
})
