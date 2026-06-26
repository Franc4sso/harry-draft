import { describe, it, expect } from 'vitest'
import { selectTarget } from '@/game/engine/combat/targeting'
import type { BattleUnit, Role } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function u(id: string, role: Role, side: 'left' | 'right', over: Partial<BattleUnit['buffedStats']> = {}): BattleUnit {
  const stats = { hp: 120, atk: 30, def: 20, spd: 25, ...over }
  return {
    wizard: { id, name: id, house: 'Grifondoro', role, tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: ['base_attack'] },
    stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']!,
    side, hp: stats.hp, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true,
  }
}

describe('threat targeting', () => {
  it('an Attacker focuses the enemy Tank while it is alive', () => {
    const me = u('att', 'Attaccante', 'left')
    const enemies = [u('squishy', 'Supporto', 'right', { atk: 40, spd: 40 }), u('wall', 'Tank', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('after the Tank dies the Attacker hits the highest-threat backliner', () => {
    const me = u('att', 'Attaccante', 'left')
    const dead = u('wall', 'Tank', 'right'); dead.alive = false
    const enemies = [u('weak', 'Supporto', 'right', { hp: 10, atk: 10, spd: 10 }), u('scary', 'Attaccante', 'right', { atk: 40, spd: 40 }), dead]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('scary')
  })

  it('Controllo bypasses the taunt and hits the enemy Supporto', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('wall', 'Tank', 'right', { atk: 60, spd: 50 }), u('healer', 'Supporto', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('healer')
  })

  it('Controllo hits a Tank only if nothing else is alive', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('wall', 'Tank', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('Supporto heals the most wounded ally', () => {
    const me = u('sup', 'Supporto', 'left')
    const hurt = u('hurt', 'Tank', 'left'); hurt.hp = 10
    expect(selectTarget(me, [me, hurt], [u('e', 'Attaccante', 'right')])?.wizard.id).toBe('hurt')
  })
})
