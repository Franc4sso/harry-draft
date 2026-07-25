import { describe, it, expect } from 'vitest'
import type { DraftedWizard, Role, RunState, Wizard } from '@/types'
import {
  applySpoil, applySpoilChoice, rollSpoils, spoilNeedsTarget, spoilsRngForNode,
  RISTORO_PCT, type Spoil, type SpoilMarchio,
} from '@/game/engine/spoils'
import { createRng } from '@/game/engine/rng'
import { detectDuos, signalActive } from '@/game/engine/duos'
import { tagsOf } from '@/game/engine/roster'
import { SPELL_BY_ID } from '@/data/spells'

/** DraftedWizard minimale ma REALE (stessa forma di tests/engine/grantedTags.test.ts). */
function dw(
  id: string,
  role: Role,
  tags: string[],
  opts: { granted?: string[]; hp?: number; currentHp?: number; level?: number; corrotto?: true } = {},
): DraftedWizard {
  const hp = opts.hp ?? 100
  const s = { hp, atk: 20, def: 0, spd: 10 }
  const wizard = {
    id, name: id, house: 'Grifondoro', role, tier: 1, gender: 'm' as const,
    ranges: { hp: [hp, hp], atk: [20, 20], def: [0, 0], spd: [10, 10] },
    spellPool: ['base_attack'], tags,
  } as unknown as Wizard
  return {
    wizard, stats: s, maxHp: hp, spell: SPELL_BY_ID['base_attack']!,
    ...(opts.granted ? { grantedTags: opts.granted } : {}),
    ...(opts.currentHp !== undefined ? { currentHp: opts.currentHp } : {}),
    ...(opts.level !== undefined ? { level: opts.level } : {}),
    ...(opts.corrotto ? { corrotto: true as const } : {}),
  } as unknown as DraftedWizard
}

function mkState(team: DraftedWizard[], over: Partial<RunState> = {}): RunState {
  return {
    seed: 'spoglie-test', phase: 'map', team, activeSynergies: [], stage: 0, relics: [],
    area: 0, log: [], ...over,
  }
}

/** Squadra a UN segnale-tag da CANCRENA (veleno + esecuzione): esecuzione è già acceso
 *  (2 maghi), il veleno ha un solo portatore → un Marchio del Veleno lo chiude. */
const aUnPassoDaCancrena = () => [
  dw('a', 'Attaccante', ['esecuzione', 'veleno']),
  dw('b', 'Tank', ['esecuzione']),
]

const marchi = (offer: Spoil[]) => offer.filter((s): s is SpoilMarchio => s.kind === 'marchio')

describe('rollSpoils — determinismo', () => {
  it('stesso stato + stesso seed → offerta identica, chiamata due volte', () => {
    const state = mkState(aUnPassoDaCancrena())
    const first = rollSpoils(state, createRng('nodo-a1f2n0'))
    const second = rollSpoils(state, createRng('nodo-a1f2n0'))
    expect(second).toEqual(first)
  })

  it('spoilsRngForNode: stesso (seed, nodo) → stessa offerta; nodo diverso → stream diverso', () => {
    const state = mkState([
      dw('a', 'Attaccante', []), dw('b', 'Tank', []), dw('c', 'Supporto', []), dw('d', 'Controllo', []),
    ])
    const uno = rollSpoils(state, spoilsRngForNode(state.seed, 'a0f1n0'))
    const unoBis = rollSpoils(state, spoilsRngForNode(state.seed, 'a0f1n0'))
    expect(unoBis).toEqual(uno)
    // stream distinti: due nodi non condividono le stesse estrazioni
    const r1 = spoilsRngForNode(state.seed, 'a0f1n0')
    const r2 = spoilsRngForNode(state.seed, 'a0f2n1')
    expect(r1.next()).not.toBe(r2.next())
  })

  it('nessun Math.random: la stessa offerta si riproduce anche a distanza di altre estrazioni', () => {
    const state = mkState(aUnPassoDaCancrena())
    const atteso = rollSpoils(state, createRng('x'))
    const rumore = createRng('altro')
    for (let i = 0; i < 50; i++) rumore.next()
    expect(rollSpoils(state, createRng('x'))).toEqual(atteso)
  })
})

describe('rollSpoils — sempre 3 carte, sempre distinte', () => {
  const squadre: [string, DraftedWizard[]][] = [
    ['squadra vuota', []],
    ['un solo mago', [dw('solo', 'Attaccante', ['veleno'])]],
    ['a un passo da Cancrena', aUnPassoDaCancrena()],
    ['squadra ferita', [dw('a', 'Attaccante', ['veleno'], { currentHp: 40 }), dw('b', 'Tank', [])]],
    ['tutti i tag già addosso', [
      dw('a', 'Attaccante', ['veleno', 'esecuzione', 'scudirigen', 'magieOscure']),
      dw('b', 'Tank', ['veleno', 'esecuzione', 'scudirigen', 'magieOscure']),
    ]],
  ]

  for (const [nome, team] of squadre) {
    it(`${nome}: esattamente 3 carte, id tutti diversi`, () => {
      for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
        const offer = rollSpoils(mkState(team), createRng(seed))
        expect(offer).toHaveLength(3)
        expect(new Set(offer.map(s => s.id)).size).toBe(3)
      }
    })
  }

  it('il tipo dice alla UI se serve un bersaglio', () => {
    const offer = rollSpoils(mkState(aUnPassoDaCancrena()), createRng('ui'))
    for (const s of offer) {
      expect(spoilNeedsTarget(s)).toBe(s.kind !== 'ristoro')
    }
  })
})

describe('rollSpoils — keyword-aware: il Marchio che completa il Duo è garantito e ha il nome', () => {
  it('a un segnale da CANCRENA l’offerta contiene il Marchio del Veleno che la completa', () => {
    const state = mkState(aUnPassoDaCancrena())
    for (const seed of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']) {
      const offer = rollSpoils(state, createRng(seed))
      const completante = marchi(offer).find(m => m.completes)
      expect(completante, `seed ${seed}`).toBeDefined()
      expect(completante!.tag).toBe('veleno')
      expect(completante!.completes).toEqual({ id: 'cancrena', name: 'Cancrena' })
      expect(completante!.title).toContain('Veleno')
    }
  })

  it('a un segnale da MURO VIVENTE il Marchio garantito è quello dello Scudo', () => {
    // Tank presente (taunt acceso) + UN solo mago scudirigen → il Marchio chiude il Duo.
    const state = mkState([
      dw('t', 'Tank', ['scudirigen']),
      dw('s', 'Supporto', []),
    ])
    for (const seed of ['m1', 'm2', 'm3', 'm4']) {
      const completante = marchi(rollSpoils(state, createRng(seed))).find(m => m.completes)
      expect(completante, `seed ${seed}`).toBeDefined()
      expect(completante!.tag).toBe('scudirigen')
      expect(completante!.completes!.name).toBe('Muro Vivente')
    }
  })

  it('nessun Duo raggiungibile: si offre comunque un Marchio, ma senza promettere un Duo', () => {
    const state = mkState([dw('a', 'Attaccante', []), dw('b', 'Attaccante', [])])
    const offer = rollSpoils(state, createRng('nessun-duo'))
    expect(marchi(offer).length).toBeGreaterThan(0)
    expect(marchi(offer).every(m => m.completes === undefined)).toBe(true)
  })
})

describe('rollSpoils — Ristoro: solo quando serve davvero', () => {
  it('squadra ferita: il Ristoro è nell’offerta', () => {
    const team = [dw('a', 'Attaccante', ['veleno'], { currentHp: 30 }), dw('b', 'Tank', [])]
    const offer = rollSpoils(mkState(team), createRng('ferita'))
    expect(offer.some(s => s.kind === 'ristoro')).toBe(true)
  })

  it('squadra a piena vita: niente Ristoro sprecato, al suo posto un secondo Marchio', () => {
    const offer = rollSpoils(mkState(aUnPassoDaCancrena()), createRng('piena'))
    expect(offer.some(s => s.kind === 'ristoro')).toBe(false)
    expect(marchi(offer)).toHaveLength(2)
    expect(new Set(marchi(offer).map(m => m.tag)).size).toBe(2) // tag diversi
  })

  it('un corrotto ferito non giustifica il Ristoro (non è curabile)', () => {
    const team = [dw('c', 'Attaccante', ['veleno'], { currentHp: 10, corrotto: true }), dw('b', 'Tank', [])]
    expect(rollSpoils(mkState(team), createRng('corrotto')).some(s => s.kind === 'ristoro')).toBe(false)
  })
})

describe('applySpoil — Marchio: accende il Duo per davvero', () => {
  it('il tag concesso fa scattare signalActive e detectDuos (integrazione, non solo il campo)', () => {
    const state = mkState(aUnPassoDaCancrena())
    expect(signalActive('veleno', state.team, state.relics)).toBe(false)
    expect(detectDuos(state.team, state.relics).map(d => d.duo.id)).not.toContain('cancrena')

    const offer = rollSpoils(state, createRng('apply-cancrena'))
    const marchio = marchi(offer).find(m => m.completes)!
    const next = applySpoil(state, marchio, 'b')

    expect(tagsOf(next.team[1]!)).toContain('veleno')
    expect(signalActive('veleno', next.team, next.relics)).toBe(true)
    expect(detectDuos(next.team, next.relics).map(d => d.duo.id)).toContain('cancrena')
  })

  it('ricalcola le sinergie (i tag le alimentano)', () => {
    const team = [
      dw('v1', 'Attaccante', ['veleno']), dw('v2', 'Supporto', ['veleno']), dw('v3', 'Tank', []),
    ]
    const state = mkState(team)
    const marchio = marchi(rollSpoils(state, createRng('syn'))).find(m => m.tag === 'veleno')
      ?? ({ kind: 'marchio', id: 'marchio:veleno', needsTarget: true, tag: 'veleno', title: 't', desc: 'd' } as SpoilMarchio)
    const next = applySpoil(state, marchio, 'v3')
    expect(next.activeSynergies.map(s => s.synergy.id)).toContain('tossicita')
  })

  it('no-op su bersaglio inesistente o tag già posseduto', () => {
    const state = mkState(aUnPassoDaCancrena())
    const marchio = marchi(rollSpoils(state, createRng('noop'))).find(m => m.tag === 'veleno')!
    expect(applySpoil(state, marchio, 'inesistente')).toBe(state)
    expect(applySpoil(state, marchio, 'a')).toBe(state) // 'a' ha già veleno nativo
  })

  it('applySpoilChoice risolve per id e ignora gli id fuori offerta', () => {
    const state = mkState(aUnPassoDaCancrena())
    const offer = rollSpoils(state, createRng('choice'))
    const next = applySpoilChoice(state, offer, { spoilId: 'marchio:veleno', wizardId: 'b' })
    expect(detectDuos(next.team, next.relics).map(d => d.duo.id)).toContain('cancrena')
    expect(applySpoilChoice(state, offer, { spoilId: 'marchio:inventato', wizardId: 'b' })).toBe(state)
  })
})

describe('applySpoil — purezza: lo stato in ingresso non viene mai mutato', () => {
  it('Marchio: nessuna mutazione in place, strutture nuove', () => {
    const state = mkState([
      dw('a', 'Attaccante', ['esecuzione', 'veleno']),
      dw('b', 'Tank', ['esecuzione'], { granted: ['scudirigen'] }),
    ])
    const before = JSON.parse(JSON.stringify(state))
    const marchio = marchi(rollSpoils(state, createRng('pure'))).find(m => m.tag === 'veleno')!
    const next = applySpoil(state, marchio, 'b')

    expect(JSON.parse(JSON.stringify(state))).toEqual(before)
    expect(state.team[1]!.grantedTags).toEqual(['scudirigen']) // array originale intatto
    expect(next).not.toBe(state)
    expect(next.team).not.toBe(state.team)
    expect(next.team[1]).not.toBe(state.team[1])
    expect(next.team[0]).toBe(state.team[0]) // i non toccati restano gli stessi riferimenti
    expect(next.team[1]!.grantedTags).toEqual(['scudirigen', 'veleno'])
  })

  it('Allenamento e Ristoro: nessuna mutazione in place', () => {
    const state = mkState([dw('a', 'Attaccante', ['veleno'], { currentHp: 40, level: 3 })])
    const before = JSON.parse(JSON.stringify(state))
    const offer = rollSpoils(state, createRng('pure2'))
    applySpoil(state, offer.find(s => s.kind === 'allenamento')!, 'a')
    applySpoil(state, offer.find(s => s.kind === 'ristoro')!)
    expect(JSON.parse(JSON.stringify(state))).toEqual(before)
  })
})

describe('applySpoil — Allenamento e Ristoro', () => {
  it('Allenamento alza il livello di 1 al solo mago scelto, con exp coerente', () => {
    const state = mkState([dw('a', 'Attaccante', [], { level: 3 }), dw('b', 'Tank', [])])
    const carta = rollSpoils(state, createRng('lvl')).find(s => s.kind === 'allenamento')!
    const next = applySpoil(state, carta, 'a')
    expect(next.team[0]!.level).toBe(4)
    expect(next.team[0]!.exp).toBeGreaterThan(0)
    expect(next.team[1]!.level).toBeUndefined() // l'altro non cresce
  })

  it('Allenamento è no-op senza bersaglio valido', () => {
    const state = mkState([dw('a', 'Attaccante', [], { level: 3 })])
    const carta = rollSpoils(state, createRng('lvl2')).find(s => s.kind === 'allenamento')!
    expect(applySpoil(state, carta)).toBe(state)
  })

  it('Ristoro cura il 25% a tutti senza superare il massimo', () => {
    const state = mkState([
      dw('ferito', 'Attaccante', [], { hp: 100, currentHp: 40 }),
      dw('quasi', 'Tank', [], { hp: 100, currentHp: 90 }),
      dw('sano', 'Supporto', [], { hp: 100 }),
      dw('morto', 'Controllo', [], { hp: 100, currentHp: 0 }),
    ])
    const carta = rollSpoils(mkState([dw('x', 'Attaccante', [], { currentHp: 10 })]), createRng('heal'))
      .find(s => s.kind === 'ristoro')!
    const next = applySpoil(state, carta)

    expect(next.team[0]!.currentHp).toBe(40 + Math.round(100 * RISTORO_PCT))
    expect(next.team[1]!.currentHp).toBe(100) // capped, non 115
    expect(next.team[2]!.currentHp ?? next.team[2]!.maxHp).toBe(100)
    expect(next.team[3]!.currentHp).toBe(0) // un morto non si cura (il revive è altra cosa)
    for (const d of next.team) expect(d.currentHp ?? d.maxHp).toBeLessThanOrEqual(d.maxHp)
  })

  it('Ristoro è no-op se non c’è nulla da curare', () => {
    const state = mkState([dw('a', 'Attaccante', []), dw('b', 'Tank', [])])
    const carta = rollSpoils(mkState([dw('x', 'Attaccante', [], { currentHp: 10 })]), createRng('heal2'))
      .find(s => s.kind === 'ristoro')!
    expect(applySpoil(state, carta)).toBe(state)
  })
})
