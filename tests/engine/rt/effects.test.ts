// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { applyEffect, dannoMult, dannoFlat, effectiveCd, activeMulticast } from '@/game/engine/rt/effects'
import { applyUnitStatus, hasStatus, statusOf } from '@/game/engine/rt/status'
import { unitTarget } from '@/game/engine/rt/targeting'
import { createRng } from '@/game/engine/rng'
import { squad } from './fixtures'

// Stat esplicite, def 0 → Scudo iniziale 0. Sinistra HP 400 (200+100+100), destra HP 300 (200+100).
const A = { hp: 200, atk: 20, def: 0, spd: 20 }, B = { hp: 100, atk: 20, def: 0, spd: 20 }
const mk = (opts = {}) => createState(
  squad({ id: 'a', stats: A }, { id: 'a2', stats: B }, undefined, { id: 'a3', stats: B }),
  squad({ id: 'b', stats: A }, { id: 'b2', stats: B }), createRng(1), opts)
const ctx = (target: any = 'se') => ({ target })

describe('applyEffect — squadra', () => {
  it('danno: potenza × atk × levelCastMult, diretto, bersaglio-unità = opposto', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!; a.level = 2
    applyEffect(s, a, 'left', [], { kind: 'danno', potenza: 1.5 }, ctx('opposto'))
    expect(s.sides[1].hp).toBe(300 - Math.round(20 * 1.5 * 1.35))
  })
  it('cura e scudo sul proprio lato, segno e vulnerabile sul nemico, squadraPropria inverte', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!; s.sides[0].hp = 100
    applyEffect(s, a, 'left', [], { kind: 'cura', n: 30 }, ctx()); expect(s.sides[0].hp).toBe(130)
    applyEffect(s, a, 'left', [], { kind: 'scudo', n: 10 }, ctx()); expect(s.sides[0].shield).toBe(10)
    applyEffect(s, a, 'left', [], { kind: 'segno', segno: 'fiamma', stacks: 3 }, ctx('squadraNemica')); expect(s.sides[1].segni.fiamma).toBe(3)
    applyEffect(s, a, 'left', [], { kind: 'segno', segno: 'fiamma', stacks: 2 }, ctx('squadraPropria')); expect(s.sides[0].segni.fiamma).toBe(2)
    applyEffect(s, a, 'left', [], { kind: 'vulnerabile', secondi: 3 }, ctx('squadraNemica')); expect(s.sides[1].vulnerabile).toBe(3)
    applyEffect(s, a, 'left', [], { kind: 'rimuoviSegnoProprio', segno: 'fiamma' }, ctx()); expect(s.sides[0].segni.fiamma).toBe(0)
  })
  it('hpPct e scudoIniziale alzano il lato', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!
    applyEffect(s, a, 'left', [], { kind: 'hpPct', pct: 0.1 }, ctx()); expect(s.sides[0].hpMax).toBe(440); expect(s.sides[0].hp).toBe(440)
    applyEffect(s, a, 'left', [], { kind: 'scudoIniziale', n: 40 }, ctx()); expect(s.sides[0].shield).toBe(40)
  })
})

describe('applyEffect — unità', () => {
  it('gelo/silenzio/lentezza/indebolito/disarmo/sospeso/protego/ko/purifica/rianima', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!; const b = unitAt(s, 'right', 0)!; const b2 = unitAt(s, 'right', 1)!
    applyEffect(s, a, 'left', [b], { kind: 'silenzio', secondi: 2 }, ctx('opposto')); expect(statusOf(b, 'silenzio')!.remaining).toBe(2)
    applyEffect(s, a, 'left', [b], { kind: 'indebolito', pct: 0.2, secondi: 3 }, ctx('opposto')); expect(statusOf(b, 'indebolito')!.pct).toBe(0.2)
    applyEffect(s, a, 'left', [b], { kind: 'purifica' }, ctx('opposto')); expect(b.statuses).toHaveLength(2)   // purifica è amica: su un nemico non fa nulla
    // PRIMA del Protego: la Lentezza è ostile e un Protego attivo la assorbirebbe
    applyUnitStatus(s, a, { kind: 'lentezza', remaining: 2 })
    applyEffect(s, a, 'left', [a], { kind: 'protego' }, ctx('se')); expect(hasStatus(a, 'protego')).toBe(true)
    applyEffect(s, a, 'left', [a], { kind: 'purifica' }, ctx('se')); expect(hasStatus(a, 'lentezza')).toBe(false); expect(hasStatus(a, 'protego')).toBe(true)
    applyEffect(s, a, 'left', [b2], { kind: 'ko' }, ctx('opposto')); expect(b2.ko).toBe(true)
    applyEffect(s, a, 'left', [b2], { kind: 'rianima' }, ctx('opposto')); expect(b2.ko).toBe(true)   // amica: non rianima nemici
    b2.side = 'left'; applyEffect(s, a, 'left', [b2], { kind: 'rianima' }, ctx('alleatoSlotMinimo')); expect(b2.ko).toBe(false)
  })
  it('durataStatusPct del lato allunga gelo/silenzio/lentezza applicati DA quel lato', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!; const b = unitAt(s, 'right', 0)!
    s.sides[0].durataStatusPct.gelo = 0.5
    applyEffect(s, a, 'left', [b], { kind: 'gelo', secondi: 2 }, ctx('opposto')); expect(statusOf(b, 'gelo')!.remaining).toBe(3)
  })
  it('carica, innesco, multicast, dannoPct, dannoFlat, cdPct, cdFlat, immune, copre', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!; const a2 = unitAt(s, 'left', 1)!; const a3 = unitAt(s, 'left', 3)!
    applyEffect(s, a, 'left', [a2], { kind: 'carica', secondi: 1.5 }, ctx('destra')); expect(a2.timer).toBe(1.5)
    applyEffect(s, a, 'left', [a2], { kind: 'innesco' }, ctx('destra')); expect(s.pendingInnesco).toEqual(['left:a2'])
    applyEffect(s, a, 'left', [a], { kind: 'multicast', n: 1, durata: 5 }, ctx()); s.t = 3; expect(activeMulticast(s, a)).toBe(2); s.t = 6; expect(activeMulticast(s, a)).toBe(1)
    applyEffect(s, a, 'left', [a], { kind: 'multicast', n: 1, durata: 'battaglia' }, ctx()); expect(activeMulticast(s, a)).toBe(2)
    applyEffect(s, a, 'left', [a], { kind: 'dannoPct', pct: 0.5, durata: 'battaglia' }, ctx()); expect(dannoMult(s, a)).toBeCloseTo(1.5)
    applyUnitStatus(s, a, { kind: 'indebolito', remaining: 3, pct: 0.2 }); expect(dannoMult(s, a)).toBeCloseTo(1.5 * 0.8)
    applyEffect(s, a, 'left', [a], { kind: 'dannoFlat', n: 4 }, ctx()); a.permanenti = { dannoFlat: 2 }; expect(dannoFlat(s, a)).toBe(6)
    expect(effectiveCd(s, a)).toBe(5)
    applyEffect(s, a, 'left', [a], { kind: 'cdPct', pct: -0.2 }, ctx()); expect(effectiveCd(s, a)).toBe(4)
    applyEffect(s, a, 'left', [a], { kind: 'cdFlat', secondi: -3 }, ctx()); expect(effectiveCd(s, a)).toBe(2)   // minimo 2
    applyEffect(s, a, 'left', [a2], { kind: 'immune', a: 'gelo' }, ctx('destra')); expect(a2.immune.has('gelo')).toBe(true)
    applyEffect(s, a3, 'left', [a3], { kind: 'copre', wizardId: 'a2' }, ctx()); expect(a2.copertoDa).toBe('left:a3')
    expect(unitTarget(s, 'right', 1)!.id).toBe('a3')   // il nemico che mira ad a2 colpisce a3
  })
  it('dannoPct su squadraNemica lancia (va espresso come riga Continuo)', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!
    expect(() => applyEffect(s, a, 'left', [], { kind: 'dannoPct', pct: 0.1 }, ctx('squadraNemica'))).toThrow()
  })
})
