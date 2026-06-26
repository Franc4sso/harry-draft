import { describe, it, expect } from 'vitest'
import { selectSpell } from '@/game/engine/combat/selectSpell'
import { selectTarget } from '@/game/engine/combat/targeting'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { canCastSpell } from '@/game/engine/status'

function unit(over: Partial<BattleUnit> & { id: string; role: BattleUnit['wizard']['role'] }): BattleUnit {
  const { id, role, ...rest } = over
  const stats = { hp: 100, atk: 50, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role, tier: 3,
      gender: 'm' as const, ranges: { hp: [100, 100], atk: [50, 50], def: [30, 30], spd: [40, 40] }, spellPool: ['base_attack'] },
    stats, maxHp: 100, spell: SPELL_BY_ID['expelliarmus']!,
  }
  return { ...dw, side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...rest }
}

describe('combat selection', () => {
  it('uses base attack when spell on cooldown', () => {
    const u = unit({ id: 'a', role: 'Attaccante', cooldowns: { expelliarmus: 2 } })
    expect(selectSpell(u).id).toBe('base_attack')
  })
  it('uses the wizard spell when ready', () => {
    const u = unit({ id: 'a', role: 'Attaccante' })
    expect(selectSpell(u).id).toBe('expelliarmus')
  })
  it('attacker targets enemy tank first', () => {
    const actor = unit({ id: 'atk', role: 'Attaccante' })
    const tank = unit({ id: 'tank', role: 'Tank', side: 'right', hp: 200, buffedStats: { hp: 200, atk: 20, def: 80, spd: 20 } })
    const squishy = unit({ id: 'sq', role: 'Attaccante', side: 'right', hp: 50 })
    const t = selectTarget(actor, [actor], [tank, squishy])
    expect(t?.wizard.id).toBe('tank')
  })
  it('attacker targets highest threat when no tank', () => {
    const actor = unit({ id: 'atk', role: 'Attaccante' })
    // scary has higher atk+spd than weak — highestThreat picks scary
    const scary = unit({ id: 'scary', role: 'Attaccante', side: 'right', buffedStats: { hp: 100, atk: 70, def: 30, spd: 60 } })
    const weak = unit({ id: 'weak', role: 'Controllo', side: 'right', buffedStats: { hp: 100, atk: 20, def: 30, spd: 20 } })
    expect(selectTarget(actor, [actor], [scary, weak])?.wizard.id).toBe('scary')
  })
  it('support targets most wounded ally', () => {
    const actor = unit({ id: 'sup', role: 'Supporto' })
    const hurt = unit({ id: 'hurt', role: 'Tank', hp: 20, maxHp: 100 })
    const fine = unit({ id: 'fine', role: 'Attaccante', hp: 95, maxHp: 100 })
    const enemy = unit({ id: 'e', role: 'Attaccante', side: 'right' })
    expect(selectTarget(actor, [actor, hurt, fine], [enemy])?.wizard.id).toBe('hurt')
  })
})

describe('silence fallback', () => {
  it('silenced unit selects base attack instead of its spell', () => {
    // build a unit whose spell is a non-attack spell, then silence it — role is irrelevant here
    const u = unit({
      id: 's', role: 'Attaccante',
      spell: SPELL_BY_ID['vulnera']!,
      statusEffects: [{ kind: 'silence' as const, statusId: 'silence', remaining: 2 }],
    })
    expect(canCastSpell(u)).toBe(false)
    expect(selectSpell(u).id).toBe('base_attack')
  })
})
