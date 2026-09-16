import { describe, it, expect } from 'vitest'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { DUO_BY_ID } from '@/data/duos'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { ActiveDuo } from '@/types'

/**
 * 2026-09-16 — I Duo valgono anche per i nemici.
 *
 * Rilievo dell'utente: «non vedo le combo dei miei avversari, se li hanno». Non
 * era un difetto della UI: NON ESISTEVANO. `simulateBattle` passava `leftDuos` al
 * lato sinistro (simulate.ts:93) e NIENTE al destro (:94), quindi una squadra
 * nemica che avrebbe acceso Cancrena o Muro Vivente non li otteneva mai.
 *
 * Questo contraddiceva un principio già scritto del progetto — gli archetipi sono
 * SISTEMI che «valgono anche per i nemici» — e i Duo sono la loro amplificazione.
 * (Diverso dai Jolly, che sono deliberatamente solo del giocatore perché è quella
 * asimmetria a renderli sicuri per il bilanciamento: quella resta intatta.)
 */
const duo = (id: string): ActiveDuo => ({ duo: DUO_BY_ID[id]! } as ActiveDuo)
const team = (ids: string[], seed: string) => {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('stampDuoFields — funziona in entrambe le direzioni', () => {
  it('Cancrena del lato destro amplifica il veleno sul lato SINISTRO', () => {
    // Il marchio di Cancrena va sulle VITTIME: chiamato con i lati invertiti,
    // deve colpire il giocatore, non i nemici.
    const l = toBattleUnits(team(['harry', 'ron'], 'L'), 'left', [])
    const r = toBattleUnits(team(['draco', 'goyle'], 'R'), 'right', [])
    stampDuoFields(r, l, [duo('cancrena')], 'normal')
    expect(l.every(u => u.poisonAmp?.mult === 2)).toBe(true)
    expect(r.some(u => u.poisonAmp)).toBe(false)
  })

  it('Muro Vivente del lato destro arma il TANK nemico, non il mio', () => {
    const l = toBattleUnits(team(['harry', 'ron'], 'L2'), 'left', [])
    const r = toBattleUnits(team(['crabbe', 'goyle'], 'R2'), 'right', [])
    stampDuoFields(r, l, [duo('muro-vivente')], 'normal')
    const tanks = r.filter(u => u.wizard.role === 'Tank')
    expect(tanks.length).toBeGreaterThan(0)
    expect(tanks.every(u => u.livingWall?.reflect === 0.5)).toBe(true)
    expect(l.some(u => u.livingWall)).toBe(false)
  })

  it('i Duo del giocatore restano invariati quando il nemico ne ha di suoi', () => {
    // Regressione: attivare i Duo nemici non deve spegnere quelli del giocatore.
    const l = toBattleUnits(team(['harry', 'ron'], 'L3'), 'left', [])
    const r = toBattleUnits(team(['draco', 'goyle'], 'R3'), 'right', [])
    stampDuoFields(l, r, [duo('mietitore')], 'normal')
    stampDuoFields(r, l, [duo('cancrena')], 'normal')
    expect(l.every(u => u.reaper)).toBe(true)
    expect(l.every(u => u.poisonAmp?.mult === 2)).toBe(true)
  })
})

describe('simulateBattle — il lato destro riceve i suoi Duo', () => {
  it('rightDuos marchia le mie unità, come leftDuos marchia le loro', async () => {
    // LA VERA LACUNA: stampDuoFields è già simmetrico (i test sopra lo provano),
    // ma simulate.ts:94 non passava NULLA al lato destro. Il difetto stava nel
    // chiamante, non nella funzione.
    const { simulateBattle } = await import('@/game/engine/combat/simulate')
    const l = team(['harry', 'ron', 'hermione'], 'SL')
    const r = team(['draco', 'goyle', 'crabbe'], 'SR')
    const res = simulateBattle(l, r, createRng(7), { rightDuos: [duo('cancrena')] })
    expect(res).toBeTruthy()
  })
})
