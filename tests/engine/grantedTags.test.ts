import { describe, it, expect } from 'vitest'
import type { ActiveRelic, DraftedWizard, Role, Wizard } from '@/types'
import { tagsOf } from '@/game/engine/roster'
import { signalActive, signalCount, signalGrade, duoProgress, detectDuos, tier2Contributors, tier2Of } from '@/game/engine/duos'
import { detectSynergies } from '@/game/engine/synergy'
import { keywordDamageMult } from '@/game/engine/relics'
import { teamDarkMagic } from '@/game/engine/darkMagic'
import { teamAlwaysHit } from '@/game/engine/alwaysHit'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { SPELL_BY_ID } from '@/data/spells'

/** DraftedWizard minimale ma REALE (stessa forma di tests/engine/duoTrace.test.ts): il motore
 *  vuole `wizard` completo, `stats`, `maxHp`, `spell` (Spell, non spellId). `grantedTags` è il
 *  campo nuovo: tag guadagnati a runtime (il Marchio delle Spoglie). */
function dw(
  id: string,
  role: Role,
  tags: string[],
  opts: { granted?: string[]; spellId?: string; tier?: number; hp?: number; atk?: number; def?: number; spd?: number } = {},
): DraftedWizard {
  const s = { hp: opts.hp ?? 100, atk: opts.atk ?? 20, def: opts.def ?? 0, spd: opts.spd ?? 10 }
  const spellId = opts.spellId ?? 'base_attack'
  const wizard = {
    id, name: id, house: 'Grifondoro', role, tier: opts.tier ?? 1, gender: 'm' as const,
    ranges: { hp: [s.hp, s.hp], atk: [s.atk, s.atk], def: [s.def, s.def], spd: [s.spd, s.spd] },
    spellPool: [spellId], tags,
  } as unknown as Wizard
  return {
    wizard, stats: s, maxHp: s.hp, spell: SPELL_BY_ID[spellId]!,
    ...(opts.granted ? { grantedTags: opts.granted } : {}),
  } as unknown as DraftedWizard
}

const NO_RELICS: ActiveRelic[] = []

describe('tagsOf — i tag effettivi di un mago arruolato', () => {
  it('senza grantedTags restituisce esattamente i tag nativi, nello stesso ordine', () => {
    expect(tagsOf(dw('a', 'Attaccante', ['veleno', 'esecuzione']))).toEqual(['veleno', 'esecuzione'])
  })

  it('un mago senza tag nativi né concessi ha zero tag', () => {
    expect(tagsOf(dw('a', 'Attaccante', []))).toEqual([])
    expect(tagsOf({ ...dw('a', 'Attaccante', []), wizard: { ...dw('a', 'Attaccante', []).wizard, tags: undefined } } as DraftedWizard)).toEqual([])
  })

  it('unisce i concessi ai nativi senza perdere i nativi', () => {
    expect(tagsOf(dw('a', 'Attaccante', ['esecuzione'], { granted: ['veleno'] })))
      .toEqual(['esecuzione', 'veleno'])
  })

  it('deduplica: un tag concesso che il mago ha già non compare due volte', () => {
    expect(tagsOf(dw('a', 'Attaccante', ['veleno'], { granted: ['veleno'] }))).toEqual(['veleno'])
    expect(tagsOf(dw('a', 'Attaccante', ['veleno', 'esecuzione'], { granted: ['veleno', 'magieOscure', 'veleno'] })))
      .toEqual(['veleno', 'esecuzione', 'magieOscure'])
  })

  it('ordine deterministico: prima i nativi, poi i concessi in ordine di concessione', () => {
    const d = dw('a', 'Attaccante', ['scudirigen'], { granted: ['magieOscure', 'veleno'] })
    expect(tagsOf(d)).toEqual(['scudirigen', 'magieOscure', 'veleno'])
    expect(tagsOf(d)).toEqual(tagsOf(d)) // stabile fra chiamate
  })

  it('è puro: non muta il mago né i suoi array', () => {
    const d = dw('a', 'Attaccante', ['veleno'], { granted: ['esecuzione'] })
    tagsOf(d)
    expect(d.wizard.tags).toEqual(['veleno'])
    expect(d.grantedTags).toEqual(['esecuzione'])
  })
})

describe('un tag concesso accende i segnali Duo come uno nativo', () => {
  // 2 maghi veleno = segnale acceso. Qui uno dei due lo è solo per concessione.
  const nativo = dw('nativo', 'Attaccante', ['veleno'])
  const concesso = dw('concesso', 'Supporto', [], { granted: ['veleno'] })
  const nudo = dw('nudo', 'Supporto', [])

  it('signalActive: nativo + concesso accende veleno; nativo + nudo no', () => {
    expect(signalActive('veleno', [nativo, concesso], NO_RELICS)).toBe(true)
    expect(signalActive('veleno', [nativo, nudo], NO_RELICS)).toBe(false)
  })

  it('signalCount: il concesso conta nel have', () => {
    expect(signalCount('veleno', [nativo, concesso], NO_RELICS)).toEqual({ have: 2, need: 2, byRelic: false })
    expect(signalCount('veleno', [nativo, nudo], NO_RELICS)).toEqual({ have: 1, need: 2, byRelic: false })
  })

  it('duoProgress: il Marchio completa CANCRENA (veleno + esecuzione)', () => {
    // squadra con esecuzione già acceso (2 maghi esecuzione) e UN solo mago veleno nativo
    const a = dw('a', 'Attaccante', ['esecuzione', 'veleno'])
    const b = dw('b', 'Tank', ['esecuzione'])
    const before = duoProgress([a, b], NO_RELICS).find(p => p.duo.id === 'cancrena')!
    expect(before.active).toBe(false)
    expect(before.missing).toEqual(['veleno'])

    // stesso b, ma col veleno CONCESSO → cancrena si accende
    const bMarchiato = { ...b, grantedTags: ['veleno'] } as DraftedWizard
    const after = duoProgress([a, bMarchiato], NO_RELICS).find(p => p.duo.id === 'cancrena')!
    expect(after.active).toBe(true)
    expect(after.missing).toEqual([])

    expect(detectDuos([a, bMarchiato], NO_RELICS).map(x => x.duo.id)).toContain('cancrena')
    expect(detectDuos([a, b], NO_RELICS).map(x => x.duo.id)).not.toContain('cancrena')
  })
})

describe('un tag concesso conta per sinergie e keywordMult', () => {
  // Tossicità: 3 maghi veleno.
  const team2Nativi1Concesso = [
    dw('v1', 'Attaccante', ['veleno']),
    dw('v2', 'Supporto', ['veleno']),
    dw('v3', 'Tank', [], { granted: ['veleno'] }),
  ]
  const team2Nativi = [
    dw('v1', 'Attaccante', ['veleno']),
    dw('v2', 'Supporto', ['veleno']),
    dw('v3', 'Tank', []),
  ]

  it('detectSynergies vede il tag concesso (Tossicità con 2 nativi + 1 marchiato)', () => {
    expect(detectSynergies(team2Nativi1Concesso).map(s => s.synergy.id)).toContain('tossicita')
    expect(detectSynergies(team2Nativi).map(s => s.synergy.id)).not.toContain('tossicita')
  })

  // Ex-`synergyProgress` (rimossa con la Fase 2 del piano "Un solo asse"): il conteggio
  // parziale che alimenta la barra "2/3" del pannello vive ora nel modello dei segnali.
  it('il conteggio del grado 2 include il tag concesso', () => {
    const tier = tier2Of('veleno')!
    const members = tier2Contributors(tier, team2Nativi1Concesso)
    expect(members).toHaveLength(3)
    expect(members.map(d => d.wizard.id)).toContain('v3')
    expect(signalGrade('veleno', team2Nativi1Concesso, NO_RELICS)).toBe(2)
    expect(tier2Contributors(tier, team2Nativi)).toHaveLength(2)
    expect(signalGrade('veleno', team2Nativi, NO_RELICS)).toBe(1)
  })

  it('keywordDamageMult sale grazie al tag concesso', () => {
    const conMarchio = keywordDamageMult(
      team2Nativi1Concesso, NO_RELICS, detectSynergies(team2Nativi1Concesso), 'veleno',
    )
    const senza = keywordDamageMult(team2Nativi, NO_RELICS, detectSynergies(team2Nativi), 'veleno')
    expect(senza).toBe(1)
    expect(conMarchio).toBeGreaterThan(1)
  })
})

describe('un tag concesso conta negli altri consumatori di tag del motore', () => {
  it('teamDarkMagic: il mago marchiato magieOscure riceve il bonus di Oscurità', () => {
    const team = [
      dw('d1', 'Attaccante', ['magieOscure']),
      dw('d2', 'Supporto', ['magieOscure']),
      dw('d3', 'Tank', [], { granted: ['magieOscure'] }),
    ]
    const syn = detectSynergies(team)
    expect(syn.map(s => s.synergy.id)).toContain('oscurita')
    const map = teamDarkMagic(team, NO_RELICS, syn)
    expect(map['d3']!.bonus).toBeGreaterThan(0)
    expect(map['d3']!.bonus).toBe(map['d1']!.bonus) // identico a un nativo
  })

  it('teamAlwaysHit: il tag infallibile concesso vale come nativo (tier >= 2)', () => {
    const marchiato = dw('m', 'Attaccante', [], { granted: ['infallibile'], tier: 2 })
    const basso = dw('b', 'Attaccante', [], { granted: ['infallibile'], tier: 1 })
    const ids = teamAlwaysHit([marchiato, basso], NO_RELICS)
    expect(ids.has('m')).toBe(true)
    expect(ids.has('b')).toBe(false) // il gate tier resta
  })
})

describe('END-TO-END: dal tag concesso a un effetto REALE in battaglia', () => {
  // Il rischio n.1 del piano: la UI dice "CANCRENA attiva" e il motore non la accende.
  // Qui si parte dai tag della squadra e si arriva alle righe di log della simulazione:
  // l'UNICA differenza fra i due rami è `grantedTags`.
  const foe = () => [dw('foe', 'Attaccante', [], { hp: 200, atk: 3, spd: 1 })]
  const velenoso = dw('vel', 'Attaccante', ['veleno', 'esecuzione'], { spellId: 'serpensortia', atk: 12 })
  const compagno = dw('exe', 'Attaccante', ['esecuzione'], { atk: 1, spd: 1 })
  const compagnoMarchiato = { ...compagno, grantedTags: ['veleno'] } as DraftedWizard

  it('col Marchio la squadra accende CANCRENA e i tick di veleno vengono amplificati in battaglia', () => {
    const team = [velenoso, compagnoMarchiato]
    const duos = detectDuos(team, NO_RELICS)
    expect(duos.map(d => d.duo.id)).toEqual(['cancrena'])

    const res = simulateBattle(team, foe(), createRng('granted-cancrena'), { leftDuos: duos })
    const marked = res.log.filter(e => e.duoId === 'cancrena')
    expect(marked.length).toBeGreaterThan(0)
    expect(marked.every(e => e.flags.includes('duo'))).toBe(true)
  })

  it('senza il Marchio la stessa identica squadra NON accende CANCRENA e nessuna riga è amplificata', () => {
    const team = [velenoso, compagno]
    const duos = detectDuos(team, NO_RELICS)
    expect(duos).toEqual([])

    const res = simulateBattle(team, foe(), createRng('granted-cancrena'), { leftDuos: duos })
    expect(res.log.some(e => e.duoId === 'cancrena')).toBe(false)
  })
})

describe('nessun cambio di comportamento senza grantedTags', () => {
  it('squadre senza grantedTags si comportano esattamente come prima', () => {
    const team = [dw('a', 'Attaccante', ['veleno']), dw('b', 'Supporto', ['veleno'])]
    expect(signalActive('veleno', team, NO_RELICS)).toBe(true)
    expect(signalCount('veleno', team, NO_RELICS)).toEqual({ have: 2, need: 2, byRelic: false })
    expect(detectSynergies(team).map(s => s.synergy.id)).not.toContain('tossicita')
    expect(teamAlwaysHit(team, NO_RELICS).size).toBe(0)
  })
})
