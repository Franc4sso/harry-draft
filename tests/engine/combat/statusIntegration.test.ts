import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { selectSpell } from '@/game/engine/combat/selectSpell'
import { canAct, canCastSpell } from '@/game/engine/status'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('status integration', () => {
  it('aegis shield absorbs a subsequent attack (no hp loss until shield depletes)', () => {
    const caster = unit('c', 'aegis')
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['aegis']!)
    expect(caster.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft).toBe(60)
    const attacker = unit('a', 'base_attack', { side: 'right', buffedStats: { hp: 120, atk: 20, def: 0, spd: 40 } })
    const hpBefore = caster.hp
    resolveAction(createRng(2), 2, attacker, caster, SPELL_BY_ID['flipendo']!)
    // small attack fully absorbed by 60-pt shield
    expect(caster.hp).toBe(hpBefore)
    expect((caster.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft ?? 0)).toBeLessThan(60)
  })
  it('glacius freezes: target cannot act', () => {
    const a = unit('a', 'glacius'); const b = unit('b', 'base_attack', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['glacius']!)
    expect(b.statusEffects.some(e => e.statusId === 'freeze')).toBe(true)
    expect(canAct(b)).toBe(false)
  })
  it('silencio silences: target falls back to base attack', () => {
    const a = unit('a', 'silencio'); const b = unit('b', 'sectumsempra', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['silencio']!)
    expect(canCastSpell(b)).toBe(false)
    expect(selectSpell(b).id).toBe('base_attack')
  })
})
