import { describe, it, expect } from 'vitest'
import { pilloleDi, auraDi } from '@/lib/battleStacks'
import { STATUS_DEFS } from '@/data/statuses'
import type { ActiveEffect } from '@/types'

const fx = (id: string, over: Partial<ActiveEffect> = {}): ActiveEffect =>
  ({ kind: id, statusId: id, remaining: 2, stacks: 1, ...over } as unknown as ActiveEffect)

describe('pilloleDi — una per famiglia, col totale', () => {
  it('tre dosi di veleno sono UNA pillola che dice 3', () => {
    // La correzione dell'utente: «I VELENI, COME LE BRUCIATURE E COME GLI SCUDI,
    // VANNO SOMMATI, NON MI METTERE 3 ICONE PER 3 VELENI».
    const p = pilloleDi([fx('veleno', { stacks: 3 })])
    expect(p).toHaveLength(1)
    expect(p[0]!.count).toBe(3)
  })

  it('anche se il motore manda tre voci separate, la pillola resta una', () => {
    const p = pilloleDi([fx('veleno'), fx('veleno'), fx('veleno')])
    expect(p.filter(x => x.kind === 'veleno')).toHaveLength(1)
    expect(p[0]!.count).toBe(3)
  })

  it('lo scudo mostra i PUNTI assorbibili, non le dosi', () => {
    // shield non accumula (`stack:'refresh'`): ha `absorb`, punti che calano.
    const p = pilloleDi([fx('shield', { absorbLeft: 38 } as never)])
    expect(p[0]!.count).toBe(38)
  })

  it('stati diversi restano pillole diverse', () => {
    const p = pilloleDi([fx('veleno'), fx('burn'), fx('silence')])
    expect(new Set(p.map(x => x.kind)).size).toBe(3)
  })

  it('senza stati, nessuna pillola', () => {
    expect(pilloleDi([])).toEqual([])
  })

  it('ogni stato del catalogo produce una pillola con glifo e nome', () => {
    const muti = STATUS_DEFS.filter(d => {
      const p = pilloleDi([fx(d.id)])
      return p.length === 0 || !p[0]!.glyph || !p[0]!.label
    }).map(d => d.id)
    expect(muti, `stati senza pillola: ${muti.join(', ')}`).toEqual([])
  })
})

describe('auraDi — intensità, non presenza', () => {
  it('una dose sola di veleno NON accende l aura', () => {
    // Misurato: con il Duo Miasma che propaga a cinque alleati, cinque cornici
    // tratteggiate insieme sono illeggibili e costano 19 fps contro 52.
    expect(auraDi([fx('veleno', { stacks: 1 })])).toBeNull()
  })

  it('due dosi la accendono', () => {
    expect(auraDi([fx('veleno', { stacks: 2 })])?.kind).toBe('veleno')
  })

  it('gli stati che bloccano il turno la accendono sempre', () => {
    expect(auraDi([fx('freeze')])?.kind).toBe('freeze')
    expect(auraDi([fx('stun')])?.kind).toBe('stun')
  })

  it('con più stati vince il più grave, e l aura resta UNA', () => {
    const a = auraDi([fx('veleno', { stacks: 4 }), fx('freeze')])
    expect(a?.kind).toBe('freeze')
  })
})
