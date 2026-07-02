import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { effectiveStats, tickStatuses } from '@/game/engine/status'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { STATUS_BY_ID } from '@/data/statuses'

// Harness copied from tests/combat/spell-impact.test.ts.
function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('CHANGE A: self-buff spells reroute to capped statuses', () => {
  it('riddikulus applied 5x caps atk gain at maxStacks (3), not infinite', () => {
    const caster = unit('c', 'riddikulus')
    for (let i = 0; i < 5; i++) {
      resolveAction(createRng(i + 1), i + 1, caster, caster, SPELL_BY_ID['riddikulus']!)
    }
    const atkUps = caster.statusEffects.filter(e => e.statusId === 'atkUp')
    expect(atkUps.length).toBeLessThanOrEqual(3)
    // atk must be bounded: base 80 + at most 3 stacks * 20 = 140
    expect(effectiveStats(caster).atk).toBeLessThanOrEqual(140)
    expect(effectiveStats(caster).atk).toBeGreaterThan(80)
  })

  it('riddikulus no longer pushes uncapped inline buff effects', () => {
    const caster = unit('c', 'riddikulus')
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['riddikulus']!)
    const inlineBuffs = caster.statusEffects.filter(e => e.kind === 'buff' && !e.statusId)
    expect(inlineBuffs).toHaveLength(0)
    expect(caster.statusEffects.some(e => e.statusId === 'atkUp')).toBe(true)
  })

  it('salvio reroutes to capped spdUp status', () => {
    const caster = unit('c', 'salvio')
    for (let i = 0; i < 5; i++) resolveAction(createRng(i + 1), i + 1, caster, caster, SPELL_BY_ID['salvio']!)
    const spdUps = caster.statusEffects.filter(e => e.statusId === 'spdUp')
    expect(spdUps.length).toBeLessThanOrEqual(3)
  })

  it('expecto reroutes both def and spd riders to capped statuses', () => {
    const caster = unit('c', 'expecto')
    for (let i = 0; i < 5; i++) resolveAction(createRng(i + 1), i + 1, caster, caster, SPELL_BY_ID['expecto']!)
    expect(caster.statusEffects.filter(e => e.statusId === 'defUp').length).toBeLessThanOrEqual(3)
    expect(caster.statusEffects.filter(e => e.statusId === 'spdUp').length).toBeLessThanOrEqual(3)
  })

  it('ferula keeps its heal but reroutes the def rider to a capped status', () => {
    const caster = unit('c', 'ferula', { hp: 80 })
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['ferula']!)
    expect(caster.hp).toBeGreaterThan(80) // heal still applies
    expect(caster.statusEffects.some(e => e.statusId === 'defUp')).toBe(true)
    expect(caster.statusEffects.some(e => e.kind === 'buff' && !e.statusId)).toBe(false)
  })

  it('fianto keeps its shield and reroutes the def rider to a capped status', () => {
    const caster = unit('c', 'fianto')
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['fianto']!)
    expect(caster.statusEffects.some(e => e.statusId === 'shield')).toBe(true)
    expect(caster.statusEffects.some(e => e.statusId === 'defUp')).toBe(true)
  })

  it('spdUp StatusDef exists, mirrors atkUp/defUp shape (maxStacks 3, buff kind, stack policy)', () => {
    const def = STATUS_BY_ID['spdUp']
    expect(def).toBeDefined()
    expect(def!.kind).toBe('buff')
    expect(def!.stack).toBe('stack')
    expect(def!.maxStacks).toBe(3)
    expect(def!.statMod?.stat).toBe('spd')
  })
})

describe('CHANGE B: ally/team buff spell', () => {
  it('applies the buff to an ALLY, not the caster', () => {
    const caster = unit('c', 'colletivo_scudo', { side: 'left' })
    const ally = unit('a', 'base_attack', { side: 'left', hp: 60 }) // wounded, likely ally-selection target
    const spell = SPELL_BY_ID['colletivo_scudo']
    expect(spell).toBeDefined()
    resolveAction(createRng(1), 1, caster, ally, spell!, [caster, ally])
    const casterBuffed = caster.statusEffects.some(e => e.statusId?.endsWith('Up'))
    const allyBuffed = ally.statusEffects.some(e => e.statusId?.endsWith('Up'))
    expect(allyBuffed).toBe(true)
    expect(casterBuffed).toBe(false)
  })

  it('the ally buff caps at maxStacks 3 across repeated casts', () => {
    const caster = unit('c', 'colletivo_scudo', { side: 'left' })
    const ally = unit('a', 'base_attack', { side: 'left' })
    const spell = SPELL_BY_ID['colletivo_scudo']!
    for (let i = 0; i < 6; i++) resolveAction(createRng(i + 1), i + 1, caster, ally, spell, [caster, ally])
    const buffs = ally.statusEffects.filter(e => e.statusId?.endsWith('Up'))
    expect(buffs.length).toBeLessThanOrEqual(3)
  })
})

describe('CHANGE C: protego nerf (cooldown/duration)', () => {
  it('protego spell cooldown is now 2', () => {
    expect(SPELL_BY_ID['protego']!.cooldown).toBe(2)
  })

  it('protego_maxima spell cooldown is now 3', () => {
    expect(SPELL_BY_ID['protego_maxima']!.cooldown).toBe(3)
  })

  it('protego ward status defaultDuration is now 1 and expires after 1 unused turn', () => {
    expect(STATUS_BY_ID['protego']!.defaultDuration).toBe(1)
    const caster = unit('c', 'protego')
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['protego']!, [caster])
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(true)
    // simulate one end-of-turn tick with no incoming spell to consume the ward
    tickStatuses(1, caster)
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(false)
  })
})
