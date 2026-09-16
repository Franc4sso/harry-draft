// tests/battle/statusAura.test.ts
import { describe, it, expect } from 'vitest'
import { auraFor } from '@/components/battle/statusAura'
import { STATUS_DEFS } from '@/data/statuses'
import type { ActiveEffect } from '@/types'

const fx = (id: string): ActiveEffect =>
  ({ kind: id, statusId: id, remaining: 2, stacks: 1 } as unknown as ActiveEffect)

describe('auraFor', () => {
  it('senza stati, nessuna aura', () => {
    expect(auraFor([])).toBeNull()
  })

  it('il veleno accende l aura del veleno', () => {
    expect(auraFor([fx('veleno')])?.kind).toBe('veleno')
  })

  it('la bruciatura ha un aura DIVERSA dal veleno', () => {
    expect(auraFor([fx('burn')])?.kind).toBe('bruciatura')
    expect(auraFor([fx('burn')])?.color).not.toBe(auraFor([fx('veleno')])?.color)
  })

  it('con più stati vince il più grave: una cornice sola', () => {
    // gelo batte veleno: se un mago è congelato E avvelenato, la cosa che conta
    // ora è che salterà il turno.
    expect(auraFor([fx('veleno'), fx('freeze')])?.kind).toBe('gelo')
    expect(auraFor([fx('regen'), fx('burn')])?.kind).toBe('bruciatura')
  })

  it('ogni stato del catalogo ha un aura — nessuno resta muto', () => {
    // Stessa forma della guardia sulle pillole: letta da STATUS_DEFS, così
    // aggiungere uno stato senza dargli un segno rende questo test rosso.
    const muti = STATUS_DEFS.filter(d => auraFor([fx(d.id)]) === null).map(d => d.id)
    expect(muti, `stati senza aura: ${muti.join(', ')}`).toEqual([])
  })
})
