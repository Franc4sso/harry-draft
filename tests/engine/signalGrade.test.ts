import { describe, it, expect } from 'vitest'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, Keyword, Synergy } from '@/types'
import { detectDuos, signalActive, signalGrade, SIGNAL_TIERS } from '@/game/engine/duos'
import { detectSynergies } from '@/game/engine/synergy'
import { keywordDamageMult } from '@/game/engine/relics'
import { tagsOf } from '@/game/engine/roster'

// Fabbrica minima (stessa forma di tests/engine/duos.test.ts), più i tag CONCESSI a runtime
// dalle Spoglie della Vittoria — devono contare come i nativi anche per il grado 2.
const dw = (id: string, role: string, tags: string[] = [], grantedTags?: string[]): DraftedWizard =>
  ({ wizard: { id, role, house: 'Grifondoro', tags }, level: 1, grantedTags } as unknown as DraftedWizard)
const relic = (r: Partial<ActiveRelic['relic']>): ActiveRelic =>
  ({ relic: { id: r.id ?? 'x', name: '', desc: '', rarity: 'comune', ...r } } as ActiveRelic)

const gradeOf = (team: DraftedWizard[], relics: ActiveRelic[] = []) =>
  signalGrade('veleno', team, relics)

describe('grado 2 del segnale (l\'ex Sinergia)', () => {
  it('scatta a 3 maghi col tag e dà lo stesso keywordMult di prima (+0.5)', () => {
    const team = [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno']), dw('c', 'Supporto', ['veleno'])]
    expect(gradeOf(team)).toBe(2)
    expect(detectSynergies(team).map(s => s.synergy.id)).toContain('tossicita')
    expect(keywordDamageMult(team, [], detectSynergies(team), 'veleno')).toBeCloseTo(1.5, 10)
  })

  it('2 maghi = grado 1: i Duo si accendono ma NON c\'è bonus alla parola chiave', () => {
    const team = [
      dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno']),
      dw('c', 'Attaccante', ['esecuzione']), dw('d', 'Supporto', ['esecuzione']),
    ]
    expect(signalGrade('veleno', team, [])).toBe(1)
    expect(signalGrade('esecuzione', team, [])).toBe(1)
    // Duo abilitati: veleno + esecuzione = Cancrena.
    expect(detectDuos(team, []).map(d => d.duo.id)).toContain('cancrena')
    // ...ma nessun grado 2, quindi nessun moltiplicatore.
    const syn = detectSynergies(team)
    expect(syn).toHaveLength(0)
    expect(keywordDamageMult(team, [], syn, 'veleno')).toBe(1)
    expect(keywordDamageMult(team, [], syn, 'esecuzione')).toBe(1)
  })

  it('una reliquia accende il grado 1 ma NON porta al grado 2', () => {
    const carnefice = relic({ id: 'r-exec', grantsExecute: { threshold: 0.3, bonus: 0.4 } })
    // Da sola, senza nemmeno un mago col tag: accende (grado 1), non potenzia.
    const solo = [dw('a', 'Tank')]
    expect(signalActive('esecuzione', solo, [carnefice])).toBe(true)
    expect(signalGrade('esecuzione', solo, [carnefice])).toBe(1)
    expect(detectSynergies(solo).map(s => s.synergy.id)).not.toContain('spietatezza')
    expect(keywordDamageMult(solo, [carnefice], detectSynergies(solo), 'esecuzione')).toBe(1)

    // Nemmeno come "terzo membro": 2 maghi col tag + 1 reliquia restano grado 1.
    const due = [dw('a', 'Attaccante', ['esecuzione']), dw('b', 'Tank', ['esecuzione'])]
    expect(signalGrade('esecuzione', due, [carnefice])).toBe(1)
    expect(detectSynergies(due)).toHaveLength(0)
  })

  it('un tag CONCESSO (grantedTags, Spoglie della Vittoria) conta per il grado 2', () => {
    const team = [
      dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno']),
      dw('c', 'Supporto', [], ['veleno']),
    ]
    expect(tagsOf(team[2]!)).toContain('veleno')
    expect(gradeOf(team)).toBe(2)
    expect(detectSynergies(team).map(s => s.synergy.id)).toContain('tossicita')
    expect(detectSynergies(team)[0]!.memberIds).toEqual(['a', 'b', 'c'])
    expect(keywordDamageMult(team, [], detectSynergies(team), 'veleno')).toBeCloseTo(1.5, 10)
  })
})

/* ── Equivalenza col sistema vecchio ──────────────────────────────────────────────────────
 * Riferimento: la copia LETTERALE del vecchio `SYNERGIES` + del vecchio `membersFor`
 * (data/synergies.ts e game/engine/synergy.ts prima della fusione del 2026-07-25). Per ogni
 * squadra di prova il moltiplicatore keyword risultante deve essere identico. */
const OLD_SYNERGIES: Synergy[] = [
  { id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { keywordMult: { veleno: 0.5 } } },
  { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { keywordMult: { esecuzione: 0.5 } } },
  { id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: { keywordMult: { scudo: 0.5 } } },
  { id: 'oscurita', name: 'Oscurità', kind: 'origin', requires: { tag: 'magieOscure', count: 3 }, bonus: { keywordMult: { magieOscure: 0.5 } } },
]

function oldMembersFor(syn: Synergy, team: DraftedWizard[]): string[] | null {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) {
    const have = team.filter(d => req.ids!.includes(d.wizard.id))
    return have.length === req.ids.length ? have.map(d => d.wizard.id) : null
  }
  const count = req.count ?? 3
  const matched = team.filter(d =>
    (req.house ? d.wizard.house === req.house : true) &&
    (req.role ? d.wizard.role === req.role : true) &&
    (req.tag ? tagsOf(d).includes(req.tag) : true),
  )
  return matched.length >= count ? matched.map(d => d.wizard.id) : null
}

function oldDetectSynergies(team: DraftedWizard[]): ActiveSynergy[] {
  const out: ActiveSynergy[] = []
  for (const syn of OLD_SYNERGIES) {
    const members = oldMembersFor(syn, team)
    if (members) out.push({ synergy: syn, memberIds: members })
  }
  return out
}

const KEYWORDS: Keyword[] = ['veleno', 'esecuzione', 'scudo', 'magieOscure']

const CASES: { name: string; team: DraftedWizard[]; relics: ActiveRelic[] }[] = [
  { name: 'squadra vuota', team: [], relics: [] },
  { name: '1 veleno', team: [dw('a', 'Attaccante', ['veleno'])], relics: [] },
  { name: '2 veleno (grado 1)', team: [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno'])], relics: [] },
  {
    name: '3 veleno (grado 2)',
    team: [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno']), dw('c', 'Supporto', ['veleno'])],
    relics: [],
  },
  {
    name: '3 veleno + reliquia veleno (stack reliquia+grado 2)',
    team: [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno']), dw('c', 'Supporto', ['veleno'])],
    relics: [relic({ id: 'ampolla', keywords: ['veleno'], keywordMult: { veleno: 0.5 } })],
  },
  {
    name: '2 veleno + reliquia veleno (la reliquia non porta al grado 2)',
    team: [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno'])],
    relics: [relic({ id: 'ampolla', keywords: ['veleno'], keywordMult: { veleno: 0.5 } })],
  },
  {
    name: '3 esecuzione',
    team: [dw('a', 'Attaccante', ['esecuzione']), dw('b', 'Tank', ['esecuzione']), dw('c', 'Controllo', ['esecuzione'])],
    relics: [],
  },
  {
    name: '3 scudirigen',
    team: [dw('a', 'Tank', ['scudirigen']), dw('b', 'Tank', ['scudirigen']), dw('c', 'Supporto', ['scudirigen'])],
    relics: [],
  },
  {
    name: '3 magieOscure',
    team: [dw('a', 'Attaccante', ['magieOscure']), dw('b', 'Controllo', ['magieOscure']), dw('c', 'Supporto', ['magieOscure'])],
    relics: [],
  },
  {
    name: '3 veleno di cui 1 con tag concesso',
    team: [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno']), dw('c', 'Supporto', [], ['veleno'])],
    relics: [],
  },
  {
    name: 'doppio grado 2 (veleno + esecuzione) su maghi bi-tag',
    team: [
      dw('a', 'Attaccante', ['veleno', 'esecuzione']),
      dw('b', 'Tank', ['veleno', 'esecuzione']),
      dw('c', 'Controllo', ['veleno', 'esecuzione']),
    ],
    relics: [],
  },
  {
    name: 'squadra mista senza nessun grado 2',
    team: [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['scudirigen']), dw('c', 'Supporto', ['magieOscure'])],
    relics: [relic({ id: 'diadema', keywords: ['magieOscure'], keywordMult: { magieOscure: 0.5 } })],
  },
]

describe('equivalenza col vecchio sistema di Sinergie', () => {
  it.each(CASES)('$name: stesso keywordMult su tutte le parole chiave', ({ team, relics }) => {
    for (const kw of KEYWORDS) {
      expect(keywordDamageMult(team, relics, detectSynergies(team), kw))
        .toBe(keywordDamageMult(team, relics, oldDetectSynergies(team), kw))
    }
  })

  it.each(CASES)('$name: stessi id attivi, nello stesso ordine', ({ team }) => {
    expect(detectSynergies(team).map(s => s.synergy.id))
      .toEqual(oldDetectSynergies(team).map(s => s.synergy.id))
  })

  it.each(CASES)('$name: stessi memberIds', ({ team }) => {
    expect(detectSynergies(team).map(s => s.memberIds))
      .toEqual(oldDetectSynergies(team).map(s => s.memberIds))
  })

  it('la tabella dei gradi 2 riproduce esattamente il vecchio SYNERGIES', () => {
    expect(SIGNAL_TIERS.map(t => ({ id: t.id, name: t.name, tag: t.tag, need: t.need, mult: t.mult })))
      .toEqual(OLD_SYNERGIES.map(s => ({
        id: s.id, name: s.name, tag: s.requires.tag!, need: s.requires.count!,
        mult: Object.values(s.bonus.keywordMult!)[0]!,
      })))
  })
})
