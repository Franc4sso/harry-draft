// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { applySegno, applyGelo } from '@/game/engine/rt/segni'
import { applyUnitStatus, hasStatus, koUnit, rianimaUnit, statusOf } from '@/game/engine/rt/status'
import { processQueue } from '@/game/engine/rt/triggers'
import { createRng } from '@/game/engine/rng'
import { squad } from './fixtures'

// Tutte le stat esplicite: def 0 → Scudo iniziale 0, HP 300 per lato (200 + 100).
const A = { hp: 200, atk: 20, def: 0, spd: 20 }, B = { hp: 100, atk: 20, def: 0, spd: 20 }
const mk = (opts = {}) => createState(
  squad({ id: 'a', stats: A }, { id: 'a2', stats: B }),
  squad({ id: 'b', stats: A }, { id: 'b2', stats: B }), createRng(1), opts)

describe('applySegno', () => {
  it('somma stack con cap (Fiamma/Scossa 20, Veleno illimitato) ed emette segno', () => {
    const s = mk()
    applySegno(s, unitAt(s, 'left', 0), 'right', 'fiamma', 15); applySegno(s, null, 'right', 'fiamma', 15)
    applySegno(s, null, 'right', 'veleno', 30); applySegno(s, null, 'right', 'scossa', 25)
    // Deflagrazione scatta su scossa (fiamma=20 è presente), consuma entrambi
    expect(s.sides[1].segni).toEqual({ fiamma: 0, veleno: 30, scossa: 0 })
    expect(s.events[0]).toMatchObject({ kind: 'segno', segno: 'fiamma', stacks: 15, targetSide: 'right', side: 'left', slot: 0 })
  })
  it('Miasma: Fiamma su Veleno (e viceversa) → danno 4×veleno, Veleno resta', () => {
    const s = mk(); s.sides[1].segni.veleno = 5
    applySegno(s, unitAt(s, 'left', 0), 'right', 'fiamma', 1)
    expect(s.sides[1].hp).toBe(280); expect(s.sides[1].segni.veleno).toBe(5); expect(s.reazioni.Miasma).toBe(1)
    applySegno(s, unitAt(s, 'left', 0), 'right', 'veleno', 1)
    expect(s.reazioni.Miasma).toBe(2); expect(s.sides[1].hp).toBe(280 - 24)
  })
  it('Miasma scatta anche senza sorgente (es. Contagio), senza Memoria', () => {
    const s = mk(); s.sides[1].segni.veleno = 5
    applySegno(s, null, 'right', 'fiamma', 1)
    expect(s.sides[1].hp).toBe(280); expect(s.reazioni.Miasma).toBe(1); expect(s.memoriaDelta).toEqual({})
  })
  it('Deflagrazione: Fiamma con Scossa → consuma entrambi, danno 5×somma', () => {
    const s = mk(); s.sides[1].segni.scossa = 3
    applySegno(s, unitAt(s, 'left', 0), 'right', 'fiamma', 2)
    expect(s.sides[1].hp).toBe(300 - 25); expect(s.sides[1].segni).toMatchObject({ fiamma: 0, scossa: 0 }); expect(s.reazioni.Deflagrazione).toBe(1)
  })
  it('Conduzione: Veleno con Scossa → conduzione 4 s (o mods), nessun consumo', () => {
    const s = mk({ leftMods: { conduzioneSecondi: 8 } }); s.sides[1].segni.scossa = 1
    applySegno(s, unitAt(s, 'left', 0), 'right', 'veleno', 1)
    expect(s.sides[1].conduzione).toBe(8); expect(s.sides[1].segni).toMatchObject({ veleno: 1, scossa: 1 })
  })
  it('Vapore: Fiamma su unità gelata → consuma Gelo, Vulnerabile 4 s', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })
    applySegno(s, unitAt(s, 'left', 0), 'right', 'fiamma', 1, { unitTarget: b })
    expect(hasStatus(b, 'gelo')).toBe(false); expect(s.sides[1].vulnerabile).toBe(4); expect(s.reazioni.Vapore).toBe(1)
  })
  it('Necrosi: Veleno su unità gelata → Veleno +3, Gelo +1 s', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })
    applySegno(s, unitAt(s, 'left', 0), 'right', 'veleno', 1, { unitTarget: b })
    expect(s.sides[1].segni.veleno).toBe(4); expect(statusOf(b, 'gelo')!.remaining).toBe(3); expect(s.reazioni.Necrosi).toBe(1)
  })
  it('Memoria: la reazione incrementa il delta della spell con quel trigger', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!
    a.spell = { ...a.spell, crescita: { kind: 'memoria', trigger: 'reazione:miasma', per: 1, unit: 'segno' } }
    s.sides[1].segni.veleno = 1
    applySegno(s, a, 'right', 'fiamma', 1)
    expect(s.memoriaDelta['left:a']).toBe(1)
  })
})

describe('applyGelo e KO', () => {
  it('applyGelo applica e con Esecuzione a Freddo sotto 50% fa KO (non al leader boss)', () => {
    const s = mk({ leftMods: { esecuzioneAFreddo: true } }); const b = unitAt(s, 'right', 0)!; const b2 = unitAt(s, 'right', 1)!
    s.sides[1].hp = 90
    expect(applyGelo(s, unitAt(s, 'left', 0), b, 1)).toBe(true)
    expect(b.ko).toBe(true); expect(s.events.some(e => e.kind === 'ko' && e.targetSlot === 0)).toBe(true)
    b2.bossLeader = true
    applyGelo(s, unitAt(s, 'left', 0), b2, 1)
    expect(b2.ko).toBe(false); expect(hasStatus(b2, 'gelo')).toBe(true)
  })
  it('Esecuzione a Freddo ha un cooldown interno di 4 s: il secondo Gelo nello stesso istante non esegue', () => {
    const s = mk({ leftMods: { esecuzioneAFreddo: true } })
    const b = unitAt(s, 'right', 0)!, b2 = unitAt(s, 'right', 1)!
    s.sides[1].hp = 90
    s.t = 0
    applyGelo(s, unitAt(s, 'left', 0), b, 1)
    expect(b.ko).toBe(true)
    applyGelo(s, unitAt(s, 'left', 0), b2, 1)
    expect(b2.ko, 'secondo Gelo entro il cooldown: nessuna esecuzione').toBe(false)
    expect(hasStatus(b2, 'gelo')).toBe(true)
    s.t = 4
    applyGelo(s, unitAt(s, 'left', 0), b2, 1)
    expect(b2.ko, 'a 4 s il cooldown è scaduto: esegue').toBe(true)
  })
  it('koUnit: Protego lo annulla; immune lo annulla; accoda i trigger; Mietitore e Carnefice', () => {
    const s = mk({ leftMods: { mietitore: 6, sogliaBonusPerKo: { step: 0.05, cap: 0.25 } } })
    const a = unitAt(s, 'left', 0)!; const b = unitAt(s, 'right', 0)!; const b2 = unitAt(s, 'right', 1)!
    applyUnitStatus(s, b, { kind: 'protego', remaining: 1 })
    expect(koUnit(s, b, a)).toBe(false); expect(b.ko).toBe(false); expect(hasStatus(b, 'protego')).toBe(false)
    b2.immune.add('ko'); expect(koUnit(s, b2, a)).toBe(false)
    b2.immune.clear()
    expect(koUnit(s, b, a)).toBe(true)
    expect(b.statuses).toEqual([]); expect(s.sides[0].koFatti).toBe(1)
    expect(a.dannoFlatBonus).toBe(6); expect(s.sides[0].sogliaBonus).toBe(0.05)
    const trig = s.queue.map(q => `${q.trigger}:${q.unitKey}`)
    expect(trig).toContain('koSubito:right:b'); expect(trig).toContain('koAlleato:right:b2')
    expect(trig).toContain('koNemico:left:a'); expect(trig).toContain('koNemico:left:a2')
    expect(koUnit(s, b, a)).toBe(false)   // già KO
  })
  it('rianimaUnit rimette in gioco con timer 0', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!; b.ko = true; b.timer = 3
    expect(rianimaUnit(s, b)).toBe(true); expect(b.ko).toBe(false); expect(b.timer).toBe(0)
    expect(rianimaUnit(s, b)).toBe(false)
  })
  it('Contagio: al KO nemico il lato che ha fatto il KO aggiunge Veleno', () => {
    const s = mk({ leftMods: { contagioOnKo: 3 } }); const a = unitAt(s, 'left', 0)!; const b = unitAt(s, 'right', 0)!
    koUnit(s, b, a); processQueue(s)
    expect(s.sides[1].segni.veleno).toBe(3)
  })
  it('Contagio non scatta se il lato che avrebbe fatto il KO è già tutto KO (mutual wipe)', () => {
    const s = mk({ leftMods: { contagioOnKo: 3 } })
    unitAt(s, 'left', 0)!.ko = true; unitAt(s, 'left', 1)!.ko = true
    koUnit(s, unitAt(s, 'right', 0)!); processQueue(s)
    expect(s.sides[1].segni.veleno).toBe(0)
  })
})
