import { describe, it, expect } from 'vitest'
import type { DraftedWizard, RunNode, RunState } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import {
  spellMultiplier, scaledSpell, baseSpellOf, upgradeWizardSpell,
  SPELL_LEVEL_STEP, SPELL_LEVEL_MAX,
} from '@/game/engine/spellForge'
import { spellForgeResolver } from '@/game/engine/resolvers/spellForge'
import { setWizardSpell } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'

const ATK = 'expelliarmus' // power 1.4 attack spell
const ALT = 'base_attack'  // power 1 attack spell (both in the crafted pool below)

function dw(spellId: string, level?: number): DraftedWizard {
  return {
    wizard: { id: 'w1', name: 'Test', house: 'Grifondoro', role: 'Attaccante', spellPool: [spellId, ALT, ATK] } as never,
    stats: { hp: 100, atk: 50, def: 10, spd: 10 },
    maxHp: 100,
    spell: SPELL_BY_ID[spellId]!,
    ...(level ? { spellLevel: level } : {}),
  }
}

describe('spellForge — scaling math', () => {
  it('multiplier is 1 at level 1 and grows by the step, clamped at the cap', () => {
    expect(spellMultiplier(1)).toBe(1)
    expect(spellMultiplier(undefined)).toBe(1)
    expect(spellMultiplier(2)).toBeCloseTo(1 + SPELL_LEVEL_STEP)
    expect(spellMultiplier(SPELL_LEVEL_MAX)).toBeCloseTo(1 + SPELL_LEVEL_STEP * (SPELL_LEVEL_MAX - 1))
    expect(spellMultiplier(999)).toBe(spellMultiplier(SPELL_LEVEL_MAX)) // clamped
  })

  it('scaledSpell raises power without mutating the shared catalog entry', () => {
    const base = SPELL_BY_ID[ATK]!
    const before = base.power
    const scaled = scaledSpell(base, 3)
    expect(scaled.power).toBeCloseTo(base.power! * spellMultiplier(3))
    expect(scaled.id).toBe(base.id)
    expect(SPELL_BY_ID[ATK]!.power).toBe(before) // catalog untouched
  })

  it('scales inline effect magnitudes (DoT / debuff) but leaves durations alone', () => {
    const incendio = SPELL_BY_ID['incendio']! // dot amount 8, duration 2
    const dot0 = incendio.effects!.find(e => e.kind === 'dot')!
    const scaled = scaledSpell(incendio, 2)
    const dot = scaled.effects!.find(e => e.kind === 'dot')!
    expect(dot.amount).toBe(Math.round(dot0.amount! * spellMultiplier(2)))
    expect(dot.duration).toBe(dot0.duration) // duration untouched
    expect(incendio.effects!.find(e => e.kind === 'dot')!.amount).toBe(dot0.amount) // catalog untouched
  })

  it('re-scaling from the catalog base never compounds', () => {
    const base = SPELL_BY_ID[ATK]!
    const lvl3 = scaledSpell(base, 3)
    const reBase = baseSpellOf(lvl3)       // id preserved → resolves back to catalog base
    const lvl3again = scaledSpell(reBase, 3)
    expect(lvl3again.power).toBe(lvl3.power)
    expect(reBase.power).toBe(base.power)
  })
})

describe('spellForge — upgradeWizardSpell', () => {
  it('raises the magic level and boosts the equipped spell power', () => {
    const up = upgradeWizardSpell(dw(ATK))
    expect(up.spellLevel).toBe(2)
    expect(up.spell.power).toBeCloseTo(SPELL_BY_ID[ATK]!.power! * spellMultiplier(2))
  })

  it('is a no-op at the level cap', () => {
    const maxed = dw(ATK, SPELL_LEVEL_MAX)
    expect(upgradeWizardSpell(maxed)).toBe(maxed)
  })
})

describe('spellForge — resolver', () => {
  const node: RunNode = { id: 'a0f1n0', type: 'spellForge', next: [] }
  const state = (team: DraftedWizard[]): RunState => ({
    seed: 's', phase: 'spellForge-node', team, activeSynergies: [], stage: 0, relics: [],
    area: 0, teamMax: 5, log: [],
  })

  it('upgrades the picked wizard and logs a spellForge event', () => {
    const out = spellForgeResolver.resolve(state([dw(ATK)]), node, { kind: 'spell-upgrade', wizardId: 'w1' }, createRng('s'))
    expect(out.team[0]!.spellLevel).toBe(2)
    expect(out.log?.at(-1)?.kind).toBe('spellForge')
  })

  it('leaves a maxed wizard untouched', () => {
    const s = state([dw(ATK, SPELL_LEVEL_MAX)])
    const out = spellForgeResolver.resolve(s, node, { kind: 'spell-upgrade', wizardId: 'w1' }, createRng('s'))
    expect(out.team[0]!.spellLevel).toBe(SPELL_LEVEL_MAX)
    expect(out).toBe(s) // no-op returns the same state
  })
})

describe('spellForge — mastery carries across spell swaps', () => {
  it('setWizardSpell applies the wizard spellLevel to the newly equipped spell', () => {
    const upgraded = upgradeWizardSpell(dw(ATK)) // spellLevel 2, equips ATK
    const s: RunState = {
      seed: 's', phase: 'map', team: [upgraded], activeSynergies: [], stage: 0, relics: [],
      area: 0, teamMax: 5, log: [],
    }
    const next = setWizardSpell(s, 'w1', ALT)
    expect(next.team[0]!.spell.id).toBe(ALT)
    expect(next.team[0]!.spell.power).toBeCloseTo(SPELL_BY_ID[ALT]!.power! * spellMultiplier(2))
  })
})
