import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import type { ActiveDuo, DraftedWizard, Role } from '@/types'
import { DUO_BY_ID } from '@/data/duos'
import { SPELL_BY_ID } from '@/data/spells'

/** Un mago pronto al combattimento, con la magia passata come firma.
 *  Adattato dal pattern `unit()`/DraftedWizard usato in
 *  tests/engine/duoEffects/esecuzioneAFreddo.test.ts — DraftedWizard reale
 *  vuole `wizard` (Wizard completo), `stats`, `maxHp`, `spell` (Spell, non spellId). */
function dw(id: string, role: Role, spellId: string, stats: Partial<Record<string, number>> = {}): DraftedWizard {
  const s = { hp: stats.hp ?? 100, atk: stats.atk ?? 20, def: stats.def ?? 0, spd: stats.spd ?? 10 }
  return {
    wizard: {
      id, name: id, house: 'Grifondoro', role, tier: 1, gender: 'm' as const,
      ranges: { hp: [s.hp, s.hp], atk: [s.atk, s.atk], def: [s.def, s.def], spd: [s.spd, s.spd] },
      spellPool: [spellId], tags: [],
    },
    stats: s, maxHp: s.hp, spell: SPELL_BY_ID[spellId]!,
  } as unknown as DraftedWizard
}

const duo = (id: string): ActiveDuo[] => [{ duo: DUO_BY_ID[id]! }]

describe('traccia dei Duo nel log', () => {
  it('ESECUZIONE A FREDDO marchia la riga del colpo che giustizia', () => {
    // Un Controllo che stordisce + un Attaccante che finisce: contro un nemico fragile
    // il colpo sotto soglia deve giustiziare, e quella riga deve portare il duoId.
    // ctrl agisce per PRIMO (spd 30 > 10 > 1) e storna il bersaglio senza infliggere
    // danno (petrificus non ha `power`); il colpo di att che segue nello stesso turno
    // lo trova già sotto controllo. atk/hp sono calibrati (vedi tests/engine/_debugDuo
    // di lavoro, poi rimosso) cosi che il colpo pieno E quello critato lascino il
    // bersaglio vivo ma sotto la soglia 0.5, cosi il ramo cold-execute scatta davvero
    // invece di limitarsi a un KO normale.
    const left = [
      dw('ctrl', 'Controllo', 'petrificus', { spd: 30 }),
      dw('att', 'Attaccante', 'base_attack', { atk: 550, spd: 10 }),
    ]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 1000, atk: 5, spd: 1 })]

    const res = simulateBattle(left, right, createRng('duo-cold'), { leftDuos: duo('esecuzione-a-freddo') })

    const marked = res.log.filter(e => e.duoId === 'esecuzione-a-freddo')
    expect(marked.length).toBeGreaterThan(0)
    expect(marked[0]!.flags).toContain('duo')
    expect(marked[0]!.actorSide).toBe('left')
  })

  it('senza il Duo attivo nessuna riga porta un duoId', () => {
    const left = [
      dw('ctrl', 'Controllo', 'petrificus', { spd: 30 }),
      dw('att', 'Attaccante', 'base_attack', { atk: 550, spd: 10 }),
    ]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 1000, atk: 5, spd: 1 })]

    const res = simulateBattle(left, right, createRng('duo-cold'), {}) // nessun leftDuos

    expect(res.log.some(e => e.duoId != null)).toBe(false)
    expect(res.log.some(e => e.flags.includes('duo'))).toBe(false)
  })

  it('CANCRENA marchia il tick di veleno SOLO quando amplifica davvero', () => {
    // Un nemico avvelenato: finché sta sopra il 40% di vita il tick è normale (nessun
    // marchio); appena scende sotto soglia il tick raddoppia e la riga porta il duoId.
    const left = [dw('vel', 'Attaccante', 'serpensortia', { atk: 12 })]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 200, atk: 3, spd: 1 })]

    const res = simulateBattle(left, right, createRng('duo-cancrena'), { leftDuos: duo('cancrena') })

    const dots = res.log.filter(e => e.flags.includes('dot') && e.targetSide === 'right')
    expect(dots.length).toBeGreaterThan(0)

    const marked = dots.filter(e => e.duoId === 'cancrena')
    expect(marked.length).toBeGreaterThan(0)      // sotto soglia: amplificato e marchiato
    expect(marked.every(e => e.flags.includes('duo'))).toBe(true)
    expect(dots.some(e => e.duoId == null)).toBe(true) // sopra soglia: tick normale, non marchiato
  })

  it('MIETITORE marchia la riga KO dell uccisione fatta da un mago del giocatore', () => {
    const left = [dw('att', 'Attaccante', 'base_attack', { atk: 60 })]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 30, atk: 2, spd: 1 })]

    const res = simulateBattle(left, right, createRng('duo-reap'), { leftDuos: duo('mietitore') })

    const ko = res.log.filter(e => e.action === 'KO' && e.targetSide === 'right')
    expect(ko.length).toBeGreaterThan(0)
    expect(ko[0]!.duoId).toBe('mietitore')
    expect(ko[0]!.flags).toContain('duo')
    expect(ko[0]!.flags).toContain('kill') // il flag esistente non va perso
  })

  it('MIASMA emette una riga quando il veleno salta a un altro nemico', () => {
    // Due nemici: uno avvelenato che muore, uno vivo che eredita il veleno.
    const left = [dw('vel', 'Attaccante', 'serpensortia', { atk: 30 })]
    const right = [
      dw('dying', 'Attaccante', 'base_attack', { hp: 30, atk: 2, spd: 1 }),
      dw('heir', 'Attaccante', 'base_attack', { hp: 300, atk: 2, spd: 1 }),
    ]

    const res = simulateBattle(left, right, createRng('duo-miasma'), { leftDuos: duo('miasma') })

    const spread = res.log.filter(e => e.duoId === 'miasma')
    expect(spread.length).toBeGreaterThan(0)
    expect(spread[0]!.flags).toContain('duo')
    expect(spread[0]!.type).toBe('system')
    expect(spread[0]!.value).toBeUndefined() // niente value: non si muovono HP (parità replay)
  })

  it('UNTORE emette una riga quando una cura sputa veleno su un nemico', () => {
    const left = [
      dw('sup', 'Supporto', 'episkey'),
      dw('tank', 'Tank', 'base_attack', { hp: 200 }),
    ]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 300, atk: 25 })]

    const res = simulateBattle(left, right, createRng('duo-untore'), { leftDuos: duo('untore') })

    const spits = res.log.filter(e => e.duoId === 'untore')
    expect(spits.length).toBeGreaterThan(0)
    expect(spits[0]!.flags).toContain('duo')
    expect(spits[0]!.targetSide).toBe('right')
    expect(spits[0]!.value).toBeUndefined()
  })

  it('MURO VIVENTE non emette NESSUNA traccia — scelta di design, non dimenticanza', () => {
    // Muro Vivente impedisce (le retrovie non sono bersagliabili): non esiste un istante
    // da annunciare. Vive solo come pill persistente in arena. Vedi la spec, §4.
    const left = [dw('tank', 'Tank', 'base_attack', { hp: 200 }), dw('att', 'Attaccante', 'base_attack')]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 120 })]

    const res = simulateBattle(left, right, createRng('duo-muro'), { leftDuos: duo('muro-vivente') })

    expect(res.log.some(e => e.duoId === 'muro-vivente')).toBe(false)
  })
})
