import { describe, it, expect } from 'vitest'
import { explainTarget } from '@/game/engine/combat/targeting'
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

const attackSpell = SPELL_BY_ID['base_attack']!
const controlSpell = SPELL_BY_ID['confundo']!
const healSpell = SPELL_BY_ID['episkey']!

describe('explainTarget — il motivo del bersaglio', () => {
  it('Tank senza taunt nemico → il più debole', () => {
    const tank = u('bruiser', 'Tank', 'left')
    const allies = [tank]
    const enemiesNoTank = [u('squishy', 'Supporto', 'right', { hp: 30, atk: 10, spd: 10 })]
    expect(explainTarget(tank, allies, enemiesNoTank, attackSpell)).toBe('weakest')
  })

  it('un Tank nemico che provoca → provocato (per ogni ruolo attaccante)', () => {
    const attaccante = u('att', 'Attaccante', 'left')
    const allies = [attaccante]
    const enemiesWithTank = [u('squishy', 'Supporto', 'right', { atk: 40, spd: 40 }), u('wall', 'Tank', 'right')]
    expect(explainTarget(attaccante, allies, enemiesWithTank, attackSpell)).toBe('taunt')
  })

  it('Attaccante senza taunt → affondo (dive)', () => {
    const attaccante = u('att', 'Attaccante', 'left')
    const allies = [attaccante]
    const enemiesNoTank = [u('weak', 'Attaccante', 'right', { hp: 10, atk: 10, spd: 10 }), u('scary', 'Attaccante', 'right', { atk: 40, spd: 40 })]
    expect(explainTarget(attaccante, allies, enemiesNoTank, attackSpell)).toBe('dive')
  })

  it("Controllo senza taunt → backline", () => {
    const controllo = u('ctrl', 'Controllo', 'left')
    const allies = [controllo]
    const enemiesNoTank = [u('healer', 'Supporto', 'right'), u('foe', 'Attaccante', 'right')]
    expect(explainTarget(controllo, allies, enemiesNoTank, controlSpell)).toBe('backline')
  })

  it("Supporto con magia d'attacco, no taunt → minaccia (threat)", () => {
    const supporto = u('sup', 'Supporto', 'left')
    const allies = [supporto]
    const enemiesNoTank = [u('foe', 'Attaccante', 'right')]
    expect(explainTarget(supporto, allies, enemiesNoTank, attackSpell)).toBe('threat')
  })

  it('Supporto in cura → null (nessun motivo di bersaglio nemico)', () => {
    const supporto = u('sup', 'Supporto', 'left')
    const hurt = u('hurt', 'Tank', 'left'); hurt.hp = 10
    const alliesWounded = [supporto, hurt]
    const enemies = [u('e', 'Attaccante', 'right')]
    expect(explainTarget(supporto, alliesWounded, enemies, healSpell)).toBeNull()
  })
})
