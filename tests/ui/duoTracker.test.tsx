import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuoTracker } from '@/components/draft/DuoTracker'
import { DUOS } from '@/data/duos'

const mage = (id: string, role: string, tags: string[] = []) =>
  ({ wizard: { id, name: id, house: 'Grifondoro', role, tags }, level: 1, stats: {}, maxHp: 100 }) as any

describe('DuoTracker (draft rail)', () => {
  it('mostra TUTTE e 6 le combo in forma compatta, anche a squadra vuota', () => {
    const { container } = render(<DuoTracker picks={[]} />)
    for (const d of DUOS) {
      expect(container.querySelector(`[data-duo="${d.id}"]`)).not.toBeNull()
    }
    expect(screen.getByTestId('draft-duo-tracker')).toBeInTheDocument()
  })

  it('marca "si attiva" la combo che il candidato considerato completa', () => {
    // Tank già in squadra (taunt acceso) + 1 mago scudirigen; il candidato porta il 2°
    // scudirigen → Muro Vivente si accende SE peschi lui.
    const picks = [mage('t', 'Tank'), mage('s1', 'Supporto', ['scudirigen'])]
    const candidate = mage('s2', 'Controllo', ['scudirigen'])
    const { container } = render(<DuoTracker picks={picks} considered={candidate} />)
    const row = container.querySelector('[data-duo="muro-vivente"]')!
    expect(row).toHaveAttribute('data-completes')
    expect(row).toHaveTextContent(/si attiva/i)
    // L'effetto della combo compare quando si accende.
    expect(row).toHaveTextContent(/riflette/i)
  })

  it('marca "avanza" la combo che passa da 2 segnali spenti a 1', () => {
    // 1 mago veleno in squadra; il candidato porta il 2° veleno → il segnale veleno si accende
    // e Cancrena (veleno+esecuzione) resta a un solo segnale mancante: avanza.
    const picks = [mage('v1', 'Attaccante', ['veleno'])]
    const candidate = mage('v2', 'Controllo', ['veleno'])
    const { container } = render(<DuoTracker picks={picks} considered={candidate} />)
    const row = container.querySelector('[data-duo="cancrena"]')!
    expect(row).toHaveAttribute('data-advances')
    expect(row).toHaveTextContent(/avanza/i)
  })

  it('le gemme includono il candidato considerato nel conteggio', () => {
    const picks = [mage('v1', 'Attaccante', ['veleno'])]
    const candidate = mage('v2', 'Controllo', ['veleno'])
    const { container } = render(<DuoTracker picks={picks} considered={candidate} />)
    const veleno = container.querySelector('[data-duo="cancrena"] [data-signal="veleno"]')!
    expect(veleno).toHaveTextContent('✓') // 2/2 col candidato
  })

  it('senza candidato, una combo lontana resta compatta: niente descrizione', () => {
    const { container } = render(<DuoTracker picks={[]} />)
    const row = container.querySelector('[data-duo="mietitore"]')!
    expect(row).toHaveAttribute('data-state', 'locked')
    expect(row).not.toHaveTextContent(/carnefice/i)
  })
})
