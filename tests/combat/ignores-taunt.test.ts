import { describe, it, expect } from 'vitest'
import { selectTarget } from '@/game/engine/combat/targeting'
import type { BattleUnit } from '@/types'

// Minimal BattleUnit fixture — mirrors the walledUnit() pattern used by
// tests/engine/velenoBypassesWall.test.ts. Only the fields selectTarget/threatScore
// actually read are populated.
function unit(opts: {
  id: string; role: string; atk: number; spd: number; hp?: number; ignoresTaunt?: boolean
}): BattleUnit {
  return {
    wizard: { id: opts.id, name: opts.id, role: opts.role },
    side: 'right', alive: true, hp: opts.hp ?? 100, maxHp: opts.hp ?? 100,
    cooldowns: {}, statusEffects: [],
    buffedStats: { hp: opts.hp ?? 100, atk: opts.atk, def: 0, spd: opts.spd },
    ignoresTaunt: opts.ignoresTaunt,
  } as unknown as BattleUnit
}

describe('ignoresTaunt — Bellatrix signature (skip the Tank taunt)', () => {
  // Tank has low raw atk/spd but the taunt bonus (+1000) dominates threatScore, so a
  // normal attacker targets the Tank even though a fragile backliner has much higher
  // real atk+spd.
  const tank = unit({ id: 'tank', role: 'Tank', atk: 5, spd: 5 })
  const backliner = unit({ id: 'backliner', role: 'Supporto', atk: 40, spd: 30, hp: 40 })
  const enemies = [tank, backliner]

  it('without the flag, an Attaccante targets the taunting Tank', () => {
    const attacker = unit({ id: 'attacker', role: 'Attaccante', atk: 20, spd: 20 })
    const target = selectTarget(attacker, [attacker], enemies)
    expect(target?.wizard.id).toBe('tank')
  })

  it('with ignoresTaunt, an Attaccante targets the higher-threat backliner instead', () => {
    const attacker = unit({ id: 'attacker', role: 'Attaccante', atk: 20, spd: 20, ignoresTaunt: true })
    const target = selectTarget(attacker, [attacker], enemies)
    expect(target?.wizard.id).toBe('backliner')
    expect(target?.wizard.role).not.toBe('Tank')
  })
})
