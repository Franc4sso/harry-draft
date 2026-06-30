import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID } from '@/data/traits'
import { applyInlineEffect, effectiveStats } from '@/game/engine/status'
import type { BattleUnit, HookCtx, EffectSpec } from '@/types'

/** The applyStatus variant of EffectSpec — the only kind these traits emit. */
type ApplyStatusSpec = Extract<EffectSpec, { kind: 'applyStatus' }>
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const STUB_SPELL = { id: 'stub', name: 'Stub', desc: '', type: 'Attacco' as const, hitChance: 1 }

function u(hp = 100, maxHp = 100): BattleUnit {
  const stats = { hp: 100, atk: 30, def: 20, spd: 25 }
  return { wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
    gender: 'm' as const, ranges: { hp: [100,100], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: [] },
    stats, maxHp, hp, spell: STUB_SPELL, side: 'left', cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true } as BattleUnit
}

const ctx = (): HookCtx => ({ turn: 1, actor: u(), target: u(), side: 'left', flags: [] })

/** Pull the EffectSpec list off a reactive trait, asserting it is reactive. */
function reactiveEffects(id: string): EffectSpec[] {
  const t = TRAIT_BY_ID[id]!.trigger
  if (t.kind !== 'reactive') throw new Error(`${id} expected reactive`)
  return t.effects(ctx())
}

/** First effect of a reactive trait, narrowed to applyStatus (the only kind
 *  these traits emit). Throws if the trait emits nothing or a different kind,
 *  so the cast is guarded rather than blind. */
function firstApplyStatus(id: string): ApplyStatusSpec {
  const eff = reactiveEffects(id)[0]
  if (!eff || eff.kind !== 'applyStatus') throw new Error(`${id} expected an applyStatus effect`)
  return eff
}

describe('Phase 3 control-on-hit traits', () => {
  it('Pietrificazione applies a chance-gated stun to the enemy on hit', () => {
    const t = TRAIT_BY_ID['pietrificazione']!.trigger
    expect(t.kind).toBe('reactive')
    if (t.kind !== 'reactive') return
    expect(t.hook).toBe('onHit')
    expect(t.owner).toBe('actor')
    const eff = firstApplyStatus('pietrificazione')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'stun' })
    expect(eff.chance).toBeGreaterThan(0)
    expect(eff.chance).toBeLessThan(0.5)
  })

  it('Bavaglio applies a chance-gated silence to the enemy on hit', () => {
    const eff = firstApplyStatus('bavaglio')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'silence' })
    expect(eff.chance).toBeGreaterThan(0)
  })

  it('Disarmo applies a chance-gated disarm to the enemy on hit', () => {
    const eff = firstApplyStatus('disarmo')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'disarm' })
    expect(eff.chance).toBeGreaterThan(0)
  })
})

describe('Phase 3 dot + slow traits', () => {
  // The 'veleno' trait was removed in the "Veleno from attacks" slice (poison now
  // comes from venom spells + the Tossicità synergy's on-hit chance, not a trait);
  // its on-hit-burn test case was deleted with it. See game/engine/synergyTriggers.ts.

  it('Logoramento applies weaken2 (atk debuff) to the enemy on hit', () => {
    const eff = firstApplyStatus('logoramento')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'weaken2' })
    expect(eff.chance).toBeGreaterThan(0.18)
  })
})

describe('Phase 3 self-buff-on-hit trait', () => {
  it('Ferocia buffs the ACTOR (self) on hit, not the enemy', () => {
    const eff = firstApplyStatus('ferocia')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'self', statusId: 'atkUp' })
  })
})

describe('Phase 3 turn-start self traits', () => {
  it('Rigenerazione grants the actor regen at turn start', () => {
    const eff = firstApplyStatus('rigenerazione')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'self', statusId: 'regen' })
    const t = TRAIT_BY_ID['rigenerazione']!.trigger
    if (t.kind === 'reactive') expect(t.hook).toBe('onTurnStart')
  })

  it('Anticipo grants the actor a spd buff at turn start', () => {
    const eff = firstApplyStatus('anticipo')
    expect(eff.target).toBe('self')
    expect(eff.effect).toMatchObject({ kind: 'buff', stat: 'spd' })
  })
})

describe('Phase 3 conditional self-buff traits', () => {
  it('Crescendo buffs the actor atk at turn start', () => {
    const eff = firstApplyStatus('crescendo')
    expect(eff.target).toBe('self')
    expect(eff.effect).toMatchObject({ kind: 'buff', stat: 'atk' })
    const t = TRAIT_BY_ID['crescendo']!.trigger
    if (t.kind === 'reactive') expect(t.hook).toBe('onTurnStart')
  })

  it('Vendetta buffs the actor atk when an ally dies', () => {
    const eff = firstApplyStatus('vendetta')
    expect(eff.target).toBe('self')
    expect(eff.effect).toMatchObject({ kind: 'buff', stat: 'atk' })
    const t = TRAIT_BY_ID['vendetta']!.trigger
    if (t.kind === 'reactive') expect(t.hook).toBe('onAllyDeath')
  })

  it('Crescendo stacks: applying it twice raises effective atk more than once', () => {
    const unit = u()
    const inlineEff = { kind: 'buff' as const, stat: 'atk' as const, amount: 6, duration: 3 }
    applyInlineEffect(unit, inlineEff)
    const atkAfter1 = effectiveStats(unit).atk
    applyInlineEffect(unit, inlineEff)
    const atkAfter2 = effectiveStats(unit).atk
    expect(atkAfter2).toBeGreaterThan(atkAfter1)
  })
})

describe('Phase 3 traits fire in real battle on both sides', () => {
  it('Logoramento on a RIGHT-side unit weakens (-ATT) the LEFT player it hits', () => {
    const harry = draftWizard(createRng(1), WIZARDS.find(w => w.id === 'harry')!)
    const enemyBase = WIZARDS.find(w => w.id === 'bellatrix')!
    // Inject the trait via shiny — combat engine now reads u.shiny?.traitId (game/engine/traits.ts).
    const enemy = { ...draftWizard(createRng(2), enemyBase), shiny: { traitId: 'logoramento' } }
    // Seeds [4,5,6,7,8] tried; at least one lets the enemy land 2+ hits on Harry
    // triggering Logoramento's weaken2. Widened to [1..15] if needed.
    const weakened = [4, 5, 6, 7, 8].some(seed => {
      const res = simulateBattle([harry], [enemy], createRng(seed))
      return res.snapshots.some(s =>
        Object.values(s).some(unit =>
          unit.statusEffects.some(e =>
            e.statusId === 'weaken2')))
    })
    expect(weakened).toBe(true)
  })
})
