import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import type { BattleUnit } from '@/types'

function u(id: string, side: 'left' | 'right'): BattleUnit {
  return {
    wizard: { id, name: id, role: 'Supporto' }, side, hp: 100, maxHp: 100, alive: true,
    statusEffects: [], cooldowns: {}, buffedStats: { hp: 100, atk: 10, def: 10, spd: 10 },
  } as unknown as BattleUnit
}
const noRng = { chance: () => false } as any
const shieldsOf = (unit: BattleUnit) => unit.statusEffects.filter(e => e.statusId === 'shield')

describe('shield stacking policy (refresh, not accumulate)', () => {
  it('re-casting a shield from the SAME caster refreshes its pool instead of stacking', () => {
    const caster = u('sup', 'left')
    const ally = u('mate', 'left')
    const cast = (amount: number) => EFFECT_HANDLERS.shield({ rng: noRng, turn: 1, actor: caster, target: ally, flags: [] as any } as any, { kind: 'shield', amount } as any)
    cast(20)
    cast(30)
    const shields = shieldsOf(ally)
    expect(shields).toHaveLength(1)
    expect(shields[0]!.absorbLeft).toBe(30)
  })

  it('shields from DIFFERENT casters coexist (source-keyed, like the overflow path)', () => {
    const ally = u('mate', 'left')
    EFFECT_HANDLERS.shield({ rng: noRng, turn: 1, actor: u('a', 'left'), target: ally, flags: [] as any } as any, { kind: 'shield', amount: 20 } as any)
    EFFECT_HANDLERS.shield({ rng: noRng, turn: 1, actor: u('b', 'left'), target: ally, flags: [] as any } as any, { kind: 'shield', amount: 25 } as any)
    expect(shieldsOf(ally)).toHaveLength(2)
  })
})
