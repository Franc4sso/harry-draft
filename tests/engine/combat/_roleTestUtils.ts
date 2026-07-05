import type { BattleUnit, Role } from '@/types'

/** Minimal BattleUnit for targeting/damage unit tests. Only the fields the role-counter
 *  code reads are meaningful (wizard.role, stats, statusEffects, hp/alive/side). */
export function mkUnit(over: { id: string; role: Role } & Partial<BattleUnit>): BattleUnit {
  const { id, role, ...rest } = over
  const stats = rest.stats ?? { hp: 100, atk: 20, def: 10, spd: 10 }
  return {
    wizard: { id, name: id, house: 'Grifondoro', role, spellPool: ['base_attack'] } as never,
    stats,
    // effectiveStats()/computeDamage() read buffedStats, not stats — default it to the
    // same values so passing `stats` alone (the common case in these tests) is enough.
    buffedStats: stats,
    hp: 100, maxHp: 100, alive: true, side: 'right',
    statusEffects: [], cooldowns: {},
    spell: { id: 'base_attack', name: 'Colpo', type: 'Attacco', hitChance: 1 } as never,
    ...rest,
  } as BattleUnit
}
