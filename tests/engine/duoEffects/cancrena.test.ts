import { describe, it, expect } from 'vitest'
import { tickStatuses, applyStatus } from '@/game/engine/status'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import type { BattleUnit, DraftedWizard, ActiveDuo, Side } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Model on tests/engine/status.test.ts's `unit` helper.
function unit(side: Side, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 1000, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: side === 'left' ? 'p' : 'e', name: side, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [1000,1000], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 1000, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side, hp: 1000, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

const duo = (id: string): ActiveDuo => ({ duo: { id, name: '', desc: '', signals: ['veleno', 'magieOscure'] } })

describe('CANCRENA — double veleno tick on low-HP poisoned enemies', () => {
  it('an enemy at 30% maxHp (under threshold) loses 2x the normal veleno tick', () => {
    const enemy = unit('right', { hp: 300 }) // 30% of 1000
    stampDuoFields([], [enemy], [duo('cancrena')], 'normal')
    applyStatus(enemy, 'veleno')
    // base veleno tick @ 1 stack: flat 4 + pct 1*0.005*1000=5 -> 9; amplified x2 -> 18
    tickStatuses(1, enemy)
    expect(enemy.hp).toBe(300 - 18)
  })

  it('an enemy at 60% maxHp (at/above threshold) loses only the normal veleno tick', () => {
    const enemy = unit('right', { hp: 600 }) // 60% of 1000
    stampDuoFields([], [enemy], [duo('cancrena')], 'normal')
    applyStatus(enemy, 'veleno')
    tickStatuses(1, enemy)
    expect(enemy.hp).toBe(600 - 9)
  })

  it('friendly-fire guard: cancrena never stamps poisonAmp on player (left) units', () => {
    const player = unit('left', { hp: 300 })
    const enemy = unit('right', { hp: 300 })
    stampDuoFields([player], [enemy], [duo('cancrena')], 'normal')
    expect(player.poisonAmp).toBeUndefined()
    expect(enemy.poisonAmp).toEqual({ threshold: 0.4, mult: 2 })

    // Even if a left unit were poisoned and low-HP, it is unaffected (no poisonAmp stamped).
    applyStatus(player, 'veleno')
    tickStatuses(1, player)
    expect(player.hp).toBe(300 - 9) // normal tick, not amplified
  })

  it('no cancrena duo -> no poisonAmp, veleno ticks normally even under 40% HP', () => {
    const enemy = unit('right', { hp: 300 })
    stampDuoFields([], [enemy], [], 'normal')
    applyStatus(enemy, 'veleno')
    tickStatuses(1, enemy)
    expect(enemy.hp).toBe(300 - 9)
  })
})
