import { describe, it, expect } from 'vitest'
import { trioEffects } from '@/game/engine/trios'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { resolveAction } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveDuo, BattleUnit, DraftedWizard, Wizard } from '@/types'

function dw(id: string, house: Wizard['house']): DraftedWizard {
  const wizard = { id, name: id, house, role: 'Attaccante', tags: [] } as unknown as Wizard
  return { wizard, stats: { hp: 100, atk: 10, def: 10, spd: 10 }, maxHp: 100, spell: {} as any }
}
const duo: ActiveDuo = { duo: { id: 'cancrena' } as any }

function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw2: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120, 120], atk: [80, 80], def: [30, 30], spd: [40, 40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw2, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('trioEffects', () => {
  it('no Duo active → empty map even with 3 same-house', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde')]
    expect(trioEffects(team, [])).toEqual({})
  })

  it('≥1 Duo + 3 same-house → those 3 get the house Trio', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde'), dw('d', 'Grifondoro')]
    const map = trioEffects(team, [duo])
    expect(map['a']?.firstStrike?.bonus).toBe(0.30)
    expect(map['d']).toBeUndefined() // only 1 Grifondoro
  })

  it('4 same-house → boosted grade (Serpeverde 0.45)', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde'), dw('d', 'Serpeverde')]
    expect(trioEffects(team, [duo])['a']?.firstStrike?.bonus).toBe(0.45)
  })

  it('Tassorosso/Grifondoro boolean grade (3 == 4)', () => {
    const three = [dw('a', 'Tassorosso'), dw('b', 'Tassorosso'), dw('c', 'Tassorosso')]
    const four = [...three, dw('d', 'Tassorosso')]
    expect(trioEffects(three, [duo])['a']?.statusDurationBonus).toBe(1)
    expect(trioEffects(four, [duo])['a']?.statusDurationBonus).toBe(1)
  })

  it('Corvonero grade: 3 → expose1, 4 → expose2', () => {
    const three = [dw('a', 'Corvonero'), dw('b', 'Corvonero'), dw('c', 'Corvonero')]
    const four = [...three, dw('d', 'Corvonero')]
    expect(trioEffects(three, [duo])['a']?.analysis?.exposeId).toBe('expose1')
    expect(trioEffects(four, [duo])['a']?.analysis?.exposeId).toBe('expose2')
  })

  it('stamps Trio on player units only, gated by duos', () => {
    const team = [dw('a', 'Grifondoro'), dw('b', 'Grifondoro'), dw('c', 'Grifondoro')]
    const withDuo = toBattleUnits(team, 'left', [], [], 0, 0, false, [duo])
    expect(withDuo[0]!.cooldownReduction).toBe(1)
    const noDuo = toBattleUnits(team, 'left', [], [], 0, 0, false, [])
    expect(noDuo[0]!.cooldownReduction).toBeUndefined()
    const enemy = toBattleUnits(team, 'right', [], [], 0, 0, false) // no duos passed for right
    expect(enemy[0]!.cooldownReduction).toBeUndefined()
  })

  it('Grifondoro cooldownReduction lowers set cooldown (min 1)', () => {
    const spellId = 'avada' // cooldown 2 in data/spells
    const spell = SPELL_BY_ID[spellId]!
    expect(spell.cooldown).toBe(2)
    const actor = unit('a', spellId, { cooldownReduction: 1 })
    const target = unit('b', 'base_attack', { side: 'right' })
    resolveAction(createRng(1), 1, actor, target, spell)
    expect(actor.cooldowns[spellId]).toBe(1) // max(1, 2-1)
  })

  it('Grifondoro cooldownReduction floors at 1, never 0', () => {
    const spellId = 'sectumsempra' // cooldown 1 in data/spells
    const spell = SPELL_BY_ID[spellId]!
    expect(spell.cooldown).toBe(1)
    const actor = unit('a', spellId, { cooldownReduction: 1 })
    const target = unit('b', 'base_attack', { side: 'right' })
    resolveAction(createRng(1), 1, actor, target, spell)
    expect(actor.cooldowns[spellId]).toBe(1) // max(1, 1-1) clamps to 1, not 0
  })

  it('Serpeverde firstStrike amplifies the hit on a full-HP enemy, not a wounded one', () => {
    const mkTarget = (hp: number) => unit('b', 'base_attack', { side: 'right', hp, maxHp: 120 })
    const actorFS = unit('a', 'base_attack', { firstStrike: { bonus: 0.30 } })

    const full = mkTarget(120)
    resolveAction(createRng(2), 1, actorFS, full, SPELL_BY_ID['base_attack']!)
    const dmgFull = 120 - full.hp

    const wounded = mkTarget(119) // not full → no firstStrike
    resolveAction(createRng(2), 1, actorFS, wounded, SPELL_BY_ID['base_attack']!)
    const dmgWounded = 119 - wounded.hp

    expect(dmgFull).toBeGreaterThan(dmgWounded)
  })

  it('wounded target gets no firstStrike bonus (matches a no-firstStrike actor on same wounded target)', () => {
    const mkTarget = (hp: number) => unit('b', 'base_attack', { side: 'right', hp, maxHp: 120 })
    const actorFS = unit('a', 'base_attack', { firstStrike: { bonus: 0.30 } })
    const actorPlain = unit('a', 'base_attack')

    const woundedFS = mkTarget(119)
    resolveAction(createRng(2), 1, actorFS, woundedFS, SPELL_BY_ID['base_attack']!)
    const dmgFS = 119 - woundedFS.hp

    const woundedPlain = mkTarget(119)
    resolveAction(createRng(2), 1, actorPlain, woundedPlain, SPELL_BY_ID['base_attack']!)
    const dmgPlain = 119 - woundedPlain.hp

    expect(dmgFS).toBe(dmgPlain)
  })
})
