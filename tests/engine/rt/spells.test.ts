// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { castSpell, spellCdBonus } from '@/game/engine/rt/spells'
import { applyUnitStatus, hasStatus, statusOf } from '@/game/engine/rt/status'
import { processQueue } from '@/game/engine/rt/triggers'
import { createRng } from '@/game/engine/rng'
import { applyEffect } from '@/game/engine/rt/effects'
import { ability, cura, danno, nulla, scudo, squad, status } from './fixtures'

const A = { hp: 200, atk: 20, def: 0, spd: 20 }
const mk = (l: any[], r: any[] = [{ id: 'b', stats: A }, { id: 'b2', stats: A }], opts = {}) => createState(squad(...l), squad(...r), createRng(1), opts)

describe('castSpell — verbi', () => {
  it('danno: atk × potenza × livello, diretto sull\'opposto, evento cast', () => {
    const s = mk([{ id: 'a', stats: A, level: 3, spell: danno(2) }])
    expect(castSpell(s, unitAt(s, 'left', 0)!)).toBe(true)
    expect(s.sides[1].hp).toBe(400 - Math.round(20 * 2 * 1.7))
    expect(s.events.find(e => e.kind === 'cast')).toMatchObject({ side: 'left', slot: 0, name: 'Danno', value: 1 })
    expect(s.queue.map(q => q.trigger)).toContain('lancio')
  })
  it('magieOscure: bonus dei mods e contraccolpo', () => {
    const s = mk([{ id: 'a', stats: A, spell: danno(1, { keywords: ['magieOscure'] }) }], undefined, { leftMods: { magieOscure: { bonus: 0.5, recoil: 0.2 } } })
    castSpell(s, unitAt(s, 'left', 0)!)
    expect(s.sides[1].hp).toBe(400 - 30); expect(s.sides[0].hp).toBe(200 - 6)
  })
  it('segno e gelo della spell, con bersaglio-unità', () => {
    const s = mk([{ id: 'a', stats: A, spell: danno(1, { segno: { kind: 'fiamma', stacks: 3 } }) }, { id: 'c', stats: A, spell: status({ gelo: 2 }) }])
    castSpell(s, unitAt(s, 'left', 1)!); expect(statusOf(unitAt(s, 'right', 1)!, 'gelo')!.remaining).toBe(2)
    castSpell(s, unitAt(s, 'left', 0)!); expect(s.sides[1].segni.fiamma).toBe(3)
  })
  it('cura → squadraCura in coda, Untore aggiunge Veleno; scudo; carica; protego; rianima; buff', () => {
    const s = mk([
      { id: 'h', stats: A, spell: cura(30) }, { id: 's', stats: A, spell: scudo(25) },
      { id: 'c', stats: A, spell: { id: 'car', name: 'Carica', desc: '', verb: 'carica', carica: { secondi: 1, target: 'adiacenti' } } },
      { id: 'p', stats: A, spell: { id: 'pro', name: 'Protego', desc: '', verb: 'protego' } },
      { id: 'r', stats: A, spell: { id: 'ren', name: 'Rennervate', desc: '', verb: 'rianima' } },
      { id: 'k', stats: A, spell: { id: 'rid', name: 'Riddikulus', desc: '', verb: 'buff', buff: { dannoPct: 0.15, max: 3 } } },
    ], undefined, { leftMods: { untore: true } })
    s.sides[0].hp = 500
    castSpell(s, unitAt(s, 'left', 0)!); expect(s.sides[0].hp).toBe(530)
    expect(s.queue.some(q => q.trigger === 'squadraCura')).toBe(true)
    processQueue(s); expect(s.sides[1].segni.veleno).toBe(1)   // Untore scatta sull'evento di lato `squadraCura`
    castSpell(s, unitAt(s, 'left', 1)!); expect(s.sides[0].shield).toBe(25)
    castSpell(s, unitAt(s, 'left', 2)!); expect(unitAt(s, 'left', 1)!.timer).toBe(1); expect(unitAt(s, 'left', 5)!.timer).toBe(1)
    castSpell(s, unitAt(s, 'left', 3)!); expect(hasStatus(unitAt(s, 'left', 0)!, 'protego') || hasStatus(unitAt(s, 'left', 4)!, 'protego')).toBe(true)
    unitAt(s, 'left', 1)!.ko = true
    castSpell(s, unitAt(s, 'left', 4)!); expect(unitAt(s, 'left', 1)!.ko).toBe(false)
    const hp = s.sides[0].hp; castSpell(s, unitAt(s, 'left', 4)!); expect(s.sides[0].hp).toBe(Math.min(s.sides[0].hpMax, hp + 26))   // nessun KO → cura 20, +30% Baluardo (c'è Scudo)
    for (let i = 0; i < 5; i++) castSpell(s, unitAt(s, 'left', 5)!)
    expect(unitAt(s, 'left', 0)!.dannoPctBonus.reduce((a, b) => a + b.pct, 0)).toBeCloseTo(0.45)   // max 3
  })
  it('ogni cura accoda squadraCura: anche da una riga d\'abilità, non solo dal verbo', () => {
    const s = mk([{ id: 'a', stats: A }, { id: 'b', stats: A }, { id: 'c', stats: A }])
    s.sides[0].hp = 100
    applyEffect(s, unitAt(s, 'left', 0)!, 'left', [], { kind: 'cura', n: 10 }, { target: 'squadraPropria' })
    const ev = s.queue.filter(q => q.trigger === 'squadraCura')
    expect(ev.filter(q => !q.unitKey)).toHaveLength(1)                       // un evento di lato
    expect(ev.filter(q => q.unitKey).map(q => q.unitKey).sort()).toEqual(['left:a', 'left:b', 'left:c'])
  })
  it('Untore scatta anche da una cura che non viene dal verbo `cura`', () => {
    const s = mk([{ id: 'a', stats: A }], undefined, { leftMods: { untore: true } })
    s.sides[0].hp = 100
    applyEffect(s, unitAt(s, 'left', 0)!, 'left', [], { kind: 'cura', n: 10 }, { target: 'squadraPropria' })
    processQueue(s)
    expect(s.sides[1].segni.veleno).toBe(1)
  })
  it('una cura da 0 non accoda nulla', () => {
    const s = mk([{ id: 'a', stats: A, spell: nulla() }])
    castSpell(s, unitAt(s, 'left', 0)!)
    expect(s.queue.filter(q => q.trigger === 'squadraCura')).toHaveLength(0)
  })
  it('status verb: unitStatus e teamStatus', () => {
    const s = mk([{ id: 'a', stats: A, spell: status({ unitStatus: { kind: 'silenzio', secondi: 3 }, teamStatus: { kind: 'vulnerabile', secondi: 2 } }) }])
    castSpell(s, unitAt(s, 'left', 0)!)
    expect(statusOf(unitAt(s, 'right', 0)!, 'silenzio')!.remaining).toBe(3); expect(s.sides[1].vulnerabile).toBe(2)
  })
})

describe('castSpell — Multicast, Disarmo, Combo, Crescita', () => {
  it('Multicast della spell + bonus attivi; il cast è uno, i colpi sono n', () => {
    const s = mk([{ id: 'a', stats: A, spell: danno(1, { multicast: 2 }) }])
    const a = unitAt(s, 'left', 0)!; a.multicastBonus.push({ n: 1, until: 'battaglia' })
    castSpell(s, a)
    expect(s.events.filter(e => e.kind === 'danno')).toHaveLength(3); expect(a.casts).toBe(1)
    expect(s.queue.filter(q => q.trigger === 'lancio')).toHaveLength(1)
  })
  it('Disarmo: salta il cast, consuma, nessun trigger', () => {
    const s = mk([{ id: 'a', stats: A }]); const a = unitAt(s, 'left', 0)!
    applyUnitStatus(s, a, { kind: 'disarmo', remaining: 1 })
    expect(castSpell(s, a)).toBe(false); expect(hasStatus(a, 'disarmo')).toBe(false); expect(s.sides[1].hp).toBe(400)
    expect(s.queue).toHaveLength(0)
  })
  it('Combo: cond sul bersaglio-unità, effetto e target della clausola', () => {
    const s = mk([{ id: 'a', stats: A, spell: danno(1, { combo: { cond: { bersaglio: 'gelato' }, effect: { kind: 'silenzio', secondi: 2 } } }) }])
    const b = unitAt(s, 'right', 0)!
    castSpell(s, unitAt(s, 'left', 0)!); expect(hasStatus(b, 'silenzio')).toBe(false)
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 5 })
    castSpell(s, unitAt(s, 'left', 0)!)
    expect(hasStatus(b, 'silenzio')).toBe(true)   // Frantuma ha consumato il Gelo dopo la valutazione della cond
  })
  it('reazioni 4-6 una volta per cast: Necrosi e Frantuma non si moltiplicano col Multicast', () => {
    // status + segno veleno ×3 su bersaglio gelato: senza il fix la Necrosi scatterebbe 3 volte (☠ 12, Gelo +3 s).
    const s = createState(squad({ id: 'a', stats: A, spell: status({ multicast: 3, segno: { kind: 'veleno', stacks: 1 } }) }), squad({ id: 'b', stats: A }), createRng(1))
    const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 5 })
    castSpell(s, unitAt(s, 'left', 0)!)
    expect(s.sides[1].segni.veleno).toBe(6)                   // 3 dalla spell + 3 da UNA Necrosi
    expect(s.reazioni.Necrosi).toBe(1)
    expect(statusOf(b, 'gelo')!.remaining).toBe(6)            // Gelo +1 s una volta sola
    // Frantuma: solo il primo colpo raddoppia (e consuma il Gelo).
    const s2 = createState(squad({ id: 'a', stats: A, spell: danno(0.5, { multicast: 3 }) }), squad({ id: 'b', stats: A }), createRng(1))
    applyUnitStatus(s2, unitAt(s2, 'right', 0)!, { kind: 'gelo', remaining: 5 })
    castSpell(s2, unitAt(s2, 'left', 0)!)
    expect(s2.reazioni.Frantuma).toBe(1)
    expect(s2.events.filter(e => e.kind === 'danno').map(e => e.value)).toEqual([20, 12, 12])   // 10×2, poi 10 + 2 di Scossa (lasciata da Frantuma)
  })
  it('frantumaMult della spell', () => {
    const s = mk([{ id: 'a', stats: A, spell: danno(1, { frantumaMult: 2.5 }) }]); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 5 })
    castSpell(s, unitAt(s, 'left', 0)!); expect(s.sides[1].hp).toBe(400 - 50)
  })
  it('Memoria: danno flat, segno, cura, colpi; cap; spellCdBonus', () => {
    const s = mk([
      { id: 'a', stats: A, memoria: { m: 7 }, spell: danno(1, { id: 'm', crescita: { kind: 'memoria', trigger: 'vittoria', per: 2, cap: 10, unit: 'danno' } }) },
      { id: 'b', stats: A, memoria: { s: 6 }, spell: danno(1, { id: 's', segno: { kind: 'veleno', stacks: 1 }, crescita: { kind: 'memoria', trigger: 'vittoria', per: 1, unit: 'segno' } }) },
      { id: 'c', stats: A, memoria: { k: 5 }, spell: danno(1, { id: 'k', crescita: { kind: 'memoria', trigger: 'ko', per: 0.3, unit: 'cd' } }) },
      { id: 'd', stats: A, memoria: { d: 4 }, spell: danno(1, { id: 'd', crescita: { kind: 'memoria', trigger: 'vittoria', per: 0.5, unit: 'colpi' } }) },
    ])
    castSpell(s, unitAt(s, 'left', 0)!)
    expect(s.events.find(e => e.kind === 'danno' && e.side === 'left' && e.slot === 0)!.value).toBe(30)   // 20 + min(14,10)
    castSpell(s, unitAt(s, 'left', 1)!); expect(s.sides[1].segni.veleno).toBe(7)
    expect(spellCdBonus(unitAt(s, 'left', 2)!)).toBeCloseTo(1.5)
    castSpell(s, unitAt(s, 'left', 3)!); expect(s.events.filter(e => e.kind === 'danno' && e.slot === 3)).toHaveLength(3)   // 1 + floor(2)
  })
  it('Crescendo: lancio incrementa; lancioSenzaGelo si azzera dopo un Gelo subìto', () => {
    const s = mk([{ id: 'a', stats: A, spell: danno(1, { crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.1, unit: 'pct' } }) }, { id: 'c', stats: A, spell: danno(1, { segno: { kind: 'scossa', stacks: 1 }, crescita: { kind: 'crescendo', trigger: 'lancioSenzaGelo', per: 1, unit: 'segno' } }) }])
    const a = unitAt(s, 'left', 0)!, c = unitAt(s, 'left', 1)!
    castSpell(s, a); castSpell(s, a); castSpell(s, a)
    expect(a.crescendo).toBe(3)
    expect(s.events.filter(e => e.kind === 'danno' && e.slot === 0).map(e => e.value)).toEqual([20, 22, 24])
    castSpell(s, c); castSpell(s, c); expect(s.sides[1].segni.scossa).toBe(1 + 2)
    s.t = 1; applyUnitStatus(s, c, { kind: 'gelo', remaining: 0.5 }); c.statuses = []
    s.t = 2; castSpell(s, c); expect(c.crescendo).toBe(1); expect(s.sides[1].segni.scossa).toBe(3 + 1)
  })
  it('segnoOnCast dei mods (Trio) e adiacenteLancia', () => {
    const s = mk([{ id: 'a', stats: A }, { id: 'n', stats: A }], undefined, { leftMods: { segnoOnCast: { scossa: 1 } } })
    s.t = 4; castSpell(s, unitAt(s, 'left', 0)!)
    expect(s.sides[1].segni.scossa).toBe(1)
    expect(unitAt(s, 'left', 1)!.lastAdjacentCastAt).toBe(4)
    expect(s.queue.some(q => q.trigger === 'adiacenteLancia' && q.unitKey === 'left:n')).toBe(true)
  })
})
