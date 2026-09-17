// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { simulateRt } from '@/game/engine/rt/simulate'
import { createRng } from '@/game/engine/rng'
import { ability, cura, danno, nulla, squad } from './fixtures'
import type { AbilityLine } from '@/types/rt'

const A = { hp: 100, atk: 20, def: 0, spd: 20 }   // cd 5
const line = (over: Partial<AbilityLine>): AbilityLine => ({ trigger: 'lancio', target: 'se', effect: { kind: 'scudo', n: 10 }, ...over })

describe('simulateRt', () => {
  it('un attaccante contro un manichino: lancia a 5, 10, 15… e vince', () => {
    const r = simulateRt(squad({ id: 'a', stats: A, spell: danno(1) }), squad({ id: 'd', stats: { hp: 50, atk: 0, def: 0, spd: 1 }, spell: nulla() }), createRng(1))
    const casts = r.events.filter(e => e.kind === 'cast' && e.side === 'left').map(e => e.t)
    expect(casts.slice(0, 3)).toEqual([5, 10, 15])
    expect(r.winner).toBe('left'); expect(r.durata).toBe(15); expect(r.timedOut).toBe(false)
    expect(r.hpFinal[1]).toBe(0); expect(r.mvpId).toBe('a')
    expect(r.frames[0]!.t).toBe(0); expect(r.frames.at(-1)!.hp[1]).toBe(0)
    expect(r.events.at(-1)!.kind).toBe('fine')
  })
  it('è deterministico', () => {
    const mk = () => simulateRt(squad({ id: 'a', stats: A }, { id: 'b', stats: A, spell: danno(1, { segno: { kind: 'fiamma', stacks: 2 } }) }), squad({ id: 'c', stats: A }, { id: 'd', stats: A, spell: cura(15) }), createRng(7))
    const x = mk(), y = mk()
    expect(x.events).toEqual(y.events); expect(x.winner).toBe(y.winner); expect(x.durata).toBe(y.durata)
  })
  it('due curatori: morte improvvisa chiude prima dei 60 s; vince chi ha più % HP; pari → left', () => {
    const r = simulateRt(squad({ id: 'h1', stats: { ...A, hp: 100 }, spell: cura(50) }), squad({ id: 'h2', stats: { ...A, hp: 100 }, spell: cura(50) }), createRng(1))
    expect(r.durata).toBeGreaterThanOrEqual(30); expect(r.durata).toBeLessThan(60)
    expect(r.events.some(e => e.kind === 'maledizione')).toBe(true)
    expect(r.winner).toBe('left')
  })
  it('timeout a maxSeconds: vince la % HP più alta', () => {
    const r = simulateRt(squad({ id: 'a', stats: { hp: 100, atk: 1, def: 0, spd: 1 }, spell: nulla() }), squad({ id: 'b', stats: { hp: 1000, atk: 1, def: 0, spd: 1 }, spell: nulla() }), createRng(1), { maxSeconds: 5 })
    expect(r.timedOut).toBe(true); expect(r.durata).toBe(5)
  })
  it('KO ferma i cast; Rianima li riprende', () => {
    const left = squad({ id: 'k', stats: A, spell: nulla(), ability: ability([line({ trigger: 'inizio', target: 'opposto', effect: { kind: 'ko' } })]) })
    const right = squad({ id: 'v', stats: A, spell: danno(1) }, { id: 'r', stats: { ...A, spd: 38 }, spell: { id: 'ren', name: 'Rennervate', desc: '', verb: 'rianima' } })
    const r = simulateRt(left, right, createRng(1), { maxSeconds: 8 })
    expect(r.events.find(e => e.kind === 'ko')!.t).toBe(0)
    expect(r.events.some(e => e.kind === 'rianima' && e.t === 3)).toBe(true)   // spd 38 → cd 3
    expect(r.events.filter(e => e.kind === 'cast' && e.slot === 0 && e.side === 'right' && e.t < 3)).toHaveLength(0)
    expect(r.events.some(e => e.kind === 'cast' && e.slot === 0 && e.side === 'right' && e.t > 3)).toBe(true)
  })
  it('Carica fa scattare il cast nello stesso tick; Innesco lancia senza toccare il timer', () => {
    const left = squad(
      { id: 'c', stats: { ...A, spd: 38 }, spell: { id: 'car', name: 'Carica', desc: '', verb: 'carica', carica: { secondi: 5, target: 'destra' } } },
      { id: 'a', stats: A, spell: danno(1) },
      { id: 'i', stats: { ...A, spd: 38 }, spell: nulla(), ability: ability([line({ trigger: 'inizio', target: 'sinistra', effect: { kind: 'innesco' } })]) },
    )
    const r = simulateRt(left, squad({ id: 'd', stats: { hp: 5000, atk: 0, def: 0, spd: 1 }, spell: nulla() }), createRng(1), { maxSeconds: 6 })
    const aCasts = r.events.filter(e => e.kind === 'cast' && e.side === 'left' && e.slot === 1).map(e => e.t)
    expect(aCasts[0]).toBe(0)          // innesco all'inizio
    expect(aCasts).toContain(3)        // carica 5 s a t=3 → timer 3+5 ≥ 5 → cast subito
  })
  it('Gelo ferma il timer, Lentezza lo dimezza', () => {
    const left = squad({ id: 'g', stats: { ...A, spd: 38 }, spell: { id: 'gl', name: 'Glacius', desc: '', verb: 'status', gelo: 2 } })
    const right = squad({ id: 'a', stats: A, spell: danno(1) })
    const r = simulateRt(left, right, createRng(1), { maxSeconds: 12 })
    const casts = r.events.filter(e => e.kind === 'cast' && e.side === 'right').map(e => e.t)
    expect(casts[0]).toBeGreaterThan(5)   // gelato a 3, 6, 9 → il timer si ferma
    const r2 = simulateRt(squad({ id: 'l', stats: { ...A, spd: 38 }, spell: { id: 'ta', name: 'Tarantallegra', desc: '', verb: 'status', unitStatus: { kind: 'lentezza', secondi: 3 } } }), right, createRng(1), { maxSeconds: 12 })
    const casts2 = r2.events.filter(e => e.kind === 'cast' && e.side === 'right').map(e => e.t)
    expect(casts2[0]).toBeGreaterThan(5); expect(casts2[0]).toBeLessThanOrEqual(8)
  })
  it('chi viene congelato nello stesso tick non lancia: runCasts ricontrolla il Gelo dentro il giro', () => {
    // entrambi pronti a t=3 (spd 38 → cd 3). Sinistra lancia prima (ordine di slot): il Gelo arriva e destra salta il turno.
    const left = squad({ id: 'g', stats: { ...A, spd: 38 }, spell: { id: 'gl', name: 'Glacius', desc: '', verb: 'status', gelo: 2 } })
    const right = squad({ id: 'a', stats: { ...A, spd: 38 }, spell: danno(1) })
    const r = simulateRt(left, right, createRng(1), { maxSeconds: 12 })
    const firstCast = r.events.find(e => e.kind === 'cast' && e.side === 'right')
    expect(firstCast!.t).toBeGreaterThan(3)
    expect(r.events.filter(e => e.kind === 'danno' && e.side === 'right' && e.t === 3)).toHaveLength(0)
  })
  it('frame: uno per tick con eventi, con eventRange coerente e cd effettivo', () => {
    const r = simulateRt(squad({ id: 'a', stats: A }), squad({ id: 'd', stats: { hp: 30, atk: 0, def: 0, spd: 1 }, spell: nulla() }), createRng(1))
    for (const f of r.frames) {
      const [s, e] = f.eventRange
      expect(e).toBeGreaterThan(s)
      expect(r.events.slice(s, e).every(ev => ev.t === f.t)).toBe(true)
    }
    expect(r.frames[0]!.units['left:a']!.cd).toBe(5)
  })
  it('memoriaDelta e reazioni nel risultato; koLeft/koRight', () => {
    const left = squad({ id: 'a', stats: A, spell: danno(1, { id: 'x', segno: { kind: 'fiamma', stacks: 1 }, crescita: { kind: 'memoria', trigger: 'reazione:miasma', per: 1, unit: 'segno' } }) }, { id: 'p', stats: A, spell: danno(0.1, { segno: { kind: 'veleno', stacks: 1 } }) })
    const r = simulateRt(left, squad({ id: 'd', stats: { hp: 400, atk: 0, def: 0, spd: 1 }, spell: nulla() }), createRng(1))
    expect(r.reazioni.Miasma!).toBeGreaterThan(0)
    expect(r.memoriaDelta['left:a']!).toBeGreaterThan(0)                       // a innesca Miasma (fiamma su veleno) dal secondo giro
    expect(r.memoriaDelta['left:a']!).toBeLessThanOrEqual(r.reazioni.Miasma!)  // anche p ne innesca (veleno su fiamma), ma non ha Memoria
    expect(r.koLeft).toEqual([]); expect(r.koRight).toEqual([])
  })
  it('entrambi a zero nello stesso tick → left', () => {
    const l = squad({ id: 'a', stats: { hp: 10, atk: 100, def: 0, spd: 20 }, spell: danno(1) })
    const rr = squad({ id: 'b', stats: { hp: 10, atk: 100, def: 0, spd: 20 }, spell: danno(1) })
    const r = simulateRt(l, rr, createRng(1))
    expect(r.winner).toBe('left'); expect(r.hpFinal).toEqual([0, 0])
  })
})
