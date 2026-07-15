import { describe, it, expect } from 'vitest'
import { infirmaryResolver } from '@/game/engine/resolvers/infirmary'
import { shopResolver } from '@/game/engine/resolvers/shop'
import { applyEventEffects } from '@/game/engine/events'
import { clearAreaAndAdvance, useConsumableRelic } from '@/game/engine/runEngine'
import { createDraftPool } from '@/game/engine/draft'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { RELIC_BY_ID } from '@/data/relics'
import type { RunNode, RunState } from '@/types'

/** RunState with a corrupted-and-wounded first member, a healthy second member.
 *  Mirrors tests/engine/sacrifice.test.ts's stateWith builder. */
function stateWith(teamSize: number): RunState {
  const rng = createRng('corr-test')
  const pool = createDraftPool()
  const team = pool.slice(0, teamSize).map(w => draftWizard(rng, w, true))
  const [first, ...rest] = team
  const corrupted = { ...first!, corrotto: true as const, currentHp: 10 }
  return {
    seed: 'corr-test', phase: 'map', team: [corrupted, ...rest], activeSynergies: [], stage: 0,
    relics: [],
  }
}

describe('Corrotto fuori battaglia', () => {
  it('Infermeria non cura il corrotto (gli altri sì)', () => {
    const s = stateWith(3)
    const node: RunNode = { id: 'inf-0', type: 'infirmary', next: [] }
    const out = infirmaryResolver.resolve(s, node, { kind: 'combat-ack' }, createRng('x'))
    const corrotto = out.team.find(d => d.corrotto)!
    expect(corrotto.currentHp).toBe(10)
    for (const d of out.team.filter(d => !d.corrotto)) {
      expect(d.currentHp).toBe(d.maxHp)
    }
  })

  it('shop heal non cura il corrotto', () => {
    const s0 = stateWith(3)
    // Wound the healthy members too, so the heal branch has visible work to do.
    const s = { ...s0, team: s0.team.map(d => (d.corrotto ? d : { ...d, currentHp: 1 })) }
    const node: RunNode = { id: 'a0f1n0', type: 'shop', next: [] }
    const state = { ...s, map: [node], currentNodeId: node.id, area: 0 }
    const out = shopResolver.resolve(state, node, { kind: 'shop-buy', slotId: 'heal' }, createRng('s'))
    const corrotto = out.team.find(d => d.corrotto)!
    expect(corrotto.currentHp).toBe(10)
    for (const d of out.team.filter(d => !d.corrotto)) {
      expect(d.currentHp).toBe(d.maxHp)
    }
  })

  it('healTeam evento salta il corrotto, cura gli altri', () => {
    const s0 = stateWith(3)
    const s = { ...s0, team: s0.team.map(d => (d.corrotto ? d : { ...d, currentHp: 1 })) }
    const { state: out } = applyEventEffects(s, [{ kind: 'healTeam', pct: 1 }], createRng('e'))
    const corrotto = out.team.find(d => d.corrotto)!
    expect(corrotto.currentHp).toBe(10)
    for (const d of out.team.filter(d => !d.corrotto)) {
      expect(d.currentHp).toBe(d.maxHp)
    }
  })

  it('ECCEZIONE: clearAreaAndAdvance ripristina ANCHE il corrotto (invariante death-system)', () => {
    const s = { ...stateWith(3), area: 0 }
    const out = clearAreaAndAdvance(s, createRng('adv'))
    const corrotto = out.team.find(d => d.corrotto)!
    expect(corrotto.currentHp).toBe(corrotto.maxHp)
    for (const d of out.team) {
      expect(d.currentHp).toBe(d.maxHp)
    }
  })

  it('ECCEZIONE: useConsumableRelic revive rialza anche un corrotto morto', () => {
    const s0 = stateWith(3)
    // Kill the corrotto member; grant the revive relic (lacrime-fenice).
    const s = {
      ...s0,
      team: s0.team.map(d => (d.corrotto ? { ...d, currentHp: 0 } : d)),
      relics: [{ relic: RELIC_BY_ID['lacrime-fenice']!, stageObtained: 0 }],
    }
    const out = useConsumableRelic(s, 'lacrime-fenice')
    const corrotto = out.team.find(d => d.corrotto)!
    expect(corrotto.currentHp).toBe(corrotto.maxHp)
    expect(out.relics).toHaveLength(0)
  })
})
