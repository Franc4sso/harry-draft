import { describe, it, expect } from 'vitest'
import { canPay, applySacrificeCost, type SacrificeCost } from '@/game/engine/sacrifice'
import { createDraftPool } from '@/game/engine/draft'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { RELIC_BY_ID } from '@/data/relics'
import type { RunState } from '@/types'

function stateWith(teamSize: number, relicIds: string[] = []): RunState {
  const rng = createRng('sac-test')
  const pool = createDraftPool()
  const team = pool.slice(0, teamSize).map(w => draftWizard(rng, w, true))
  return {
    seed: 'sac-test', phase: 'map', team, activeSynergies: [], stage: 0,
    relics: relicIds.map(id => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })),
  }
}

describe('canPay', () => {
  it('wizard: richiede team >= 2 (mai sotto 1)', () => {
    const s2 = stateWith(2)
    expect(canPay(s2, { kind: 'wizard', wizardId: s2.team[0]!.wizard.id })).toBe(true)
    const s1 = stateWith(1)
    expect(canPay(s1, { kind: 'wizard', wizardId: s1.team[0]!.wizard.id })).toBe(false)
  })
  it('relic: richiede la reliquia posseduta', () => {
    expect(canPay(stateWith(2, ['giratempo']), { kind: 'relic', relicId: 'giratempo' })).toBe(true)
    expect(canPay(stateWith(2), { kind: 'relic', relicId: 'giratempo' })).toBe(false)
  })
  it('maxHp: floor 1 — rifiuta se scenderebbe a 0', () => {
    const s = stateWith(2)
    const id = s.team[0]!.wizard.id
    expect(canPay(s, { kind: 'maxHp', wizardId: id, amount: 30 })).toBe(true)
    expect(canPay(s, { kind: 'maxHp', wizardId: id, amount: 99999 })).toBe(false)
  })
  it('runModifier: sempre pagabile se non già attivo', () => {
    const s = stateWith(2)
    expect(canPay(s, { kind: 'runModifier', modifier: 'noRecruits' })).toBe(true)
    const signed = { ...s, runModifiers: { noRecruits: true as const } }
    expect(canPay(signed, { kind: 'runModifier', modifier: 'noRecruits' })).toBe(false)
  })
})

describe('applySacrificeCost', () => {
  it('wizard: rimuove il mago e ricalcola le sinergie', () => {
    const s = stateWith(3)
    const gone = s.team[0]!.wizard.id
    const out = applySacrificeCost(s, { kind: 'wizard', wizardId: gone })
    expect(out.team.map(d => d.wizard.id)).not.toContain(gone)
    expect(out.team).toHaveLength(2)
    expect(out.activeSynergies).toBeDefined()
  })
  it('relic: rimuove la reliquia', () => {
    const s = stateWith(2, ['giratempo'])
    const out = applySacrificeCost(s, { kind: 'relic', relicId: 'giratempo' })
    expect(out.relics).toHaveLength(0)
  })
  it('maxHp: taglia stats.hp E maxHp e clampa currentHp', () => {
    const s = stateWith(2)
    const dw = s.team[0]!
    const out = applySacrificeCost(s, { kind: 'maxHp', wizardId: dw.wizard.id, amount: 20 })
    const cut = out.team.find(d => d.wizard.id === dw.wizard.id)!
    expect(cut.maxHp).toBe(dw.maxHp - 20)
    expect(cut.stats.hp).toBe(dw.stats.hp - 20)
    expect(cut.currentHp ?? cut.maxHp).toBeLessThanOrEqual(cut.maxHp)
  })
  it('maxHp: un mago già morto (currentHp 0) resta morto, non rianima a 1', () => {
    const s = stateWith(2)
    const dw = s.team[0]!
    const dead = { ...dw, currentHp: 0 }
    const s2 = { ...s, team: [dead, ...s.team.slice(1)] }
    const out = applySacrificeCost(s2, { kind: 'maxHp', wizardId: dw.wizard.id, amount: 20 })
    const cut = out.team.find(d => d.wizard.id === dw.wizard.id)!
    expect(cut.currentHp).toBe(0)
    expect(cut.maxHp).toBe(dw.maxHp - 20)
    expect(cut.stats.hp).toBe(dw.stats.hp - 20)
  })
  it('runModifier: setta il flag', () => {
    const out = applySacrificeCost(stateWith(2), { kind: 'runModifier', modifier: 'noRecruits' })
    expect(out.runModifiers?.noRecruits).toBe(true)
  })
  it('costo invalido: no-op reference-equal (convenzione resolver)', () => {
    const s = stateWith(1)
    expect(applySacrificeCost(s, { kind: 'wizard', wizardId: s.team[0]!.wizard.id })).toBe(s)
    expect(applySacrificeCost(s, { kind: 'relic', relicId: 'giratempo' })).toBe(s)
  })
})
