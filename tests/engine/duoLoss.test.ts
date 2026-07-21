import { describe, it, expect } from 'vitest'
import { previewDuoLoss } from '@/game/engine/duos'
import type { DraftedWizard } from '@/types'

const dw = (id: string, role: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role, house: 'Grifondoro', tags }, level: 1 } as unknown as DraftedWizard)

describe('previewDuoLoss', () => {
  it('segnala BREAKS quando lo swap spegne un Duo attivo (Cancrena)', () => {
    // current: 2 maghi veleno+esecuzione → Cancrena attivo. next: uno rimpiazzato da un mago inerte.
    const current = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const next = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('c', 'Controllo')]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.breaks.map(d => d.id)).toContain('cancrena')
  })

  it('segnala REGRESSES quando un Duo one-away torna two-away', () => {
    // current one-away Cancrena: 2 veleno (segnale veleno acceso), esecuzione mancante.
    // next: tolgo un veleno → segnale veleno si spegne → Cancrena torna a 2 segnali mancanti.
    const current = [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno'])]
    const next = [dw('a', 'Attaccante', ['veleno']), dw('c', 'Controllo')]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.regresses.map(d => d.id)).toContain('cancrena')
    expect(loss.breaks).toHaveLength(0)
  })

  it('nessuna perdita rimuovendo un mago irrilevante', () => {
    const current = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione']), dw('x', 'Controllo')]
    const next = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.breaks).toHaveLength(0)
    expect(loss.regresses).toHaveLength(0)
  })

  it('rimuovere e ri-aggiungere lo stesso mago = nessuna perdita netta', () => {
    const current = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const next = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.breaks).toHaveLength(0)
    expect(loss.regresses).toHaveLength(0)
  })
})
