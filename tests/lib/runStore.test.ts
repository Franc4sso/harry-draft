import { describe, it, expect, beforeEach } from 'vitest'
import { saveRun, loadRun, clearRun, RUN_KEY } from '@/lib/runStore'
import { tagsOf } from '@/game/engine/roster'
import type { RunState } from '@/types'

// jsdom provides localStorage in vitest's default environment; if not, shim it.
const mem: Record<string, string> = {}
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k]
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

const sample: RunState = {
  seed: 's', phase: 'map', team: [], activeSynergies: [], stage: 0, relics: [],
  house: 'Tassorosso', area: 1, teamMax: 5, log: [], pendingLevelUps: [],
}

describe('runStore', () => {
  it('round-trips a run through save/load', () => {
    saveRun(sample)
    expect(loadRun()).toEqual(sample)
  })
  it('returns null when nothing is saved', () => {
    expect(loadRun()).toBeNull()
  })
  it('returns null for a malformed payload', () => {
    localStorage.setItem(RUN_KEY, '{not json')
    expect(loadRun()).toBeNull()
  })
  it('returns null for an incompatible version envelope', () => {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: 999, state: sample }))
    expect(loadRun()).toBeNull()
  })
  // Onda 1.e (2026-07-25): RunNodeType/RunPhase lost the spellForge/spellSwap/shop
  // members. A run saved before this change (schema v2) can still point at one of
  // those now-nonexistent node types, so v2 saves must be discarded on resume rather
  // than rendering an empty/broken screen — VERSION bumped 2 -> 3 for exactly this
  // reason (see the comment above the VERSION const). RUN_KEY_ENDLESS shares the same
  // VERSION, so this also covers endless saves invalidating correctly.
  it('rejects a pre-Onda-1.e v2 payload and accepts a v3 payload', () => {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: 2, state: sample }))
    expect(loadRun()).toBeNull()
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: 3, state: sample }))
    expect(loadRun()).toEqual(sample)
  })
  it('clearRun removes the saved run', () => {
    saveRun(sample)
    clearRun()
    expect(loadRun()).toBeNull()
  })

  // §3a delle Spoglie della Vittoria: i Marchi vivono in `DraftedWizard.grantedTags`. Se non
  // sopravvivessero al giro salva→carica, ricaricare la pagina cancellerebbe le scelte di
  // vittoria del giocatore (e spegnerebbe i Duo che aveva acceso). Il test lo DIMOSTRA invece
  // di darlo per scontato dal fatto che saveRun serializza tutto lo stato.
  it('round-trips grantedTags (i Marchi) e i tag nativi insieme', () => {
    const conMarchio: RunState = {
      ...sample,
      team: [{
        wizard: { id: 'bruto', name: 'Bruto', house: 'Grifondoro', role: 'Tank', tier: 1, gender: 'm',
          ranges: { hp: [100, 100], atk: [20, 20], def: [0, 0], spd: [10, 10] }, spellPool: ['base_attack'],
          tags: ['esecuzione'] },
        stats: { hp: 100, atk: 20, def: 0, spd: 10 }, maxHp: 100, currentHp: 80, level: 2,
        spell: { id: 'base_attack', name: 'Attacco', type: 'Attacco', power: 10 },
        grantedTags: ['veleno'],
      }] as unknown as RunState['team'],
    }
    saveRun(conMarchio)
    const back = loadRun()!
    expect(back).toEqual(conMarchio)
    expect(back.team[0]!.grantedTags).toEqual(['veleno'])
    expect(tagsOf(back.team[0]!)).toEqual(['esecuzione', 'veleno'])
  })
})
