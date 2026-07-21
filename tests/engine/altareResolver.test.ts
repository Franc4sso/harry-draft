import { describe, it, expect } from 'vitest'
import { altareResolver, altareOffer } from '@/game/engine/resolvers/altare'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { SACRIFICE_RELIC_IDS, RELICS, JOKER_RELIC_IDS, RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, RunNode, RunState } from '@/types'

function team(n: number) {
  return offerRecruits(createRng(1), { exclude: new Set() }).slice(0, n).map(d => recruitVia(d, 'iniziale', 1))
}
function state(over: Partial<RunState> = {}): RunState {
  const node: RunNode = { id: 'a0f1n0', type: 'altare', next: [] }
  return { seed: 's', phase: 'altare-node', team: team(2), activeSynergies: [], stage: 0, relics: [],
    map: [node], currentNodeId: 'a0f1n0', area: 0, ...over }
}
const rng = () => createRng('s')
const node = (s: RunState) => s.map!.find(n => n.id === 'a0f1n0')!

/** Find a seed whose altare offer contains `relicId` (deterministic seed-search loop, as in corruzione.test.ts). */
function findSeedOffering(relicId: string, teamSize = 2): { state: RunState; relicIds: string[] } {
  for (let i = 0; i < 500; i++) {
    const s = state({ seed: `altare-${i}`, team: team(teamSize) })
    const offer = altareResolver.enter(s, node(s), createRng(s.seed)).offers.relicIds ?? []
    if (offer.includes(relicId)) return { state: s, relicIds: offer }
  }
  throw new Error(`no seed found offering ${relicId}`)
}

describe('altareResolver', () => {
  it('enter offre 2-3 sacrificio deterministiche per (seed, nodo)', () => {
    const s = state()
    const first = altareResolver.enter(s, node(s), createRng(s.seed)).offers.relicIds ?? []
    const second = altareResolver.enter(s, node(s), createRng(s.seed)).offers.relicIds ?? []
    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThanOrEqual(2)
    expect(first.length).toBeLessThanOrEqual(3)
    for (const id of first) expect(SACRIFICE_RELIC_IDS).toContain(id)
  })

  it('buy con costo wizard: reliquia entra, mago esce, sinergie ricalcolate', () => {
    const { state: s0 } = findSeedOffering('diario-riddle', 3)
    const wizardId = s0.team[0]!.wizard.id
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'diario-riddle', costWizardId: wizardId }, createRng(s0.seed))
    expect(out.relics.map(a => a.relic.id)).toContain('diario-riddle')
    expect(out.team.map(d => d.wizard.id)).not.toContain(wizardId)
    expect(out.team).toHaveLength(s0.team.length - 1)
    expect(out.activeSynergies).toBeDefined()
  })

  it('buy con costo relic: reliquia scelta rimossa, sacrificio aggiunta', () => {
    const { state: base } = findSeedOffering('mano-della-gloria', 2)
    const s0 = { ...base, relics: [{ relic: RELIC_BY_ID['giratempo']!, stageObtained: 0 }] }
    const carrierId = s0.team[0]!.wizard.id
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'mano-della-gloria', costRelicId: 'giratempo', carrierId }, createRng(s0.seed))
    expect(out.relics.map(a => a.relic.id)).not.toContain('giratempo')
    expect(out.relics.map(a => a.relic.id)).toContain('mano-della-gloria')
  })

  it('buy assignable (mano-della-gloria) con carrierId valido → assignedTo settato', () => {
    const { state: base } = findSeedOffering('mano-della-gloria', 2)
    const s0 = { ...base, relics: [{ relic: RELIC_BY_ID['giratempo']!, stageObtained: 0 }] }
    const carrierId = s0.team[1]!.wizard.id
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'mano-della-gloria', costRelicId: 'giratempo', carrierId }, createRng(s0.seed))
    const active = out.relics.find(a => a.relic.id === 'mano-della-gloria')
    expect(active?.assignedTo).toBe(carrierId)
  })

  it('buy assignable senza carrierId → no-op reference-equal', () => {
    const { state: base } = findSeedOffering('mano-della-gloria', 2)
    const s0 = { ...base, relics: [{ relic: RELIC_BY_ID['giratempo']!, stageObtained: 0 }] }
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'mano-della-gloria', costRelicId: 'giratempo' }, createRng(s0.seed))
    expect(out).toBe(s0)
  })

  it('buy assignable con carrierId non nel team → no-op reference-equal', () => {
    const { state: base } = findSeedOffering('mano-della-gloria', 2)
    const s0 = { ...base, relics: [{ relic: RELIC_BY_ID['giratempo']!, stageObtained: 0 }] }
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'mano-della-gloria', costRelicId: 'giratempo', carrierId: 'non-esiste' }, createRng(s0.seed))
    expect(out).toBe(s0)
  })

  it('buy con costo maxHp: stats.hp e maxHp tagliati sul bersaglio', () => {
    const { state: s0 } = findSeedOffering('calice-avvelenato', 2)
    const dw = s0.team[0]!
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'calice-avvelenato', costWizardId: dw.wizard.id }, createRng(s0.seed))
    const cut = out.team.find(d => d.wizard.id === dw.wizard.id)!
    expect(cut.maxHp).toBe(dw.maxHp - 40)
    expect(cut.stats.hp).toBe(dw.stats.hp - 40)
    expect(out.relics.map(a => a.relic.id)).toContain('calice-avvelenato')
  })

  it('costo non pagabile → no-op reference-equal (team da 1 per costo wizard)', () => {
    const { state: base } = findSeedOffering('diario-riddle', 1)
    const s0 = { ...base, team: team(1) }
    const wizardId = s0.team[0]!.wizard.id
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'diario-riddle', costWizardId: wizardId }, createRng(s0.seed))
    expect(out).toBe(s0)
  })

  it('relicId fuori offerta → no-op reference-equal', () => {
    const s0 = state()
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'non-esiste', costWizardId: s0.team[0]!.wizard.id }, rng())
    expect(out).toBe(s0)
  })

  it('skip → no-op reference-equal (il runner marca resolved e torna alla mappa)', () => {
    const s0 = state()
    const out = altareResolver.resolve(s0, node(s0), { kind: 'skip' }, rng())
    expect(out).toBe(s0)
  })

  it('log RunEvent kind altare con il nome della reliquia', () => {
    const { state: s0 } = findSeedOffering('diario-riddle', 3)
    const wizardId = s0.team[0]!.wizard.id
    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'diario-riddle', costWizardId: wizardId }, createRng(s0.seed))
    const ev = out.log!.find(e => e.kind === 'altare')
    expect(ev).toBeDefined()
    expect(ev!.summary).toContain('Diario di Tom Riddle')
  })
})

describe('altareResolver at the cap (swap a 5)', () => {
  /** 5 owned relics excluding the sacrifice pool (so the altare offer stays untouched). */
  function fiveOwned(excludeIds: Set<string>): ActiveRelic[] {
    const pool = RELICS.filter(r => !JOKER_RELIC_IDS.includes(r.id) && !SACRIFICE_RELIC_IDS.includes(r.id) && !excludeIds.has(r.id))
    return pool.slice(0, 5).map((relic, i) => ({ relic, stageObtained: i }))
  }

  it('con replaceRelicId: sostituisce E il costo (wizard) è comunque pagato una sola volta', () => {
    const { state: base } = findSeedOffering('diario-riddle', 3)
    const s0 = { ...base, relics: fiveOwned(new Set()) }
    const wizardId = s0.team[0]!.wizard.id
    const replaceId = s0.relics[0]!.relic.id

    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'diario-riddle', costWizardId: wizardId, replaceRelicId: replaceId }, createRng(s0.seed))

    expect(out.relics).toHaveLength(5)
    expect(out.relics.some(a => a.relic.id === replaceId)).toBe(false)
    expect(out.relics.some(a => a.relic.id === 'diario-riddle')).toBe(true)
    // costo pagato una sola volta: il mago sacrificato esce dal team
    expect(out.team.map(d => d.wizard.id)).not.toContain(wizardId)
    expect(out.team).toHaveLength(s0.team.length - 1)
  })

  it('senza replaceRelicId: no-op reference-equal E il costo NON viene pagato (rifiuto gratis)', () => {
    const { state: base } = findSeedOffering('diario-riddle', 3)
    const s0 = { ...base, relics: fiveOwned(new Set()) }
    const wizardId = s0.team[0]!.wizard.id

    const out = altareResolver.resolve(s0, node(s0),
      { kind: 'altare-buy', relicId: 'diario-riddle', costWizardId: wizardId }, createRng(s0.seed))

    expect(out).toBe(s0)
    // il mago del costo NON deve essere stato rimosso: il rifiuto non costa nulla
    expect(out.team.map(d => d.wizard.id)).toContain(wizardId)
  })
})

// Sanity: altareOffer is exported and matches the resolver's enter() offer.
describe('altareOffer', () => {
  it('è la stessa funzione usata da enter/resolve', () => {
    const s = state()
    const viaEnter = altareResolver.enter(s, node(s), createRng(s.seed)).offers.relicIds ?? []
    const viaOffer = altareOffer(s, node(s), createRng(s.seed)).map(r => r.id)
    expect(viaOffer).toEqual(viaEnter)
  })
})
