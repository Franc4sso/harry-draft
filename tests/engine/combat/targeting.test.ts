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

  it('after the Tank dies the Attacker dives the enemy Supporto (Affondo) over a scarier Attaccante', () => {
    const me = u('att', 'Attaccante', 'left')
    const dead = u('wall', 'Tank', 'right'); dead.alive = false
    const enemies = [u('weak', 'Supporto', 'right', { hp: 10, atk: 10, spd: 10 }), u('scary', 'Attaccante', 'right', { atk: 40, spd: 40 }), dead]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('weak')
  })

  it('after the Tank dies the Attacker falls back to highest-threat when no Supporto/Controllo remain', () => {
    const me = u('att', 'Attaccante', 'left')
    const dead = u('wall', 'Tank', 'right'); dead.alive = false
    const enemies = [u('weak', 'Attaccante', 'right', { hp: 10, atk: 10, spd: 10 }), u('scary', 'Attaccante', 'right', { atk: 40, spd: 40 }), dead]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('scary')
  })

  // IRON TAUNT (USER 2026-07-08): an actively-provoking Tank MUST be attacked by every
  // enemy role — including Controllo. The old "Controllo scavalca a soft spell to the
  // backline" escape valve is GONE. The taunt only lifts when the Tank is hard-controlled
  // (stun/freeze/silence), never merely because the attacker's spell is soft.
  it('Controllo respects the taunt and hits the provoking Tank', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('wall', 'Tank', 'right', { atk: 60, spd: 50 }), u('healer', 'Supporto', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('Controllo hits a Tank when it is the only enemy alive', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('wall', 'Tank', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('a Controllo with a HARD-control spell targets the taunting Tank to break it', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('healer', 'Supporto', 'right'), u('wall', 'Tank', 'right')]
    // petrificus applies stun (a hard control) → spend it on the wall.
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['petrificus']!)?.wizard.id).toBe('wall')
  })

  it('a Controllo with a SOFT-control spell STILL respects the taunt (iron taunt)', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('healer', 'Supporto', 'right'), u('wall', 'Tank', 'right')]
    // confundo is soft, but the Tank is provoking → must still be hit.
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['confundo']!)?.wizard.id).toBe('wall')
  })

  it('a Controllo scavalca to the backline once the Tank is hard-controlled', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const stunnedWall = u('wall', 'Tank', 'right'); stunnedWall.statusEffects = [{ kind: 'stun', remaining: 1, stacks: 1 } as never]
    const enemies = [u('healer', 'Supporto', 'right'), stunnedWall]
    // Tank is stunned → taunt is lifted → backline is fair game.
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['confundo']!)?.wizard.id).toBe('healer')
  })

  it('a Supporto casting an OFFENSIVE attack spell aims at an enemy, never an ally (Serpensortia-on-ally bug)', () => {
    const me = u('narcissa', 'Supporto', 'left')
    const woundedAlly = u('cedric', 'Attaccante', 'left'); woundedAlly.hp = 10
    const enemy = u('foe', 'Attaccante', 'right')
    const t = selectTarget(me, [me, woundedAlly], [enemy], SPELL_BY_ID['serpensortia']!)
    expect(t?.side).toBe('right')
    expect(t?.wizard.id).toBe('foe')
  })

  it('a Supporto casting a Controllo spell aims at an enemy, never an ally', () => {
    const me = u('sup', 'Supporto', 'left')
    const woundedAlly = u('ally', 'Attaccante', 'left'); woundedAlly.hp = 10
    const enemy = u('foe', 'Attaccante', 'right')
    const t = selectTarget(me, [me, woundedAlly], [enemy], SPELL_BY_ID['silencio']!)
    expect(t?.side).toBe('right')
  })

  it('Supporto heals the most wounded ally', () => {
    const me = u('sup', 'Supporto', 'left')
    const hurt = u('hurt', 'Tank', 'left'); hurt.hp = 10
    expect(selectTarget(me, [me, hurt], [u('e', 'Attaccante', 'right')])?.wizard.id).toBe('hurt')
  })

  it('Supporto protects a damaged high-ATK carry over a more-wounded but low-value ally', () => {
    const me = u('sup', 'Supporto', 'left')
    // Carry: high ATK, took some damage but isn't the lowest-HP-fraction ally.
    const carry = u('carry', 'Attaccante', 'left', { atk: 150 }); carry.hp = 100
    // Chaff: much more wounded (lower hp fraction), but low value (low ATK).
    const chaff = u('chaff', 'Supporto', 'left', { atk: 10 }); chaff.hp = 10
    expect(selectTarget(me, [me, carry, chaff], [u('e', 'Attaccante', 'right')])?.wizard.id).toBe('carry')
  })

  it('Supporto falls back to most-wounded when no carry is in danger', () => {
    const me = u('sup', 'Supporto', 'left')
    const hurt = u('hurt', 'Tank', 'left'); hurt.hp = 10
    const fine = u('fine', 'Attaccante', 'left', { atk: 150 })
    expect(selectTarget(me, [me, fine, hurt], [u('e', 'Attaccante', 'right')])?.wizard.id).toBe('hurt')
  })

  it('Supporto falls back to lowest-HP enemy when no ally needs help', () => {
    const me = u('sup', 'Supporto', 'left')
    const fine = u('fine', 'Attaccante', 'left', { atk: 150 })
    const weakEnemy = u('weak', 'Attaccante', 'right'); weakEnemy.hp = 5
    const strongEnemy = u('strong', 'Attaccante', 'right')
    expect(selectTarget(me, [me, fine], [strongEnemy, weakEnemy])?.wizard.id).toBe('weak')
  })

  it('an enemy Tank focuses the taunting Tank, not the squishiest', () => {
    const me = u('bruiser', 'Tank', 'left')
    const enemies = [u('squishy', 'Supporto', 'right', { atk: 10, spd: 10 }), u('wall', 'Tank', 'right')]
    // A Tank normally hits lowest-HP; with an enemy taunt active it must hit the wall.
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('an offensive Supporto focuses the taunting Tank', () => {
    const me = u('narc', 'Supporto', 'left')
    const enemies = [u('squishy', 'Attaccante', 'right', { atk: 40, spd: 40 }), u('wall', 'Tank', 'right')]
    // Give the Supporto an offensive spell so it aims at an enemy at all.
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['serpensortia']!)?.wizard.id).toBe('wall')
  })

  it('a Tank ignores a STUNNED enemy Tank (taunt suppressed) and hits the squishiest', () => {
    const me = u('bruiser', 'Tank', 'left')
    const stunnedWall = u('wall', 'Tank', 'right'); stunnedWall.statusEffects = [{ kind: 'stun', remaining: 1, stacks: 1 } as never]
    const enemies = [u('squishy', 'Supporto', 'right', { hp: 30, atk: 10, spd: 10 }), stunnedWall]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('squishy')
  })
})
