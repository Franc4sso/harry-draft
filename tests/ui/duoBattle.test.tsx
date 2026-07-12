import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { calloutFor } from '@/components/battle/Callout'
import { DuoPills } from '@/components/battle/DuoPills'
import { DUO_BY_ID } from '@/data/duos'
import type { LogEntry } from '@/types'

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  turn: 1, actorId: 'a', actorSide: 'left', action: 'Colpo', targetId: 'z', targetSide: 'right',
  type: 'Attacco', value: 10, flags: [], ...over,
})

describe('annuncio del Duo in battaglia', () => {
  it('al primo scatto il Duo VINCE su ESECUZIONE', () => {
    // Il frame del cold-execute è ANCHE un frame di esecuzione (crit+kill): senza la regola
    // di priorità il giocatore leggerebbe "ESECUZIONE" invece del nome della combo.
    const e = entry({ flags: ['crit', 'kill', 'duo'], duoId: 'esecuzione-a-freddo' })
    const co = calloutFor(e, null, DUO_BY_ID['esecuzione-a-freddo']!.name)
    expect(co?.text).toBe('ESECUZIONE A FREDDO')
  })

  it('senza nome (= non è il primo scatto) si comporta come prima', () => {
    const e = entry({ flags: ['crit', 'kill', 'duo'], duoId: 'esecuzione-a-freddo' })
    const co = calloutFor(e, null, null)
    expect(co?.text).toBe('ESECUZIONE')
  })

  it('le pill elencano i Duo attivi e solo quella che scatta lampeggia', () => {
    const duos = [{ duo: DUO_BY_ID['mietitore']! }, { duo: DUO_BY_ID['muro-vivente']! }]
    const { container } = render(<DuoPills duos={duos} firingId="mietitore" />)
    expect(screen.getByText('Mietitore')).toBeInTheDocument()
    expect(screen.getByText('Muro Vivente')).toBeInTheDocument()
    expect(container.querySelector('[data-duo-pill="mietitore"][data-firing]')).not.toBeNull()
    expect(container.querySelector('[data-duo-pill="muro-vivente"][data-firing]')).toBeNull()
  })

  it('senza Duo attivi non disegna nulla', () => {
    const { container } = render(<DuoPills duos={[]} firingId={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
