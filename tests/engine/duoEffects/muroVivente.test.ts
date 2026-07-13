import { describe, it, expect } from 'vitest'
import type { ActiveDuo, BattleUnit, Wizard } from '@/types'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import { DUO_BY_ID } from '@/data/duos'

function wiz(id: string, role: Wizard['role']): Wizard {
  return {
    id, name: id, role, house: 'Grifondoro', tier: 3, gender: 'm',
    ranges: { hp: [100, 100], atk: [50, 50], def: [10, 10], spd: [10, 10] }, spellPool: ['base_attack'],
  }
}
function unit(id: string, role: Wizard['role'], side: 'left' | 'right'): BattleUnit {
  const w = wiz(id, role)
  return {
    wizard: w, spell: { id: 'base_attack', name: 'Attacco', type: 'Attacco' } as any,
    stats: { hp: 100, atk: 50, def: 10, spd: 10 }, maxHp: 100,
    buffedStats: { hp: 100, atk: 50, def: 10, spd: 10 }, hp: 100,
    cooldowns: {}, statusEffects: [], alive: true, side,
  } as BattleUnit
}
const muroDuo: ActiveDuo = { duo: DUO_BY_ID['muro-vivente']! }

describe('Muro Vivente — stamp', () => {
  it('stampa livingWall = { reflect } sui Tank del player', () => {
    const tank = unit('tank', 'Tank', 'left')
    const carry = unit('carry', 'Attaccante', 'left')
    stampDuoFields([tank, carry], [], [muroDuo], 'normal')
    expect(tank.livingWall).toEqual({ reflect: 0.4 })
    expect(carry.livingWall).toBeUndefined()   // solo i Tank
  })

  it('non stampa nulla sui nemici', () => {
    const enemyTank = unit('etank', 'Tank', 'right')
    stampDuoFields([], [enemyTank], [muroDuo], 'normal')
    expect(enemyTank.livingWall).toBeUndefined()
  })
})
