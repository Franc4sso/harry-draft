import { describe, it, expect } from 'vitest'
import type { DraftedWizard, Role, RunNode, RunState, Wizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { tagsOf } from '@/game/engine/roster'
import { rollSpoils, spoilsRngForNode } from '@/game/engine/spoils'
import { botApplySpoils, botPickSpoil, BOT_SPOILS_HURT_RATIO } from './botSpoils'

/**
 * Guardia della POLICY DELLE SPOGLIE del bot di bilanciamento (tests/engine/botSpoils.ts).
 *
 * Perché esiste: la policy serve a impedire che l'harness IGNORI le Spoglie (la trappola degli
 * "scaling joker"). Una policy che smette silenziosamente di scegliere — o che sceglie sempre la
 * stessa carta perché una refattorizzazione ha cambiato la forma dell'offerta — riporterebbe
 * l'harness esattamente al problema che questa fetta risolve, e senza rompere nessun test.
 * Questi casi tengono ancorato l'ordine di preferenza e la soglia di vita.
 *
 * Le fixture ricalcano quelle di tests/engine/spoils.test.ts (stessa forma di DraftedWizard).
 */
function dw(
  id: string,
  role: Role,
  tags: string[],
  opts: { hp?: number; currentHp?: number; level?: number } = {},
): DraftedWizard {
  const hp = opts.hp ?? 100
  const stats = { hp, atk: 20, def: 0, spd: 10 }
  const wizard = {
    id, name: id, house: 'Grifondoro', role, tier: 1, gender: 'm' as const,
    ranges: { hp: [hp, hp], atk: [20, 20], def: [0, 0], spd: [10, 10] },
    spellPool: ['base_attack'], tags,
  } as unknown as Wizard
  return {
    wizard, stats, maxHp: hp, spell: SPELL_BY_ID['base_attack']!, level: opts.level ?? 1,
    ...(opts.currentHp !== undefined ? { currentHp: opts.currentHp } : {}),
  } as unknown as DraftedWizard
}

function mkState(team: DraftedWizard[]): RunState {
  return {
    seed: 'bot-spoils-test', phase: 'victory', team, activeSynergies: [], stage: 0, relics: [],
    area: 0, log: [],
  } as unknown as RunState
}

const NODE_ID = 'a0f1n0'
const offerFor = (s: RunState) => rollSpoils(s, spoilsRngForNode(s.seed, NODE_ID))
const node = (type: RunNode['type']): RunNode => ({ id: NODE_ID, type, next: [] })

describe('policy Spoglie del bot di bilanciamento', () => {
  it('preferisce il Marchio che COMPLETA un Duo', () => {
    // Un passo da CANCRENA (veleno+esecuzione): esecuzione già acceso (2 portatori),
    // il veleno ne ha uno solo → il Marchio del Veleno lo chiude.
    const state = mkState([
      dw('a', 'Attaccante', ['esecuzione', 'veleno']),
      dw('b', 'Tank', ['esecuzione']),
    ])
    const offer = offerFor(state)
    const choice = botPickSpoil(state, offer)!
    expect(choice.spoilId).toBe('marchio:veleno')
    // il bersaglio è un vivo che NON ha già il tag, altrimenti la carta sarebbe un no-op
    expect(choice.wizardId).toBe('b')
  })

  it('senza completamenti prende il Marchio che ACCENDE un segnale, non le carte generiche', () => {
    // Un solo portatore di veleno e nessun altro segnale acceso: il secondo portatore
    // accende `veleno` (need 2) ma non chiude nessun Duo.
    const state = mkState([
      dw('a', 'Attaccante', ['veleno']),
      dw('b', 'Attaccante', []),
    ])
    const choice = botPickSpoil(state, offerFor(state))!
    expect(choice.spoilId).toBe('marchio:veleno')
  })

  it('se restano solo Marchi-seme e la squadra sta bene: Allenamento sul mago più forte', () => {
    const state = mkState([dw('a', 'Attaccante', []), dw('b', 'Attaccante', [])])
    const choice = botPickSpoil(state, offerFor(state))!
    expect(choice.spoilId).toBe('allenamento')
    expect(choice.wizardId).toBeDefined()
  })

  it('sotto la soglia di vita sceglie il Ristoro; appena sopra torna all’Allenamento', () => {
    const hurtHp = Math.round(100 * (BOT_SPOILS_HURT_RATIO - 0.1))
    const okHp = Math.round(100 * (BOT_SPOILS_HURT_RATIO + 0.1))
    const hurt = mkState([
      dw('a', 'Attaccante', [], { currentHp: hurtHp }),
      dw('b', 'Attaccante', [], { currentHp: hurtHp }),
    ])
    const ok = mkState([
      dw('a', 'Attaccante', [], { currentHp: okHp }),
      dw('b', 'Attaccante', [], { currentHp: okHp }),
    ])
    expect(botPickSpoil(hurt, offerFor(hurt))!.spoilId).toBe('ristoro')
    expect(botPickSpoil(ok, offerFor(ok))!.spoilId).toBe('allenamento')
  })

  it('è deterministica: stesso stato → stessa scelta', () => {
    const state = mkState([dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['esecuzione'])])
    expect(botPickSpoil(state, offerFor(state))).toEqual(botPickSpoil(state, offerFor(state)))
  })

  it('botApplySpoils applica davvero la scelta dopo una battaglia normale…', () => {
    const state = mkState([
      dw('a', 'Attaccante', ['esecuzione', 'veleno']),
      dw('b', 'Tank', ['esecuzione']),
    ])
    const after = botApplySpoils(state, node('battle'))
    expect(tagsOf(after.team[1]!)).toContain('veleno')
  })

  it('…e NON dopo élite o boss (quelli hanno già le loro ricompense)', () => {
    const state = mkState([
      dw('a', 'Attaccante', ['esecuzione', 'veleno']),
      dw('b', 'Tank', ['esecuzione']),
    ])
    expect(botApplySpoils(state, node('elite'))).toBe(state)
    expect(botApplySpoils(state, node('boss'))).toBe(state)
    expect(botApplySpoils(state, undefined)).toBe(state)
  })
})
