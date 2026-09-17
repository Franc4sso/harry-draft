// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { dealDamage, heal, addShield, applySuddenDeath } from '@/game/engine/rt/damage'
import { applyUnitStatus, hasStatus } from '@/game/engine/rt/status'
import { createRng } from '@/game/engine/rng'
import { squad } from './fixtures'

const mk = (opts = {}) => createState(squad({ id: 'a', stats: { hp: 200, atk: 20, def: 0, spd: 20 } }), squad({ id: 'b', stats: { hp: 200, atk: 20, def: 0, spd: 20 } }), createRng(1), opts)

describe('dealDamage', () => {
  it('Scudo prima, poi HP; evento danno col totale', () => {
    const s = mk(); s.sides[1].shield = 30
    const out = dealDamage(s, unitAt(s, 'left', 0), 'right', 50, { diretto: true })
    expect(out).toMatchObject({ total: 50, toShield: 30, toHp: 20, frantuma: false })
    expect(s.sides[1].shield).toBe(0); expect(s.sides[1].hp).toBe(180)
    expect(s.events.at(-1)).toMatchObject({ kind: 'danno', targetSide: 'right', value: 50, side: 'left', slot: 0 })
  })
  it('Vulnerabile +15%, dannoSubitoPct del bersaglio', () => {
    const s = mk({ rightMods: { dannoSubitoPct: -0.1 } }); s.sides[1].vulnerabile = 2
    dealDamage(s, unitAt(s, 'left', 0), 'right', 100, { diretto: true })
    expect(s.sides[1].hp).toBe(200 - Math.round(100 * 1.15 * 0.9))
  })
  it('Frantuma: bersaglio gelato → consuma Gelo, ×2, Scossa +2, reazione', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })
    const out = dealDamage(s, unitAt(s, 'left', 0), 'right', 40, { diretto: true, unitTarget: b })
    expect(out.frantuma).toBe(true); expect(out.total).toBe(80)
    expect(hasStatus(b, 'gelo')).toBe(false); expect(s.sides[1].segni.scossa).toBe(2)
    expect(s.reazioni.Frantuma).toBe(1)
  })
  it('Frantuma non scatta su danno non diretto, e usa frantumaMult', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })
    expect(dealDamage(s, null, 'right', 40, { diretto: false, unitTarget: b }).frantuma).toBe(false)
    expect(dealDamage(s, unitAt(s, 'left', 0), 'right', 40, { diretto: true, unitTarget: b, frantumaMult: 2.5 }).total).toBe(100)
  })
  it('Scossa: +1 per stack su danno diretto, non consumata', () => {
    const s = mk(); s.sides[1].segni.scossa = 5
    expect(dealDamage(s, unitAt(s, 'left', 0), 'right', 10, { diretto: true }).total).toBe(15)
    expect(dealDamage(s, unitAt(s, 'left', 0), 'right', 10, { diretto: false }).total).toBe(10)
    expect(s.sides[1].segni.scossa).toBe(5)
  })
  it('Muro Vivente riflette il danno assorbito dallo Scudo', () => {
    const s = mk({ rightMods: { muroVivente: 0.5 } }); s.sides[1].shield = 40
    dealDamage(s, unitAt(s, 'left', 0), 'right', 30, { diretto: true })
    expect(s.sides[0].hp).toBe(200 - 15)
    expect(s.events.some(e => e.kind === 'danno' && e.name === 'MuroVivente' && e.targetSide === 'left' && e.value === 15)).toBe(true)
  })
  it('contraccolpo magie oscure sul proprio HP; Corrotto ignora il proprio Scudo', () => {
    const s = mk({ leftMods: { magieOscure: { bonus: 0.3, recoil: 0.2 } } }); s.sides[0].shield = 100
    dealDamage(s, unitAt(s, 'left', 0), 'right', 50, { diretto: true, magieOscure: true })
    expect(s.sides[0].shield).toBe(90); expect(s.sides[0].hp).toBe(200)
    const s2 = mk({ leftMods: { magieOscure: { bonus: 0.3, recoil: 0.2 } } }); s2.sides[0].shield = 100
    unitAt(s2, 'left', 0)!.corrotto = true
    dealDamage(s2, unitAt(s2, 'left', 0), 'right', 50, { diretto: true, magieOscure: true })
    expect(s2.sides[0].shield).toBe(100); expect(s2.sides[0].hp).toBe(190)
  })
  it('accredita lo score all\'attaccante', () => {
    const s = mk(); const a = unitAt(s, 'left', 0)!
    dealDamage(s, a, 'right', 30, { diretto: true })
    expect(a.score).toBe(30)
  })
})

describe('heal e addShield', () => {
  it('cura non oltre il max, Baluardo +30% con Scudo, eccesso → Scudo se curaEccessoToScudo', () => {
    const s = mk({ leftMods: { curaEccessoToScudo: 0.5 } }); s.sides[0].hp = 150; s.sides[0].shield = 0
    expect(heal(s, 'left', 20)).toBe(20); expect(s.sides[0].hp).toBe(170)
    s.sides[0].shield = 5
    expect(heal(s, 'left', 20)).toBe(26); expect(s.sides[0].hp).toBe(196)   // Baluardo
    expect(s.reazioni.Baluardo).toBe(1)
    heal(s, 'left', 20)   // 26 di cura, 4 utili, 22 in eccesso → +11 scudo
    expect(s.sides[0].hp).toBe(200); expect(s.sides[0].shield).toBe(16)
  })
  it('curaPct dei mods e score', () => {
    const s = mk({ leftMods: { curaPct: 0.5 } }); s.sides[0].hp = 100; const a = unitAt(s, 'left', 0)!
    expect(heal(s, 'left', 20, a)).toBe(30); expect(a.score).toBe(30)
  })
  it('scudo: scudoProdottoMult e Bastione (+50% se un alleato ha Protego)', () => {
    const s = mk({ leftMods: { scudoProdottoMult: 1.2 } })
    expect(addShield(s, 'left', 10)).toBe(12)
    applyUnitStatus(s, unitAt(s, 'left', 0)!, { kind: 'protego', remaining: 1 })
    expect(addShield(s, 'left', 10)).toBe(18); expect(s.reazioni.Bastione).toBe(1)
  })
})

describe('applySuddenDeath', () => {
  it('dal secondo 30, ogni 0,5 s, cresce, ignora lo Scudo', () => {
    const s = mk(); s.sides[0].shield = 999; s.sides[1].shield = 999
    s.t = 29.9; applySuddenDeath(s); expect(s.sides[0].hp).toBe(200)
    s.t = 30; applySuddenDeath(s); expect(s.sides[0].hp).toBe(198)          // 1% di 200
    s.t = 30.3; applySuddenDeath(s); expect(s.sides[0].hp).toBe(198)
    s.t = 32; applySuddenDeath(s); expect(s.sides[0].hp).toBe(198 - 4)      // 1% + 0.5%×2 = 2%
    expect(s.sides[1].hp).toBe(194); expect(s.sides[0].shield).toBe(999)
    expect(s.events.filter(e => e.kind === 'maledizione')).toHaveLength(4)
  })
})
