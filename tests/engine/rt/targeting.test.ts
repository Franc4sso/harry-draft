// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt } from '@/game/engine/rt/state'
import { unitTarget, selectTargets } from '@/game/engine/rt/targeting'
import { createRng } from '@/game/engine/rng'
import { squad } from './fixtures'

const L = () => squad({ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }, { id: 'l5' })

describe('unitTarget', () => {
  it('opposto quando vivo', () => {
    const s = createState(L(), squad({ id: 'r0' }, { id: 'r1' }), createRng(1))
    expect(unitTarget(s, 'left', 1)!.id).toBe('r1')
  })
  it('Copertura: seconda fila coperta dal davanti', () => {
    const s = createState(L(), squad({ id: 'r0' }, undefined, undefined, { id: 'r3' }), createRng(1))
    expect(unitTarget(s, 'left', 3)!.id).toBe('r0')
    expect(unitTarget(s, 'left', 3, { ignoraCopertura: true })!.id).toBe('r3')
  })
  it('Copertura non scatta se il davanti è KO', () => {
    const s = createState(L(), squad({ id: 'r0' }, undefined, undefined, { id: 'r3' }), createRng(1))
    unitAt(s, 'right', 0)!.ko = true
    expect(unitTarget(s, 'left', 3)!.id).toBe('r3')
  })
  it('opposto vuoto → più vicino nella stessa riga, sinistra prima', () => {
    const s = createState(L(), squad({ id: 'r0' }, undefined, { id: 'r2' }), createRng(1))
    expect(unitTarget(s, 'left', 1)!.id).toBe('r0')
    const s2 = createState(L(), squad(undefined, undefined, { id: 'r2' }), createRng(1))
    expect(unitTarget(s2, 'left', 0)!.id).toBe('r2')
  })
  it('riga vuota → casuale tra i vivi (deterministico col seed)', () => {
    const s = createState(L(), squad(undefined, undefined, undefined, { id: 'r3' }, { id: 'r4' }), createRng(3))
    const a = unitTarget(s, 'left', 0)!.id
    const s2 = createState(L(), squad(undefined, undefined, undefined, { id: 'r3' }, { id: 'r4' }), createRng(3))
    expect(unitTarget(s2, 'left', 0)!.id).toBe(a)
    expect(['r3', 'r4']).toContain(a)
  })
  it('nessun vivo → null', () => {
    const s = createState(L(), squad({ id: 'r0' }), createRng(1))
    unitAt(s, 'right', 0)!.ko = true
    expect(unitTarget(s, 'left', 0)).toBeNull()
  })
})

describe('selectTargets', () => {
  const R = () => squad({ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' })
  it('posizionali sul proprio lato', () => {
    const s = createState(L(), R(), createRng(1))
    const me = unitAt(s, 'left', 4)!
    const ids = (t: Parameters<typeof selectTargets>[2]) => selectTargets(s, me, t).map(u => u.id).sort()
    expect(ids('se')).toEqual(['l4'])
    expect(ids('davanti')).toEqual(['l1'])
    expect(ids('dietro')).toEqual([])
    expect(ids('sinistra')).toEqual(['l3'])
    expect(ids('destra')).toEqual(['l5'])
    expect(ids('adiacenti')).toEqual(['l1', 'l3', 'l5'])
    expect(ids('riga')).toEqual(['l3', 'l4', 'l5'])
    expect(ids('colonna')).toEqual(['l1', 'l4'])
    expect(ids('tuttiAlleati')).toHaveLength(6)
  })
  it('filtri per tag/casa/ruolo e slot minimo', () => {
    const left = squad({ id: 'a', tags: ['weasley'], house: 'Serpeverde' }, { id: 'b', role: 'Tank' }, { id: 'c', tags: ['weasley'] })
    const s = createState(left, R(), createRng(1))
    const me = unitAt(s, 'left', 1)!
    expect(selectTargets(s, me, 'alleatiTag', 'weasley').map(u => u.id)).toEqual(['a', 'c'])
    expect(selectTargets(s, me, 'alleatiCasa', 'Serpeverde').map(u => u.id)).toEqual(['a'])
    expect(selectTargets(s, me, 'alleatiRuolo', 'Tank').map(u => u.id)).toEqual(['b'])
    unitAt(s, 'left', 0)!.ko = true
    expect(selectTargets(s, me, 'alleatoSlotMinimo').map(u => u.id)).toEqual(['a'])   // il KO con slot più basso (per Rianima)
  })
  it('nemici: opposto (con Copertura), prima fila, tutti, adiacente del bersaglio', () => {
    const s = createState(L(), R(), createRng(1))
    const me = unitAt(s, 'left', 4)!
    expect(selectTargets(s, me, 'opposto').map(u => u.id)).toEqual(['r1'])   // r4 coperto da r1
    expect(selectTargets(s, me, 'primaFilaNemica').map(u => u.id).sort()).toEqual(['r0', 'r1', 'r2'])
    expect(selectTargets(s, me, 'tuttiNemici')).toHaveLength(6)
    const b = unitAt(s, 'right', 1)!
    expect(selectTargets(s, me, 'adiacenteDelBersaglio', undefined, { bersaglio: b }).map(u => u.id).sort()).toEqual(['r0', 'r2', 'r4'])
  })
  it('nemicoCasuale consuma rng ed esclude i KO', () => {
    const s = createState(L(), squad({ id: 'r0' }, { id: 'r1' }), createRng(5))
    unitAt(s, 'right', 0)!.ko = true
    expect(selectTargets(s, unitAt(s, 'left', 0)!, 'nemicoCasuale').map(u => u.id)).toEqual(['r1'])
  })
})
