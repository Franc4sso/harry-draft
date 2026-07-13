// COPERTURA TRANSITORIA: il wall-retarget in targeting.ts vive fino al Task 4 della slice Muro Vivente (redesign a riflesso). Rimuovere questo file quando quel blocco viene eliminato.
import { describe, it, expect } from 'vitest'
import { selectTarget } from '@/game/engine/combat/targeting'
import type { BattleUnit, Role, Side, ActiveEffect } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Model on tests/engine/duoEffects/muroVivente.test.ts's `wiz`/`unit` helpers.
function u(id: string, role: Role, side: Side, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 30, def: 20, spd: 25 }
  return {
    wizard: {
      id, name: id, role, house: 'Grifondoro', tier: 3, gender: 'm',
      ranges: { hp: [120, 120], atk: [30, 30], def: [20, 20], spd: [25, 25] }, spellPool: ['base_attack'],
    },
    stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']!,
    side, hp: stats.hp, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true,
    ...over,
  }
}

// Mirrors the real shield ActiveEffect shape (game/engine/status.ts): kind+statusId 'shield', absorbLeft.
const shield = (absorbLeft: number): ActiveEffect =>
  ({ kind: 'shield', statusId: 'shield', remaining: 3, stacks: 1, absorbLeft })

const stun: ActiveEffect = { kind: 'stun', remaining: 1, stacks: 1 }

describe('MURO VIVENTE retarget — shielded taunting Tank hard-blocks the backline', () => {
  it('forces even a taunt-ignoring attacker onto the wall Tank over a squishy backliner', () => {
    const tank = u('tank', 'Tank', 'left', { livingWall: { reflect: 0.4 }, statusEffects: [shield(50)] })
    const squishy = u('squishy', 'Supporto', 'left')
    // ignoresTaunt (Bellatrix-style) would normally dive past a taunting Tank straight to the
    // backline Supporto — MURO VIVENTE must override that and force the wall anyway.
    const actor = u('bellatrix', 'Attaccante', 'right', { ignoresTaunt: true })
    const target = selectTarget(actor, [actor], [tank, squishy])
    expect(target?.wizard.id).toBe('tank')
  })

  it('shield breaks (absorbLeft 0) -> wall drops, normal targeting resumes', () => {
    const tank = u('tank', 'Tank', 'left', { livingWall: { reflect: 0.4 }, statusEffects: [shield(0)] })
    const squishy = u('squishy', 'Supporto', 'left')
    const actor = u('bellatrix', 'Attaccante', 'right', { ignoresTaunt: true })
    const target = selectTarget(actor, [actor], [tank, squishy])
    expect(target?.wizard.id).toBe('squishy')
  })

  it('Tank hard-controlled (stunned) -> wall drops even with an active shield', () => {
    const tank = u('tank', 'Tank', 'left', { livingWall: { reflect: 0.4 }, statusEffects: [shield(50), stun] })
    const squishy = u('squishy', 'Supporto', 'left')
    const actor = u('bellatrix', 'Attaccante', 'right', { ignoresTaunt: true })
    const target = selectTarget(actor, [actor], [tank, squishy])
    expect(target?.wizard.id).toBe('squishy')
  })

  it('never returns undefined when a wall exists (single-target edge case)', () => {
    const tank = u('tank', 'Tank', 'left', { livingWall: { reflect: 0.4 }, statusEffects: [shield(1)] })
    const actor = u('ctrl', 'Controllo', 'right')
    const target = selectTarget(actor, [actor], [tank])
    expect(target).toBeDefined()
    expect(target?.wizard.id).toBe('tank')
  })

  it('no friendly fire: a player actor never sees the wall (livingWall only ever set on left units)', () => {
    const tank = u('tank', 'Tank', 'left', { livingWall: { reflect: 0.4 }, statusEffects: [shield(50)] })
    const enemy = u('foe', 'Attaccante', 'right')
    const actor = u('att', 'Attaccante', 'left')
    // actor's `enemies` param is the right team here — none of which carry livingWall.
    const target = selectTarget(actor, [actor, tank], [enemy])
    expect(target?.wizard.id).toBe('foe')
  })
})
