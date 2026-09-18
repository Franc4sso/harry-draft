// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fromDrafted, sideModsFor, toRtSide, simulateTeams } from '@/game/engine/rt/adapter'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

const dw = (id: string, seed = 1) => draftWizard(createRng(seed), WIZARD_BY_ID[id]!)
const team = (...ids: string[]) => ids.map((id, i) => dw(id, i + 1))
const relic = (id: string, assignedTo?: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0, assignedTo })

describe('fromDrafted', () => {
  it('mappa stat, tag, spell rt, abilità, livello clampato', () => {
    const t = team('harry'); const u = fromDrafted({ ...t[0]!, level: 9 }, 2, t, [])
    expect(u.id).toBe('harry'); expect(u.slot).toBe(2); expect(u.level).toBe(4)
    expect(u.spell.id).toBe('expelliarmus'); expect(u.ability!.id).toBe('harry'); expect(u.tags).toContain('trio')
    expect(u.stats.atk).toBe(t[0]!.stats.atk)
  })
  it('reliquia assegnata: stat del portatore e carrierLines', () => {
    const t = team('snape'); const r = [relic('giratempo', 'snape'), relic('patto-di-sangue', 'snape')]
    const u = fromDrafted(t[0]!, 0, t, r)
    expect(u.stats.spd).toBe(t[0]!.stats.spd + 30)
    expect(u.extraLines?.some(l => l.effect.kind === 'dannoPct')).toBe(true)
  })
  it('shiny: righe del tratto in extraLines; extras: memoria e permanenti', () => {
    const t = team('cho'); const u = fromDrafted({ ...t[0]!, shiny: { traitId: 'gelo' } }, 0, t, [], { memoria: { glacius: 3 }, permanenti: { dannoFlat: 2 } })
    expect(u.extraLines?.length).toBe(1); expect(u.memoria).toEqual({ glacius: 3 }); expect(u.permanenti).toEqual({ dannoFlat: 2 })
  })
  it('corrotto passa; mago senza abilità rt lancia', () => {
    const t = team('draco'); expect(fromDrafted({ ...t[0]!, corrotto: true }, 0, t, []).corrotto).toBe(true)
    const fake = { ...t[0]!, wizard: { ...t[0]!.wizard, id: 'nessuno' } } as DraftedWizard
    expect(() => fromDrafted(fake, 0, [fake], [])).toThrow(/nessuno/)
  })
})

describe('sideModsFor', () => {
  it('Duo Cancrena (veleno + esecuzione) → cancrenaSotto', () => {
    const m = sideModsFor(team('bellatrix', 'dolohov', 'harry', 'snape'), [])   // veleno: bellatrix, dolohov; esecuzione: harry, snape, bellatrix
    expect(m.cancrenaSotto).toBe(0.4)
  })
  it('Trio Serpeverde (≥3 Serpeverde + un Duo) → segnoOnCast veleno', () => {
    const m = sideModsFor(team('bellatrix', 'dolohov', 'snape', 'draco'), [])   // Duo cancrena + 4 Serpeverde → grado 1
    expect(m.segnoOnCast?.veleno).toBe(2)
  })
  it('archetipo veleno grado 2 (3 tag) → velenoMult 1.5 e conduzione 8', () => {
    const m = sideModsFor(team('bellatrix', 'dolohov', 'greyback'), [])
    expect(m.velenoMult).toBeCloseTo(1.5); expect(m.conduzioneSecondi).toBe(8)
  })
  it('reliquie: mods fusi, righe gated dalla condizione di casa, magie oscure sommate', () => {
    const t = team('hannah', 'ernie', 'sprout')
    const m = sideModsFor(t, [relic('ampolla-veleno'), relic('calice-avvelenato'), relic('coppa-tassorosso'), relic('marchio-nero', 'hannah'), relic('diadema-corrotto')])
    expect(m.velenoMult).toBeCloseTo(3)
    expect(m.lines?.some(l => l.effect.kind === 'cura')).toBe(true)
    expect(m.magieOscure).toEqual({ bonus: 0.65, recoil: 0.2 })
    const m2 = sideModsFor(team('harry'), [relic('coppa-tassorosso')])
    expect(m2.lines ?? []).toHaveLength(0)
  })
})

describe('toRtSide e simulateTeams', () => {
  it('slot dal campo slot se presente, altrimenti indice; simulazione reale finisce con un vincitore', () => {
    const l = team('harry', 'ron', 'hermione'); (l[2] as { slot?: number }).slot = 4
    const side = toRtSide(l, [])
    expect(side.units.map(u => u.slot)).toEqual([0, 1, 4])
    const r = simulateTeams(l, team('draco', 'goyle', 'pansy'), createRng(3))
    expect(['left', 'right']).toContain(r.winner); expect(r.events.some(e => e.kind === 'cast')).toBe(true)
  })
  it('è deterministico con le stesse squadre e lo stesso seed', () => {
    const a = simulateTeams(team('harry', 'ron', 'hermione'), team('draco', 'goyle', 'pansy'), createRng(3))
    const b = simulateTeams(team('harry', 'ron', 'hermione'), team('draco', 'goyle', 'pansy'), createRng(3))
    expect(a.events).toEqual(b.events)
  })
})
