// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { fireLine, linesOf, withParam, paramFor, continuoMods, applyStaticContinuo } from '@/game/engine/rt/abilities'
import { enqueue, processQueue, fireInizio, fireSoglie, fireOgniSecondi } from '@/game/engine/rt/triggers'
import { effectiveCd, dannoMult } from '@/game/engine/rt/effects'
import { dealDamage } from '@/game/engine/rt/damage'
import { koUnit } from '@/game/engine/rt/status'
import { createRng } from '@/game/engine/rng'
import { ability, squad as squadRaw } from './fixtures'
import type { AbilityLine, RtUnitInput } from '@/types/rt'

// def 0 per tutti → Scudo iniziale 0, così le attese su scudo/cura non vengono falsate (hp 100, cd 5).
const Z = { hp: 100, atk: 20, def: 0, spd: 20 }
const squad = (...overs: (Partial<RtUnitInput> | undefined)[]) => squadRaw(...overs.map(o => (o ? { stats: Z, ...o } : o)))
const line = (over: Partial<AbilityLine>): AbilityLine => ({ trigger: 'lancio', target: 'se', effect: { kind: 'scudo', n: 10 }, ...over })

describe('linesOf / params', () => {
  it('lv4 aggiunge la riga, extraLines sempre', () => {
    const s = createState(squad({ id: 'a', ability: ability([line({})], line({ effect: { kind: 'cura', n: 5 } })), extraLines: [line({ trigger: 'inizio' })] }), squad({}), createRng(1))
    const a = unitAt(s, 'left', 0)!
    expect(linesOf(a)).toHaveLength(2)
    a.level = 4
    expect(linesOf(a).map(l => l.key)).toEqual(['left:a#0', 'left:a#lv4', 'left:a#x0'])
  })
  it('paramFor e withParam', () => {
    const l = line({ params: [1, 2, 3], effect: { kind: 'gelo', secondi: 9 } })
    expect(paramFor(l, 1)).toBe(1); expect(paramFor(l, 3)).toBe(3); expect(paramFor(l, 4)).toBe(3)
    expect(withParam(l.effect, 2)).toEqual({ kind: 'gelo', secondi: 2 })
    expect(withParam({ kind: 'innesco' }, 2)).toEqual({ kind: 'innesco' })
  })
})

describe('fireLine', () => {
  it('rispetta cond, perBattle ed everySeconds, applica il param del livello', () => {
    const s = createState(squad({ id: 'a', level: 2, ability: ability([line({ effect: { kind: 'scudo', n: 1 }, params: [10, 20, 30], cond: { hpPropriaSotto: 0.5 }, limit: { perBattle: 2 } })]) }), squad({}), createRng(1))
    const a = unitAt(s, 'left', 0)!; const L = linesOf(a)[0]!
    expect(fireLine(s, a, 'left', L.line, L.key, L.abilityId, {})).toBe(false)
    s.sides[0].hp = 10
    expect(fireLine(s, a, 'left', L.line, L.key, L.abilityId, {})).toBe(true); expect(s.sides[0].shield).toBe(20)
    fireLine(s, a, 'left', L.line, L.key, L.abilityId, {})
    expect(fireLine(s, a, 'left', L.line, L.key, L.abilityId, {})).toBe(false)   // perBattle 2
    expect(s.events.filter(e => e.kind === 'trigger' && e.abilityId === 'abil')).toHaveLength(2)
    const s2 = createState(squad({ id: 'a', ability: ability([line({ limit: { everySeconds: 4 } })]) }), squad({}), createRng(1))
    const a2 = unitAt(s2, 'left', 0)!; const L2 = linesOf(a2)[0]!
    expect(fireLine(s2, a2, 'left', L2.line, L2.key, L2.abilityId, {})).toBe(true)
    s2.t = 3; expect(fireLine(s2, a2, 'left', L2.line, L2.key, L2.abilityId, {})).toBe(false)
    s2.t = 4; expect(fireLine(s2, a2, 'left', L2.line, L2.key, L2.abilityId, {})).toBe(true)
  })
  it('riga di lato (mods.lines) con owner null usa la squadra come bersaglio', () => {
    const s = createState(squad({ id: 'a' }, { id: 'a2' }), squad({}), createRng(1), { leftMods: { lines: [line({ trigger: 'inizio', target: 'tuttiAlleati', effect: { kind: 'protego' } })] } })
    fireInizio(s)
    expect(unitAt(s, 'left', 0)!.statuses).toEqual([{ kind: 'protego', remaining: 1 }]); expect(unitAt(s, 'left', 1)!.statuses).toHaveLength(1)
  })
})

describe('continuo', () => {
  it('dannoPct/cdPct/cdFlat da righe Continuo con cond, per i bersagli inclusi', () => {
    const s = createState(squad(
      { id: 'a', ability: ability([line({ trigger: 'continuo', target: 'adiacenti', effect: { kind: 'dannoPct', pct: 0.2 }, cond: { inSquadra: { wizardId: 'c' } } })]) },
      { id: 'b' }, { id: 'c', ability: ability([line({ trigger: 'continuo', target: 'se', effect: { kind: 'cdFlat', secondi: -1 } })]) }), squad({}), createRng(1))
    const a = unitAt(s, 'left', 0)!, b = unitAt(s, 'left', 1)!, c = unitAt(s, 'left', 2)!
    expect(continuoMods(s, b)).toEqual({ dannoPct: 0.2, cdPct: 0, cdFlat: 0 })
    expect(continuoMods(s, a).dannoPct).toBe(0)
    expect(effectiveCd(s, c)).toBe(4)
    c.ko = true
    expect(continuoMods(s, b).dannoPct).toBe(0)   // cond inSquadra c falsa
  })
  it('dannoPct su squadraNemica = il nemico subisce di più', () => {
    const s = createState(squad({ id: 'a', ability: ability([line({ trigger: 'continuo', target: 'squadraNemica', effect: { kind: 'dannoPct', pct: 0.1 } })]) }), squad({ id: 'b', stats: { hp: 200, atk: 1, def: 0, spd: 1 } }), createRng(1))
    dealDamage(s, unitAt(s, 'left', 0), 'right', 100, { diretto: true })
    expect(s.sides[1].hp).toBe(200 - 110)
  })
  it('applyStaticContinuo applica hpPct/scudoIniziale/immune/copre/durataStatusPct una volta', () => {
    const s = createState(squad(
      { id: 'a', ability: ability([line({ trigger: 'continuo', target: 'squadraPropria', effect: { kind: 'hpPct', pct: 0.1 } }), line({ trigger: 'continuo', target: 'se', effect: { kind: 'durataStatusPct', status: 'gelo', pct: 0.5 } })]) }), squad({}), createRng(1))
    const hp = s.sides[0].hpMax
    applyStaticContinuo(s); applyStaticContinuo(s)
    expect(s.sides[0].hpMax).toBe(Math.round(hp * 1.1)); expect(s.sides[0].durataStatusPct.gelo).toBe(0.5)
  })
})

describe('coda trigger', () => {
  it('processQueue esegue le righe con quel trigger; anti-loop a profondità 8', () => {
    const s = createState(squad({ id: 'a', ability: ability([line({ trigger: 'koAlleato', target: 'se', effect: { kind: 'scudo', n: 5 } })]) }, { id: 'b' }), squad({}), createRng(1))
    enqueue(s, { trigger: 'koAlleato', side: 'left', unitKey: 'left:a' })
    processQueue(s)
    expect(s.sides[0].shield).toBe(5)
    // innesco non ri-accoda: finisce in pendingInnesco
    const s2 = createState(squad({ id: 'x', ability: ability([line({ trigger: 'lancio', target: 'se', effect: { kind: 'innesco' } })]) }), squad({}), createRng(1))
    for (let i = 0; i < 20; i++) enqueue(s2, { trigger: 'lancio', side: 'left', unitKey: 'left:x' })
    processQueue(s2)
    expect(s2.pendingInnesco.length).toBeGreaterThan(0)
    expect(s2.depth).toBe(0)
  })
  it('anti-loop: KO ↔ Rianima all\'infinito si ferma a profondità 8', () => {
    // sinistra: a ogni KO nemico fa KO all'opposto; destra: a ogni KO alleato rianima il KO con slot più basso → ping-pong infinito.
    const rianima = ability([line({ trigger: 'koAlleato', target: 'alleatoSlotMinimo', effect: { kind: 'rianima' } })], undefined, 'rianima')
    const s = createState(
      squad({ id: 'k', ability: ability([line({ trigger: 'koNemico', target: 'opposto', effect: { kind: 'ko' } })], undefined, 'boia') }),
      squad({ id: 'r0', ability: rianima }, { id: 'r1', ability: rianima }),
      createRng(1))
    koUnit(s, unitAt(s, 'right', 0)!, unitAt(s, 'left', 0)!)   // innesca: koNemico per k, koAlleato per r1
    processQueue(s)
    const anti = s.events.find(e => e.kind === 'trigger' && e.name === 'anti-loop')
    expect(anti).toBeDefined(); expect(anti!.value).toBeGreaterThan(0)
    expect(s.events.filter(e => e.kind === 'ko').length).toBeGreaterThanOrEqual(8)
    expect(s.queue).toHaveLength(0); expect(s.depth).toBe(0)
  })
  it('fireSoglie scatta una volta per riga; fireOgniSecondi ai multipli', () => {
    const s = createState(squad({ id: 'a', ability: ability([line({ trigger: 'sottoSoglia', target: 'se', effect: { kind: 'multicast', n: 1, durata: 'battaglia' }, cond: { hpPropriaSotto: 0.5 } }), line({ trigger: 'ogniSecondi', target: 'squadraPropria', effect: { kind: 'cura', n: 3 }, limit: { everySeconds: 4 } })]) }), squad({}), createRng(1))
    const a = unitAt(s, 'left', 0)!
    s.sides[0].hp = 10
    fireSoglie(s); fireSoglie(s)
    expect(a.multicastBonus).toHaveLength(1)
    s.t = 3.9; fireOgniSecondi(s); expect(s.sides[0].hp).toBe(10)
    s.t = 4; fireOgniSecondi(s); expect(s.sides[0].hp).toBe(13)
    s.t = 8; fireOgniSecondi(s); expect(s.sides[0].hp).toBe(16)
  })
})
