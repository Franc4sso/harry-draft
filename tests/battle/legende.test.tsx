import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LegendaBersagli } from '@/components/battle/LegendaBersagli'
import { SigilloDuo } from '@/components/battle/SigilloDuo'
import { DUO_BY_ID } from '@/data/duos'
import { TARGET_REASON_LABEL } from '@/types'
import type { ActiveDuo } from '@/types'

/**
 * 2026-09-16 — Le due legende laterali.
 *
 * Richiesta dell'utente: «per quanto riguarda chi attacca chi, io lo metterei al
 * lato, come legenda, come metterei anche come legenda le combo che una persona
 * fa; vedere le combo una sotto l'altra in un elenco, sono veramente brutte».
 *
 * Le colonne laterali sono libere per vincolo del piano ("niente occupa le colonne
 * laterali") — misurate 120px per lato a 1600x900, simmetriche.
 *
 * La legenda dei bersagli NON inventa una tassonomia propria: legge
 * `TARGET_REASON_LABEL`, le stesse cinque ragioni che `explainTarget` produce e
 * che il motore attacca a `entry.reason`. Una seconda verità qui divergerebbe dal
 * motore alla prima modifica — l'errore che ha già fatto fallire un piano qui.
 */
describe('LegendaBersagli — legge il motore, non una copia', () => {
  it('mostra tutte e cinque le ragioni del motore', () => {
    render(<LegendaBersagli />)
    for (const label of Object.values(TARGET_REASON_LABEL)) {
      expect(screen.getByText(new RegExp(label, 'i'))).toBeInTheDocument()
    }
  })

  it('evidenzia la ragione del turno corrente', () => {
    render(<LegendaBersagli attiva="taunt" />)
    expect(screen.getByTestId('bersaglio-taunt')).toHaveAttribute('data-attiva', 'true')
    expect(screen.getByTestId('bersaglio-dive')).not.toHaveAttribute('data-attiva', 'true')
  })

  it('senza ragione attiva nessuna riga è evidenziata', () => {
    render(<LegendaBersagli />)
    expect(screen.getByTestId('bersaglio-taunt')).not.toHaveAttribute('data-attiva', 'true')
  })
})

describe('SigilloDuo — due metà, un segnale ciascuna', () => {
  const duo = (id: string): ActiveDuo => ({ duo: DUO_BY_ID[id]!, units: [] } as unknown as ActiveDuo)

  it('disegna UNA metà per ciascuno dei due segnali del Duo', () => {
    // Cancrena = veleno + esecuzione: il sigillo deve dire da cosa NASCE la combo,
    // non solo il suo nome. E' il motivo per cui l'elenco verticale non bastava.
    render(<SigilloDuo active={duo('cancrena')} firing={false} />)
    const meta = screen.getAllByTestId('sigillo-duo-meta')
    expect(meta).toHaveLength(2)
    expect(meta[0]).toHaveAttribute('data-segnale', 'veleno')
    expect(meta[1]).toHaveAttribute('data-segnale', 'esecuzione')
  })

  it('porta il nome della combo', () => {
    render(<SigilloDuo active={duo('miasma')} firing={false} />)
    expect(screen.getByText(/miasma/i)).toBeInTheDocument()
  })

  it('si accende quando la combo scatta', () => {
    const { rerender } = render(<SigilloDuo active={duo('miasma')} firing={false} />)
    expect(screen.getByTestId('sigillo-duo')).not.toHaveAttribute('data-firing', 'true')
    rerender(<SigilloDuo active={duo('miasma')} firing />)
    expect(screen.getByTestId('sigillo-duo')).toHaveAttribute('data-firing', 'true')
  })

  it('ogni metà prende il colore del PROPRIO segnale, non uno comune', () => {
    // Due metà dello stesso colore sarebbero un gettone con una riga in mezzo:
    // il colore è ciò che rende leggibile da quali due segnali nasce la combo.
    render(<SigilloDuo active={duo('cancrena')} firing={false} />)
    const [a, b] = screen.getAllByTestId('sigillo-duo-meta')
    expect(a!.getAttribute('data-colore')).not.toBe(b!.getAttribute('data-colore'))
  })
})
