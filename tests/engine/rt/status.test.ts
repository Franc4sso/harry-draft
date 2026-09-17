// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { applyUnitStatus, tickUnitStatuses, tickTeamStatuses, applyVulnerabile, hasStatus, statusOf, consumeProtego } from '@/game/engine/rt/status'
import { createRng } from '@/game/engine/rng'
import { squad } from './fixtures'

const mk = (opts = {}) => createState(squad({ id: 'a' }), squad({ id: 'b' }), createRng(1), opts)

describe('status di unità', () => {
  it('Gelo fa refresh al massimo, non somma', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 1 })
    expect(statusOf(b, 'gelo')!.remaining).toBe(2)
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 3 })
    expect(statusOf(b, 'gelo')!.remaining).toBe(3)
  })
  it('Gelo su Lento dura ×1,5', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'lentezza', remaining: 2 })
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })
    expect(statusOf(b, 'gelo')!.remaining).toBe(3)
    expect(s.events.some(e => e.kind === 'reazione' && e.name === 'GeloLento')).toBe(true)
  })
  it('Impotente: Silenzio su Disarmato → Gelo 2 s', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'disarmo', remaining: 1 })
    applyUnitStatus(s, b, { kind: 'silenzio', remaining: 2 })
    expect(statusOf(b, 'gelo')!.remaining).toBe(2)
    expect(s.events.some(e => e.kind === 'reazione' && e.name === 'Impotente')).toBe(true)
  })
  it('Protego assorbe il prossimo effetto ostile e si consuma', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'protego', remaining: 1 })
    expect(applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })).toBe(false)
    expect(hasStatus(b, 'gelo')).toBe(false)
    expect(hasStatus(b, 'protego')).toBe(false)
    expect(applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })).toBe(true)
  })
  it('Protego non stacka; consumeProtego esplicito', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'protego', remaining: 1 }); applyUnitStatus(s, b, { kind: 'protego', remaining: 1 })
    expect(b.statuses.filter(x => x.kind === 'protego')).toHaveLength(1)
    expect(consumeProtego(b)).toBe(true); expect(consumeProtego(b)).toBe(false)
  })
  it('immune ignora', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    b.immune.add('gelo')
    expect(applyUnitStatus(s, b, { kind: 'gelo', remaining: 2 })).toBe(false)
  })
  it('Indebolito tiene il pct più alto', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'indebolito', remaining: 3, pct: 0.2 })
    applyUnitStatus(s, b, { kind: 'indebolito', remaining: 1, pct: 0.4 })
    expect(statusOf(b, 'indebolito')).toMatchObject({ remaining: 3, pct: 0.4 })
  })
  it('tick decrementa e rimuove, ma non Protego/Disarmo', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    // Disarmo PRIMA di Protego: il Disarmo è ostile e un Protego già attivo lo assorbirebbe (spec §1.4).
    applyUnitStatus(s, b, { kind: 'gelo', remaining: 0.2 }); applyUnitStatus(s, b, { kind: 'disarmo', remaining: 1 }); applyUnitStatus(s, b, { kind: 'protego', remaining: 1 })
    tickUnitStatuses(s, 0.1); expect(hasStatus(b, 'gelo')).toBe(true)
    tickUnitStatuses(s, 0.1); expect(hasStatus(b, 'gelo')).toBe(false)
    expect(hasStatus(b, 'protego')).toBe(true); expect(hasStatus(b, 'disarmo')).toBe(true)
  })
  it('Protego assorbe anche il Disarmo', () => {
    const s = mk(); const b = unitAt(s, 'right', 0)!
    applyUnitStatus(s, b, { kind: 'protego', remaining: 1 })
    expect(applyUnitStatus(s, b, { kind: 'disarmo', remaining: 1 })).toBe(false)
    expect(hasStatus(b, 'disarmo')).toBe(false); expect(hasStatus(b, 'protego')).toBe(false)
  })
})

describe('status di squadra', () => {
  it('Fiamma: ogni 0,5 s danno 2×stack poi −1; ignora... no, la Fiamma rispetta lo Scudo', () => {
    const s = mk(); s.sides[1].segni.fiamma = 3; s.sides[1].shield = 0
    const hp0 = s.sides[1].hp
    for (let i = 0; i < 5; i++) { s.t += 0.1; s.t = Math.round(s.t * 10) / 10; tickTeamStatuses(s) }
    expect(s.sides[1].hp).toBe(hp0 - 6)
    expect(s.sides[1].segni.fiamma).toBe(2)
  })
  it('Fiamma consuma prima lo Scudo', () => {
    const s = mk(); s.sides[1].segni.fiamma = 3; s.sides[1].shield = 4
    for (let i = 0; i < 5; i++) { s.t = Math.round((s.t + 0.1) * 10) / 10; tickTeamStatuses(s) }
    expect(s.sides[1].shield).toBe(0); expect(s.sides[1].hp).toBe(s.sides[1].hpMax - 2)
  })
  it('fiammaFreeze blocca il decadimento', () => {
    const s = mk(); s.sides[1].segni.fiamma = 3; s.sides[1].fiammaFreeze = 1
    for (let i = 0; i < 5; i++) { s.t = Math.round((s.t + 0.1) * 10) / 10; tickTeamStatuses(s) }
    expect(s.sides[1].segni.fiamma).toBe(3)
  })
  it('Veleno: ogni 1 s danno 2×stack, permanente, ignora lo Scudo, velenoMult del lato che lo infligge', () => {
    const s = mk({ leftMods: { velenoMult: 1.5 } }); s.sides[1].segni.veleno = 4; s.sides[1].shield = 100
    for (let i = 0; i < 10; i++) { s.t = Math.round((s.t + 0.1) * 10) / 10; tickTeamStatuses(s) }
    expect(s.sides[1].shield).toBe(100)
    expect(s.sides[1].hp).toBe(s.sides[1].hpMax - 12)
    expect(s.sides[1].segni.veleno).toBe(4)
  })
  it('Conduzione: il Veleno ticka ogni 0,5 s finché dura', () => {
    const s = mk(); s.sides[1].segni.veleno = 1; s.sides[1].conduzione = 1
    for (let i = 0; i < 10; i++) { s.t = Math.round((s.t + 0.1) * 10) / 10; tickTeamStatuses(s) }
    expect(s.sides[1].hp).toBe(s.sides[1].hpMax - 4)   // 0.5 e 1.0 (conduzione) ... poi a 1.0 conduzione finisce: tick a 0.5, 1.0 = 2 tick × 2
  })
  it('Cancrena: Veleno ×2 sotto la soglia', () => {
    const s = mk({ leftMods: { cancrenaSotto: 0.4 } }); s.sides[1].segni.veleno = 2; s.sides[1].hp = s.sides[1].hpMax * 0.3
    const hp0 = s.sides[1].hp
    for (let i = 0; i < 10; i++) { s.t = Math.round((s.t + 0.1) * 10) / 10; tickTeamStatuses(s) }
    expect(s.sides[1].hp).toBe(hp0 - 8)
  })
  it('Vulnerabile fa refresh e decade', () => {
    const s = mk(); applyVulnerabile(s, 'right', 2); applyVulnerabile(s, 'right', 1)
    expect(s.sides[1].vulnerabile).toBe(2)
    for (let i = 0; i < 20; i++) { s.t = Math.round((s.t + 0.1) * 10) / 10; tickTeamStatuses(s) }
    expect(s.sides[1].vulnerabile).toBe(0)
  })
})
