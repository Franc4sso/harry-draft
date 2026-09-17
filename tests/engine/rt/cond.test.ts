// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { checkCond } from '@/game/engine/rt/cond'
import { createRng } from '@/game/engine/rng'
import { squad } from './fixtures'

describe('checkCond', () => {
  const mk = () => createState(
    squad({ id: 'a', tags: ['weasley'], house: 'Serpeverde', role: 'Tank' }, { id: 'b' }, undefined, { id: 'd' }),
    squad({ id: 'r0' }, { id: 'r1' }), createRng(1))
  it('undefined è sempre vero', () => { const s = mk(); expect(checkCond(s, unitAt(s, 'left', 1)!, undefined, {})).toBe(true) })
  it('adiacente per id/tag/casa/ruolo', () => {
    const s = mk(); const b = unitAt(s, 'left', 1)!
    expect(checkCond(s, b, { adiacente: { wizardId: 'a' } }, {})).toBe(true)
    expect(checkCond(s, b, { adiacente: { tag: 'weasley' } }, {})).toBe(true)
    expect(checkCond(s, b, { adiacente: { casa: 'Serpeverde' } }, {})).toBe(true)
    expect(checkCond(s, b, { adiacente: { ruolo: 'Supporto' } }, {})).toBe(false)
    expect(checkCond(s, b, { adiacente: { wizardId: 'd' } }, {})).toBe(false)   // d è in slot 3, diagonale di 1
    unitAt(s, 'left', 0)!.ko = true
    expect(checkCond(s, b, { adiacente: { wizardId: 'a' } }, {})).toBe(false)
  })
  it('inSquadra ignora i KO', () => {
    const s = mk(); const b = unitAt(s, 'left', 1)!
    expect(checkCond(s, b, { inSquadra: { wizardId: 'd' } }, {})).toBe(true)
    unitAt(s, 'left', 3)!.ko = true
    expect(checkCond(s, b, { inSquadra: { wizardId: 'd' } }, {})).toBe(false)
  })
  it('soglie HP', () => {
    const s = mk(); const b = unitAt(s, 'left', 1)!
    s.sides[1].hp = s.sides[1].hpMax * 0.2
    expect(checkCond(s, b, { hpNemicaSotto: 0.3 }, {})).toBe(true)
    expect(checkCond(s, b, { hpNemicaSotto: 0.1 }, {})).toBe(false)
    s.sides[0].hp = s.sides[0].hpMax * 0.4
    expect(checkCond(s, b, { hpPropriaSotto: 0.5 }, {})).toBe(true)
  })
  it('hpNemicaSotto tiene conto della soglia Carnefice del lato', () => {
    const s = mk(); const b = unitAt(s, 'left', 1)!
    s.sides[1].hp = s.sides[1].hpMax * 0.33; s.sides[0].sogliaBonus = 0.05
    expect(checkCond(s, b, { hpNemicaSotto: 0.3 }, {})).toBe(true)   // 0.30 + 0.05 = 0.35 > 0.33
  })
  it('segnoNemico, bersaglio, entroSecondiDa, ogniNLanci, slotVuotiOKo, nessunAdiacente, chance', () => {
    const s = mk(); const b = unitAt(s, 'left', 1)!; const r0 = unitAt(s, 'right', 0)!
    s.sides[1].segni.scossa = 3
    expect(checkCond(s, b, { segnoNemico: { segno: 'scossa', min: 3 } }, {})).toBe(true)
    r0.statuses.push({ kind: 'gelo', remaining: 1 })
    expect(checkCond(s, b, { bersaglio: 'gelato' }, { bersaglio: r0 })).toBe(true)
    expect(checkCond(s, b, { bersaglio: 'lento' }, { bersaglio: r0 })).toBe(false)
    s.t = 5; s.sides[0].lastGeloAt = 3.5
    expect(checkCond(s, b, { entroSecondiDa: { evento: 'gelo', secondi: 2 } }, {})).toBe(true)
    s.sides[0].lastGeloAt = 2
    expect(checkCond(s, b, { entroSecondiDa: { evento: 'gelo', secondi: 2 } }, {})).toBe(false)
    b.lastAdjacentCastAt = 4
    expect(checkCond(s, b, { entroSecondiDa: { evento: 'lancioAdiacente', secondi: 2 } }, {})).toBe(true)
    b.casts = 3
    expect(checkCond(s, b, { ogniNLanci: 3 }, {})).toBe(true)
    b.casts = 4
    expect(checkCond(s, b, { ogniNLanci: 3 }, {})).toBe(false)
    expect(checkCond(s, b, { slotVuotiOKo: true }, {})).toBe(true)     // slot 2, 4, 5 vuoti
    expect(checkCond(s, b, { nessunAdiacente: true }, {})).toBe(false)
    const s2 = createState(squad({ id: 'solo' }), squad({ id: 'x' }), createRng(1))
    expect(checkCond(s2, unitAt(s2, 'left', 0)!, { nessunAdiacente: true }, {})).toBe(true)
    // chance: deterministica col seed, e consuma rng
    const s3 = createState(squad({}), squad({}), createRng(42))
    const before = s3.rng.next(); void before
    const s4 = createState(squad({}), squad({}), createRng(42))
    s4.rng.next()
    expect(checkCond(s3, unitAt(s3, 'left', 0)!, { chance: 1 }, {})).toBe(true)
    expect(checkCond(s4, unitAt(s4, 'left', 0)!, { chance: 0 }, {})).toBe(false)
  })
})
