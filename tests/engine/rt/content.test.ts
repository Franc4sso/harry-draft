// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { simulateTeams } from '@/game/engine/rt/adapter'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS, WIZARD_BY_ID } from '@/data/wizards'
import { ABILITIES } from '@/data/abilities'
import type { DraftedWizard } from '@/types'

const dw = (id: string, seed = 1, level = 1) => ({ ...draftWizard(createRng(seed), WIZARD_BY_ID[id]!), level })
const team = (...ids: string[]) => ids.map((id, i) => dw(id, i + 1))
const dummies = (n: number, hp = 400) => Array.from({ length: n }, (_, i) => ({ ...dw('goyle', 100 + i), stats: { hp, atk: 1, def: 0, spd: 1 } }))
const ev = (r: ReturnType<typeof simulateTeams>, kind: string, name?: string) => r.events.filter(e => e.kind === kind && (!name || e.name === name))
/** L'adapter legge un campo `slot` ad hoc su DraftedWizard (vedi `toRtSide`): qui lo si attacca in modo tipato. */
const at = (d: ReturnType<typeof dw>, slot: number): DraftedWizard => Object.assign(d, { slot }) as DraftedWizard

describe('catene di §5', () => {
  it('Weasley-motore: Fred e George si innescano a vicenda, Arthur carica', () => {
    const l = team('arthur', 'fred', 'george', 'ginny', 'molly', 'ron')
    const r = simulateTeams(l, dummies(3, 2000), createRng(1), { maxSeconds: 20 })
    expect(ev(r, 'innesco').length).toBeGreaterThanOrEqual(2)
    expect(ev(r, 'carica').length).toBeGreaterThanOrEqual(2)
  })
  it('Mangiamorte-KO: sotto il 30% Voldemort fa KO', () => {
    const l = team('lucius', 'bellatrix', 'voldemort', 'snape')
    const r = simulateTeams(l, dummies(3, 300), createRng(2), { maxSeconds: 40 })
    expect(ev(r, 'ko').length).toBeGreaterThanOrEqual(1)
  })
  it('Gelo-frantuma: Cho/Terry gelano, Viktor frantuma', () => {
    const l = team('cho', 'terry', 'viktor', 'michael')
    const r = simulateTeams(l, dummies(3, 1500), createRng(3), { maxSeconds: 30 })
    expect(ev(r, 'reazione', 'Frantuma').length).toBeGreaterThanOrEqual(1)
  })
  it('Veleno: Snape/Draco stack, Dolohov innesca Miasma', () => {
    const l = team('snape', 'draco', 'dolohov', 'blaise')
    const r = simulateTeams(l, dummies(3, 1500), createRng(4), { maxSeconds: 30 })
    expect(ev(r, 'reazione', 'Miasma').length).toBeGreaterThanOrEqual(1)
    expect(r.frames.at(-1)!.segni[1].veleno).toBeGreaterThan(0)
  })
  it('Corvonero-deflagrazione: Michael/Flitwick scossa + Fleur fiamma', () => {
    const l = team('flitwick', 'michael', 'fleur', 'terry')
    const r = simulateTeams(l, dummies(3, 1500), createRng(5), { maxSeconds: 30 })
    expect(ev(r, 'reazione', 'Deflagrazione').length).toBeGreaterThanOrEqual(1)
  })
  it('Tassorosso-muro: scudo continuo, Baluardo sulle cure', () => {
    const l = team('ernie', 'eloise', 'cedric', 'sprout', 'hannah')
    const r = simulateTeams(l, dummies(3, 1500), createRng(6), { maxSeconds: 30 })
    expect(ev(r, 'scudo').length).toBeGreaterThanOrEqual(3)
    expect(ev(r, 'reazione', 'Baluardo').length).toBeGreaterThanOrEqual(1)
  })
  it('Trio d\'oro: Hermione carica Harry davanti', () => {
    const l = [at(dw('harry', 1), 1), at(dw('hermione', 2), 4), at(dw('ron', 3), 0)]
    const r = simulateTeams(l, dummies(3, 1500), createRng(7), { maxSeconds: 20 })
    expect(ev(r, 'carica').some(e => e.targetSlot === 1)).toBe(true)
  })
})

describe('mono-casa 6v6: finisce, entrambi lanciano, nessuna eccezione', () => {
  const HOUSES = { Grifondoro: ['harry', 'ron', 'hermione', 'ginny', 'neville', 'seamus'], Serpeverde: ['snape', 'draco', 'bellatrix', 'greyback', 'narcissa', 'pansy'], Corvonero: ['flitwick', 'cho', 'viktor', 'luna', 'kingsley', 'michael'], Tassorosso: ['cedric', 'sprout', 'ernie', 'tonks', 'hannah', 'justin'] }
  for (const [h, ids] of Object.entries(HOUSES)) it(h, () => {
    const r = simulateTeams(team(...ids), team('voldemort', 'lucius', 'dolohov', 'goyle', 'crabbe', 'theodore'), createRng(11))
    expect(['left', 'right']).toContain(r.winner)
    expect(ev(r, 'cast').some(e => e.side === 'left')).toBe(true); expect(ev(r, 'cast').some(e => e.side === 'right')).toBe(true)
  })
})

describe('copertura: ogni riga di ogni abilità scatta almeno una volta in una sonda', () => {
  // Sonda per RIGA (non per abilità): ogni riga con trigger diverso da 'vittoria' e 'continuo' deve emettere
  // un evento `trigger` con il proprio abilityId e il proprio nome di trigger in almeno uno scenario.
  // Le righe `continuo` non emettono `trigger`: per un'abilità di sole righe continuo basta che il mago abbia lanciato.
  // SKIP: solo righe che nessuna singola battaglia può far scattare, con motivazione.
  const SKIP: Record<string, string> = {}
  const needsAlly = (a: typeof ABILITIES[number]) => {
    const out = new Set<string>()
    for (const l of [...a.lines, a.lv4!]) {
      const c = l.cond as Record<string, { wizardId?: string; tag?: string }> | undefined
      const ref = c?.adiacente ?? c?.inSquadra
      if (ref?.wizardId) out.add(ref.wizardId)
      if (ref?.tag) { const w = WIZARDS.find(w => w.id !== a.id && (w.tags ?? []).includes(ref.tag!)); if (w) out.add(w.id) }
      if (l.target === 'alleatiTag' && l.targetArg) { const w = WIZARDS.find(w => w.id !== a.id && (w.tags ?? []).includes(l.targetArg!)); if (w) out.add(w.id) }
      if (l.effect.kind === 'copre') out.add(l.effect.wizardId)
    }
    return [...out]
  }
  // Sei scenari. I primi tre coprono pressione, posizione e isolamento; gli ultimi tre i tre modi in cui
  // una riga può chiedere un KO ('koSubito' sul titolare, 'koAlleato' sui compagni, 'koNemico' sugli avversari).
  // 0: schieramento compatto in prima fila contro manichini (uno debole per KO/soglie, due medi).
  // 1: il titolare in seconda fila (slot 3) con un alleato davanti (slot 0), contro Mangiamorte lv4.
  // 2: il titolare isolato (slot 0, con 1 e 3 vuoti) contro gli stessi Mangiamorte, per le righe "nessun adiacente".
  // 3: MATTATOIO — il titolare in slot 0 con tre manichini di vetro attorno, contro Mangiamorte lv4 fragili ma
  //    devastanti: cadono gli alleati (koAlleato) e alla fine cade anche lui (koSubito).
  // 4: MATTATOIO CON SOGLIA — come 3 ma il titolare dietro (slot 4) e i manichini davanti: i manichini fanno
  //    scendere l'HP nemica sotto il 50% prima di cadere, per le righe koAlleato con `hpNemicaSotto`.
  // 5: MIETITURA — il titolare con Voldemort lv4 alleato contro cinque manichini robusti: la squadra nemica
  //    scende sotto il 30% e Voldemort miete uno slot dopo l'altro, per le righe 'koNemico'.
  const LAYOUTS = [[0, 1, 2, 3, 4, 5], [3, 0, 4, 1, 5, 2], [0, 2, 5, 4, 1, 3], [0, 2, 5, 4, 1, 3], [4, 5, 2, 3, 1, 0], [1, 2, 3, 4, 5, 0]]
  const manichini = () => [{ ...dw('goyle', 50), stats: { hp: 60, atk: 12, def: 0, spd: 20 } }, ...dummies(2, 500).map(d => ({ ...d, stats: { ...d.stats, atk: 15, spd: 15 } }))] as DraftedWizard[]
  // stat tarate: abbastanza vita da arrivare alle soglie di "HP nemica sotto X" delle loro righe di KO,
  // abbastanza poco attacco da non chiudere la battaglia prima (con atk alto la sonda diventa sensibile al seme).
  const mangiamorte = () => ['voldemort', 'lucius', 'bellatrix'].map((x, i) => ({ ...dw(x, 50 + i, 4), slot: i, stats: { hp: 1400, atk: 6, def: 0, spd: 12 } })) as DraftedWizard[]
  // Carnefici: pochissima vita (così l'HP nemica cala in fretta) ma attacco e velocità altissimi,
  // così le righe di KO di Voldemort/Bellatrix mietono la fila avversaria una unità alla volta.
  const carnefici = () => ['voldemort', 'bellatrix', 'moody'].map((x, i) => ({ ...dw(x, 60 + i, 4), slot: i, stats: { hp: 20, atk: 26, def: 0, spd: 38 } })) as DraftedWizard[]
  // Manichini di vetro alleati: muoiono subito ma intanto picchiano.
  const vetro = (slots: number[]) => slots.map((sl, i) => ({ ...dw('goyle', 90 + i), slot: sl, stats: { hp: 60, atk: 8, def: 0, spd: 30 } })) as DraftedWizard[]
  // Bersagli robusti: la squadra nemica scende sotto il 30% senza morire, così Voldemort alleato può mietere.
  const bersagli = () => [0, 1, 2, 3, 4].map(i => ({ ...dw('goyle', 70 + i), slot: i, stats: { hp: 1200, atk: 1, def: 0, spd: 6 } })) as DraftedWizard[]

  for (const a of ABILITIES) it(a.id, () => {
    const w = WIZARD_BY_ID[a.id]!
    const mates = WIZARDS.filter(x => x.house === w.house && x.id !== a.id).slice(0, 2).map(x => x.id)
    const base = [a.id, ...needsAlly(a), ...mates].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 6)
    const scenari: ReturnType<typeof simulateTeams>[] = []
    for (let si = 0; si < LAYOUTS.length; si++) {
      const layout = LAYOUTS[si]!
      // Scenari 3 e 4: solo il titolare, attorniato da manichini sacrificabili (le abilità degli alleati
      // reali — Protego, cure, scudi — terrebbero in vita la squadra e i KO non arriverebbero mai).
      // Scenario 5: Voldemort lv4 subito dopo il titolare, così non viene tagliato dal limite di slot.
      const ids = si === 3 || si === 4 ? [a.id]
        : si === 5 ? [a.id, 'voldemort', ...base.slice(1)].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 5)
        : base
      const l = ids.map((id, i) => ({ ...dw(id, i + 1, id === a.id || (si === 5 && id === 'voldemort') ? 4 : 1), slot: layout[i]! })) as DraftedWizard[]
      if (si === 3) l.push(...vetro([1, 2, 3]))
      if (si === 4) l.push(...vetro([0, 1, 3]))
      const nemici = si === 0 ? manichini() : si === 3 || si === 4 ? carnefici() : si === 5 ? bersagli() : mangiamorte()
      scenari.push(simulateTeams(l, nemici, createRng(99), { maxSeconds: si === 0 ? 40 : 60 }))
    }
    const scattato = (trigger: string) => scenari.some(r => r.events.some(e => e.kind === 'trigger' && e.abilityId === a.id && e.name === trigger))
    const righe = [...a.lines.map((l, i) => [`${a.id}#${i}`, l] as const), ...(a.lv4 ? [[`${a.id}#lv4`, a.lv4] as const] : [])]
    const daSondare = righe.filter(([, l]) => l.trigger !== 'vittoria' && l.trigger !== 'continuo')
    if (!daSondare.length) {
      // Sole righe continuo/vittoria: basta che il mago abbia lanciato in una sonda.
      expect(scenari.some(r => r.events.some(e => e.kind === 'cast' && e.side === 'left')), `${a.id}: nessun lancio`).toBe(true)
      return
    }
    for (const [key, l] of daSondare) {
      if (SKIP[key]) continue
      expect(scattato(l.trigger), `${key} (${l.trigger}): riga mai scattata in nessuno scenario`).toBe(true)
    }
  })
})
