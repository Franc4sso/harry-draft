import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { applyStatus } from '@/game/engine/status'
import type { BattleUnit, DraftedWizard, LogFlag } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import type { Rng } from '@/game/engine/rng'

// Model on tests/engine/combat/effects.test.ts's `unit` helper.
function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 1000, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [1000,1000], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 1000, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 1000, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}
const noChance: Rng = { next: () => 0, int: () => 0, chance: () => false,
  pick: <T,>(a: readonly T[]) => a[0]!, shuffle: <T,>(a: readonly T[]) => [...a], fork: () => noChance }

describe('ESECUZIONE A FREDDO — finish a hard-controlled low-HP enemy (boss-guarded)', () => {
  it('non-boss (instakill:true): a stunned enemy under 50% HP is instakilled', () => {
    const actor = unit({ side: 'left', coldExecute: { threshold: 0.5, instakill: true } })
    const enemy = unit({ side: 'right', hp: 400, maxHp: 1000 }) // 40% HP
    applyStatus(enemy, 'stun')
    const flags: LogFlag[] = []
    EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor, target: enemy, flags }, { kind: 'damage', power: 1 })
    expect(enemy.hp).toBe(0)
  })

  it('boss battle (instakill:false): the same hit does bonus damage but does NOT instakill', () => {
    const actor = unit({ side: 'left', coldExecute: { threshold: 0.5, instakill: false } })
    // High enough HP that the bonus 25%-maxHp chunk plus the normal hit still leaves it alive.
    const enemy = unit({ side: 'right', hp: 400, maxHp: 1000 }) // 40% HP
    applyStatus(enemy, 'stun')
    const flags: LogFlag[] = []
    EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor, target: enemy, flags }, { kind: 'damage', power: 1 })
    expect(enemy.hp).toBeGreaterThan(0)
    // Bonus damage applied: exactly the plain hit PLUS a 25%-of-maxHp chunk (250 here).
    const plainActor = unit({ side: 'left' })
    const plainEnemy = unit({ side: 'right', hp: 400, maxHp: 1000 })
    applyStatus(plainEnemy, 'stun')
    EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor: plainActor, target: plainEnemy, flags: [] }, { kind: 'damage', power: 1 })
    expect(enemy.hp).toBe(Math.max(0, plainEnemy.hp - 250))
    expect(enemy.hp).toBeLessThan(plainEnemy.hp)
  })

  it('guard: a NON-controlled enemy under 50% HP is untouched by cold execute', () => {
    const actor = unit({ side: 'left', coldExecute: { threshold: 0.5, instakill: true } })
    const enemy = unit({ side: 'right', hp: 400, maxHp: 1000 }) // 40% HP, no stun
    EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor, target: enemy, flags: [] }, { kind: 'damage', power: 1 })
    expect(enemy.hp).toBeGreaterThan(0) // only the plain hit landed, no execute
  })

  it('guard: a controlled enemy at/above the threshold is untouched by cold execute', () => {
    const actor = unit({ side: 'left', coldExecute: { threshold: 0.5, instakill: true } })
    const enemy = unit({ side: 'right', hp: 600, maxHp: 1000 }) // 60% HP
    applyStatus(enemy, 'stun')
    EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor, target: enemy, flags: [] }, { kind: 'damage', power: 1 })
    expect(enemy.hp).toBeGreaterThan(0)
  })

  it('a frozen enemy under 50% HP is instakilled too, despite freeze-shatter clearing the ' +
     'freeze status on the very same hit', () => {
    const actor = unit({ side: 'left', coldExecute: { threshold: 0.5, instakill: true } })
    const enemy = unit({ side: 'right', hp: 400, maxHp: 1000 }) // 40% HP
    applyStatus(enemy, 'freeze')
    EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor, target: enemy, flags: [] }, { kind: 'damage', power: 1 })
    expect(enemy.hp).toBe(0)
  })

  it('friendly-fire guard: a player ally is never cold-executed', () => {
    const actor = unit({ side: 'left', coldExecute: { threshold: 0.5, instakill: true } })
    const ally = unit({ side: 'left', hp: 400, maxHp: 1000 }) // 40% HP, same side
    applyStatus(ally, 'stun')
    const r = EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor, target: ally, flags: [] }, { kind: 'damage', power: 1 })
    expect(r.value).toBe(0) // no-friendly-fire guard short-circuits the damage handler entirely
    expect(ally.hp).toBe(400)
  })
})
