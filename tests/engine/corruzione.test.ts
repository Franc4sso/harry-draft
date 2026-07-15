import { describe, it, expect } from 'vitest'
import { corruptOnAssign } from '@/game/engine/sacrifice'
import { relicResolver } from '@/game/engine/resolvers/recruit'
import { createDraftPool } from '@/game/engine/draft'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { RELIC_BY_ID } from '@/data/relics'
import type { RunState } from '@/types'

const rng = createRng('corr-test')
const team = () => createDraftPool().slice(0, 3).map(w => draftWizard(createRng('corr-test'), w, true))

describe('corruptOnAssign', () => {
  it('marchia il carrier su reliquia grantsDarkMagic', () => {
    const t = team()
    const out = corruptOnAssign(t, RELIC_BY_ID['marchio-nero']!, t[0]!.wizard.id)
    expect(out[0]!.corrotto).toBe(true)
    expect(out[1]!.corrotto).toBeUndefined()
  })
  it('identità su reliquia non oscura o carrier assente', () => {
    const t = team()
    expect(corruptOnAssign(t, RELIC_BY_ID['giratempo']!, t[0]!.wizard.id)).toBe(t)
    expect(corruptOnAssign(t, RELIC_BY_ID['marchio-nero']!, 'nessuno')).toBe(t)
  })
})

describe('relicResolver + corruzione', () => {
  it('relic-pick di marchio-nero con assignedTo corrompe il carrier', () => {
    const t = team()
    const state: RunState = {
      seed: 'corr-test', phase: 'relic-node', team: t, activeSynergies: [], stage: 0, relics: [],
      area: 0, map: [{ id: 'a0f1n0', type: 'relic', next: [] }], currentNodeId: 'a0f1n0',
    }
    // Forza l'offerta a contenere marchio-nero non è deterministico dal seed di test:
    // qui testiamo direttamente il ramo resolve con l'offerta reale del nodo.
    // Se l'offerta del seed non contiene marchio-nero, il resolve è no-op → il test
    // usa corruptOnAssign già coperto sopra; QUESTO test integra via un seed che lo offre.
    // Trova un seed che offre marchio-nero (loop deterministico sui seed):
    let found: { state: RunState; relicId: string } | null = null
    for (let i = 0; i < 200 && !found; i++) {
      const s = { ...state, seed: `corr-${i}` }
      const offer = relicResolver.enter(s, s.map![0]!, createRng(s.seed)).offers.relicIds ?? []
      if (offer.includes('marchio-nero')) found = { state: s, relicId: 'marchio-nero' }
    }
    expect(found).not.toBeNull()
    const out = relicResolver.resolve(found!.state, found!.state.map![0]!,
      { kind: 'relic-pick', relicId: found!.relicId, assignedTo: t[0]!.wizard.id }, createRng(found!.state.seed))
    expect(out.team.find(d => d.wizard.id === t[0]!.wizard.id)!.corrotto).toBe(true)
  })
})
