// tests/battle/StatusPips.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPips } from '@/components/battle/StatusPips'
import { STATUS_DEFS } from '@/data/statuses'
import type { ActiveEffect } from '@/types'

const fx = (kind: string, extra: Record<string, unknown> = {}) =>
  ({ kind, statusId: kind, remaining: 2, stacks: 1, ...extra } as unknown as ActiveEffect)

describe('StatusPips', () => {
  it('senza stati non mostra nulla', () => {
    const { container } = render(<StatusPips effects={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('una pillola per ogni stato attivo', () => {
    render(<StatusPips effects={[fx('veleno'), fx('stun'), fx('shield')]} />)
    expect(screen.getAllByTestId('status-pip')).toHaveLength(3)
  })

  it('il veleno mostra le DOSI, non i turni rimanenti', () => {
    // Il veleno è permanente: `remaining` resta fermo a 2, il numero che cresce
    // è `stacks`. Mostrare `remaining` è un difetto storico del progetto.
    render(<StatusPips effects={[fx('veleno', { remaining: 2, stacks: 4 })]} />)
    expect(screen.getByTestId('status-pip')).toHaveTextContent('4')
  })

  it('ogni pillola ha un titolo che spiega lo stato', () => {
    render(<StatusPips effects={[fx('freeze')]} />)
    expect(screen.getByTestId('status-pip')).toHaveAttribute('title', expect.stringMatching(/congel/i))
  })

  it('stati diversi hanno colori diversi', () => {
    render(<StatusPips effects={[fx('veleno'), fx('stun')]} />)
    const [a, b] = screen.getAllByTestId('status-pip')
    expect(a!.getAttribute('data-kind')).not.toBe(b!.getAttribute('data-kind'))
  })

  it('OGNI stato del catalogo ha un glifo suo — nessuno cade sul puntino', () => {
    // Il catalogo ha 24 id, non i dieci `kind`: tre gradi di lentezza, tre di
    // indebolimento, due di vulnerabilità. Letto da `STATUS_DEFS` invece che da
    // una lista scritta a mano, così aggiungere uno stato senza dargli una
    // pillola rende questo test rosso.
    const senzaGlifo = STATUS_DEFS.filter(d => {
      render(<StatusPips effects={[fx(d.id)]} />)
      const pip = screen.getAllByTestId('status-pip').at(-1)!
      return pip.textContent?.startsWith('•')
    }).map(d => d.id)
    expect(senzaGlifo, `stati senza glifo: ${senzaGlifo.join(', ')}`).toEqual([])
  })
})
