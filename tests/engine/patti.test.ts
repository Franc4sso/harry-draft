import { describe, it, expect } from 'vitest'
import { applyEventEffects } from '@/game/engine/events'
import { startRunB, starterOffer, chooseStarters } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { recruitResolver, recruitOffer } from '@/game/engine/resolvers/recruit'
import { EVENT_BY_ID } from '@/data/events'
import type { EventEffect } from '@/data/events'
import type { RunNode, RunState } from '@/types'

/** Build a realistic RunState with a 3-wizard team via the real house/starter flow
 *  (mirrors eventEffects.test.ts / campaignBalanceRestricted.test.ts / useRunB.test.ts). */
function buildState(seed = 'patti-test'): RunState {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Grifondoro')
  const starterIds = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 3).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starterIds, createRng(seed))
  return s
}

describe('EventEffect nuovi', () => {
  it('sacrificeCost delega al backbone (wizard rimosso)', () => {
    const s = buildState()
    const gone = s.team[0]!.wizard.id
    const effects: EventEffect[] = [{ kind: 'sacrificeCost', cost: { kind: 'wizard', wizardId: gone } }]
    const r = applyEventEffects(s, effects, createRng('sac'))
    expect(r.state.team.map(d => d.wizard.id)).not.toContain(gone)
    expect(r.state.team.length).toBe(s.team.length - 1)
    expect(r.log.some(l => l.includes('sacrificeCost'))).toBe(true)
  })

  it('sacrificeCost non pagabile: no-op e log UNPAYABLE', () => {
    const s = buildState()
    // team ha 3 membri: rimuovi finché ne resta 1, poi il costo wizard diventa non pagabile (team < 2)
    const onlyOne = { ...s, team: [s.team[0]!] }
    const effects: EventEffect[] = [{ kind: 'sacrificeCost', cost: { kind: 'wizard', wizardId: onlyOne.team[0]!.wizard.id } }]
    const r = applyEventEffects(onlyOne, effects, createRng('sac2'))
    expect(r.state.team).toEqual(onlyOne.team)
    expect(r.log.some(l => l.includes('UNPAYABLE'))).toBe(true)
  })

  it('setRunModifier: noRecruits settato', () => {
    const s = buildState()
    const effects: EventEffect[] = [{ kind: 'setRunModifier', modifier: 'noRecruits' }]
    const r = applyEventEffects(s, effects, createRng('rm'))
    expect(r.state.runModifiers?.noRecruits).toBe(true)
  })

  it('buffTeamPct: stats e maxHp scalati (+20% -> round), currentHp assoluto invariato', () => {
    // Pin an explicit, arbitrary currentHp per member so we can assert buffTeamPct doesn't
    // touch it (unlike healTeam/damageTeam, which scale currentHp relative to maxHp).
    const seeded = { ...buildState(), team: buildState().team.map(dw => ({ ...dw, currentHp: 7 })) }
    const before = seeded.team.map(dw => ({ id: dw.wizard.id, stats: { ...dw.stats }, maxHp: dw.maxHp, currentHp: dw.currentHp! }))
    const effects: EventEffect[] = [{ kind: 'buffTeamPct', pct: 0.20 }]
    const r = applyEventEffects(seeded, effects, createRng('buff'))
    expect(r.state.team.length).toBe(seeded.team.length)
    for (const dw of r.state.team) {
      const prev = before.find(b => b.id === dw.wizard.id)!
      expect(dw.stats.hp).toBe(Math.round(prev.stats.hp * 1.2))
      expect(dw.stats.atk).toBe(Math.round(prev.stats.atk * 1.2))
      expect(dw.stats.def).toBe(Math.round(prev.stats.def * 1.2))
      expect(dw.stats.spd).toBe(Math.round(prev.stats.spd * 1.2))
      expect(dw.maxHp).toBe(Math.round(prev.maxHp * 1.2))
      // currentHp is an absolute value, untouched by the pct scaling.
      expect(dw.currentHp).toBe(prev.currentHp)
    }
  })
})

describe('noRecruits gate', () => {
  it("recruitResolver.resolve è no-op reference-equal con noRecruits", () => {
    let s = buildState()
    s = { ...s, runModifiers: { noRecruits: true } }
    const node: RunNode = { id: 'a0f1n0', type: 'recruit', next: [] }
    const offer = recruitOffer(s, node, createRng('seed'))
    const choice = { kind: 'recruit-pick' as const, wizardId: offer[0]!.wizard.id }
    const out = recruitResolver.resolve(s, node, choice, createRng('seed'))
    expect(out).toBe(s)
  })

  it('addWizard evento è no-op con noRecruits', () => {
    let s = buildState()
    s = { ...s, runModifiers: { noRecruits: true } }
    const teamBefore = s.team
    const effects: EventEffect[] = [{ kind: 'addWizard', levelsAboveWeakest: 2 }]
    const r = applyEventEffects(s, effects, createRng('add'))
    expect(r.state.team).toBe(teamBefore)
    expect(r.log.some(l => l.includes('blocked (noRecruits)'))).toBe(true)
  })
})

describe('Voto Infrangibile (integrazione)', () => {
  it("scegliendo 'giura': +20% stats a tutti, noRecruits attivo, e il recruit successivo fallisce", () => {
    const s = buildState()
    const event = EVENT_BY_ID['voto_infrangibile']!
    const choice = event.choices.find(c => c.id === 'giura')!
    const before = s.team.map(dw => ({ id: dw.wizard.id, hp: dw.stats.hp }))

    const r = applyEventEffects(s, choice.effects, createRng('voto'))
    expect(r.state.runModifiers?.noRecruits).toBe(true)
    for (const dw of r.state.team) {
      const prev = before.find(b => b.id === dw.wizard.id)!
      expect(dw.stats.hp).toBe(Math.round(prev.hp * 1.2))
    }

    // A subsequent recruit attempt against this state must be a no-op.
    const node: RunNode = { id: 'a0f1n0', type: 'recruit', next: [] }
    const offer = recruitOffer(r.state, node, createRng('seed'))
    const recruitChoice = { kind: 'recruit-pick' as const, wizardId: offer[0]!.wizard.id }
    const afterRecruit = recruitResolver.resolve(r.state, node, recruitChoice, createRng('seed'))
    expect(afterRecruit).toBe(r.state)
  })
})
