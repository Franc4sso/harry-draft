import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { clearRun, loadRun, saveRun } from '@/lib/runStore'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { detectDuos } from '@/game/engine/duos'
import { livingOf, tagsOf } from '@/game/engine/roster'
import { rollSpoils, spoilsRngForNode, type SpoilMarchio } from '@/game/engine/spoils'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, Role, RunState, Wizard } from '@/types'

function dw(id: string, role: Role, tags: string[], currentHp?: number): DraftedWizard {
  const s = { hp: 100, atk: 20, def: 0, spd: 10 }
  const wizard = {
    id, name: id, house: 'Grifondoro', role, tier: 1, gender: 'm' as const,
    ranges: { hp: [100, 100], atk: [20, 20], def: [0, 0], spd: [10, 10] },
    spellPool: ['base_attack'], tags,
  } as unknown as Wizard
  return {
    wizard, stats: s, maxHp: 100, spell: SPELL_BY_ID['base_attack']!, level: 1,
    ...(currentHp !== undefined ? { currentHp } : {}),
  } as unknown as DraftedWizard
}

/** Squadra a UN segnale-tag da CANCRENA (veleno + esecuzione). */
const aUnPassoDaCancrena = () => [
  dw('avvelenatore', 'Attaccante', ['esecuzione', 'veleno']),
  dw('bruto', 'Tank', ['esecuzione']),
]

function twoPicks(seed: string) {
  let s = startDraft(seed)
  s = pickFrom(s, 0)
  s = pickFrom(s, 0)
  return s.picks
}

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })
afterEach(() => setDraftPoolRestriction(null))

/** Run reale (mappa generata dal seed) con la squadra sostituita da quella di prova, come se
 *  avesse appena vinto una battaglia normale sul nodo corrente. */
function runOnBattleNode(seed: string, team: DraftedWizard[]): RunState {
  const first = renderHook(() => useRunB(seed))
  act(() => first.result.current.completeDraft(twoPicks(seed)))
  const run = first.result.current.run
  return { ...run, team, phase: 'map' }
}

describe('useRunB — chooseSpoil (le Spoglie della Vittoria, solo campagna)', () => {
  it('il Marchio scelto accende DAVVERO il Duo nello stato della run', () => {
    const seed = 'spoglie-hook'
    const base = runOnBattleNode(seed, aUnPassoDaCancrena())
    expect(detectDuos(livingOf(base.team), base.relics).map(d => d.duo.id)).not.toContain('cancrena')

    saveRun(base)
    const h = renderHook(() => useRunB(seed))
    // L'offerta che la UI mostrerebbe per QUESTO nodo (stesso rng del controller).
    const offer = rollSpoils(base, spoilsRngForNode(base.seed, base.currentNodeId!))
    const marchio = offer.filter((s): s is SpoilMarchio => s.kind === 'marchio').find(m => m.completes)!
    expect(marchio.completes!.id).toBe('cancrena')

    act(() => h.result.current.chooseSpoil({ spoilId: marchio.id, wizardId: 'bruto' }))

    const next = h.result.current.run
    expect(tagsOf(next.team.find(d => d.wizard.id === 'bruto')!)).toContain('veleno')
    expect(detectDuos(livingOf(next.team), next.relics).map(d => d.duo.id)).toContain('cancrena')
    expect(h.result.current.view).toBe('map')
  })

  it('registra la scelta nel log della run, col perché scritto', () => {
    const seed = 'spoglie-log'
    const base = runOnBattleNode(seed, aUnPassoDaCancrena())
    saveRun(base)
    const h = renderHook(() => useRunB(seed))
    const offer = rollSpoils(base, spoilsRngForNode(base.seed, base.currentNodeId!))
    const marchio = offer.filter((s): s is SpoilMarchio => s.kind === 'marchio').find(m => m.completes)!

    act(() => h.result.current.chooseSpoil({ spoilId: marchio.id, wizardId: 'bruto' }))

    const log = h.result.current.run.log ?? []
    const ev = log[log.length - 1]!
    expect(ev.kind).toBe('spoglie')
    expect(ev.nodeId).toBe(base.currentNodeId)
    expect(ev.summary).toMatch(/bruto/i)
    expect(ev.summary).toMatch(/Cancrena/)
  })

  it('§3a — i Marchi sopravvivono a un salva/ricarica della run', () => {
    const seed = 'spoglie-persist'
    const base = runOnBattleNode(seed, aUnPassoDaCancrena())
    saveRun(base)
    const h = renderHook(() => useRunB(seed))
    const offer = rollSpoils(base, spoilsRngForNode(base.seed, base.currentNodeId!))
    const marchio = offer.filter((s): s is SpoilMarchio => s.kind === 'marchio').find(m => m.completes)!
    act(() => h.result.current.chooseSpoil({ spoilId: marchio.id, wizardId: 'bruto' }))

    // Il commit ha già scritto su localStorage: ricaricare la pagina = rimontare l'hook.
    const salvato = loadRun()!
    expect(salvato.team.find(d => d.wizard.id === 'bruto')!.grantedTags).toEqual(['veleno'])

    const ricaricato = renderHook(() => useRunB(seed))
    const team = ricaricato.result.current.run.team
    expect(tagsOf(team.find(d => d.wizard.id === 'bruto')!)).toContain('veleno')
    expect(detectDuos(livingOf(team), ricaricato.result.current.run.relics).map(d => d.duo.id)).toContain('cancrena')
  })

  it('un id fuori offerta non tocca la squadra (nessuna fiducia cieca nella UI)', () => {
    const seed = 'spoglie-cheat'
    const base = runOnBattleNode(seed, aUnPassoDaCancrena())
    saveRun(base)
    const h = renderHook(() => useRunB(seed))

    act(() => h.result.current.chooseSpoil({ spoilId: 'marchio:inventato', wizardId: 'bruto' }))

    expect(h.result.current.run.team.every(d => d.grantedTags === undefined)).toBe(true)
    expect((h.result.current.run.log ?? []).some(e => e.kind === 'spoglie')).toBe(false)
    expect(h.result.current.view).toBe('map')
  })

  it('è deterministico: stesso seed + stesso nodo → stessa offerta a ogni rigenerazione', () => {
    const seed = 'spoglie-det'
    const base = runOnBattleNode(seed, aUnPassoDaCancrena())
    const a = rollSpoils(base, spoilsRngForNode(base.seed, base.currentNodeId!))
    const b = rollSpoils(base, spoilsRngForNode(base.seed, base.currentNodeId!))
    expect(b).toEqual(a)
  })
})
