import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuoTracker } from '@/components/draft/DuoTracker'
import { DUOS } from '@/data/duos'

const mage = (id: string, role: string, tags: string[] = [], house = 'Grifondoro') =>
  ({ wizard: { id, name: id, house, role, tags }, level: 1, stats: {}, maxHp: 100 }) as any

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

// Fase 2 del piano "Un solo asse": il tracker è UN pannello solo — i segnali col loro grado
// (l'ex ArchetypeTracker/«Costellazioni») e le combo che accendono.
describe('DuoTracker — registro dei segnali (grado 1 / grado 2)', () => {
  it('a squadra vuota non c’è registro: il pannello è la sola lista delle combo', () => {
    const { container } = render(<DuoTracker picks={[]} />)
    expect(container.querySelector('[data-testid="signal-ledger"]')).toBeNull()
  })

  it('mostra il grado di ogni segnale in uso: veleno 2/3 acceso, non ancora potenziato', () => {
    const picks = [mage('v1', 'Attaccante', ['veleno']), mage('v2', 'Controllo', ['veleno'])]
    const { container } = render(<DuoTracker picks={picks} />)
    const row = container.querySelector('[data-testid="signal-veleno"]')!
    expect(row).toHaveAttribute('data-grade', '1')
    expect(row).toHaveTextContent('2/3')
    expect(row).toHaveTextContent(/acceso/i)
    expect(row).not.toHaveAttribute('data-tier2')
  })

  it('il contatore mostra lo scaglione in corso: 1/2 da spento (come le gemme), poi 2/3', () => {
    const uno = render(<DuoTracker picks={[mage('v1', 'Attaccante', ['veleno'])]} />)
    expect(uno.container.querySelector('[data-testid="signal-veleno"]')).toHaveTextContent('1/2')
    const due = render(<DuoTracker picks={[mage('v1', 'Attaccante', ['veleno']), mage('v2', 'Controllo', ['veleno'])]} />)
    expect(due.container.querySelector('[data-testid="signal-veleno"]')).toHaveTextContent('2/3')
  })

  it('al terzo mago col tag il segnale è POTENZIATO e dice il bonus in italiano', () => {
    const picks = [mage('v1', 'Attaccante', ['veleno']), mage('v2', 'Controllo', ['veleno']), mage('v3', 'Supporto', ['veleno'])]
    const { container } = render(<DuoTracker picks={picks} />)
    const row = container.querySelector('[data-testid="signal-veleno"]')!
    expect(row).toHaveAttribute('data-grade', '2')
    expect(row).toHaveAttribute('data-tier2')
    expect(row).toHaveTextContent('3/3')
    expect(row).toHaveTextContent(/potenziato/i)
    expect(row).toHaveTextContent(/\+50% ai danni da veleno/i)
  })

  it('ANTEPRIMA 2→3: col candidato considerato il segnale si marca "potenzia" PRIMA del click', () => {
    const picks = [mage('v1', 'Attaccante', ['veleno']), mage('v2', 'Controllo', ['veleno'])]
    const candidate = mage('v3', 'Supporto', ['veleno'])
    const { container } = render(<DuoTracker picks={picks} considered={candidate} />)
    const row = container.querySelector('[data-testid="signal-veleno"]')!
    expect(row).toHaveAttribute('data-tier2-incoming')
    expect(row).toHaveAttribute('data-grade', '2')
    expect(row).toHaveTextContent(/potenzia/i)
    expect(row).toHaveTextContent(/\+50% ai danni da veleno/i)
  })

  it('a 2/3 indica cosa compra il terzo mago', () => {
    const picks = [mage('v1', 'Attaccante', ['veleno']), mage('v2', 'Controllo', ['veleno'])]
    const { container } = render(<DuoTracker picks={picks} />)
    expect(container.querySelector('[data-testid="tier2-next-veleno"]')).toHaveTextContent(/1 mago Veleno/i)
  })

  it('i segnali di RUOLO stanno nello stesso registro (nessuna seconda lista)', () => {
    const { container } = render(<DuoTracker picks={[mage('t', 'Tank')]} />)
    const row = container.querySelector('[data-testid="signal-taunt"]')!
    expect(row).toHaveAttribute('data-grade', '1')
    // Il ruolo non ha grado 2: niente riga "potenziato".
    expect(row).not.toHaveAttribute('data-tier2')
  })

  it('lo swap che porta il segnale sotto soglia lo marca in perdita', () => {
    const prevTeam = [mage('v1', 'Attaccante', ['veleno']), mage('v2', 'Controllo', ['veleno'])]
    const picks = [mage('v1', 'Attaccante', ['veleno'])]
    const candidate = mage('c', 'Supporto')
    const { container } = render(<DuoTracker picks={picks} considered={candidate} prevTeam={prevTeam} />)
    const row = container.querySelector('[data-testid="signal-veleno"]')!
    expect(row).toHaveAttribute('data-grade-down')
    expect(row).toHaveTextContent(/si spegne/i)
  })
})

describe('DuoTracker — perdite (recruit a squadra piena)', () => {
  it('marca "si spegne" (data-breaks) il Duo che lo swap disattiva', () => {
    // prevTeam: Cancrena attivo (2 maghi veleno+esecuzione). Considero un candidato inerte
    // al posto di uno dei due → picks = team meno il rimpiazzato = solo 'a'.
    const prevTeam = [mage('a', 'Attaccante', ['veleno', 'esecuzione']), mage('b', 'Tank', ['veleno', 'esecuzione'])]
    const picks = [mage('a', 'Attaccante', ['veleno', 'esecuzione'])]
    const candidate = mage('c', 'Controllo')
    const { container } = render(<DuoTracker picks={picks} considered={candidate} prevTeam={prevTeam} />)
    const row = container.querySelector('[data-duo="cancrena"]')!
    expect(row).toHaveAttribute('data-breaks')
    expect(row).toHaveTextContent(/si spegne/i)
  })

  it('l’avviso di perdita del TRIO di casata è ancora nel pannello unico', () => {
    // prevTeam: 3 Grifondoro con Cancrena attivo → Trio di Grifondoro acceso.
    const a = mage('a', 'Attaccante', ['veleno', 'esecuzione'])
    const b = mage('b', 'Tank', ['veleno', 'esecuzione'])
    const c = mage('c', 'Supporto')
    const candidate = mage('d', 'Controllo', [], 'Serpeverde')
    const { container } = render(<DuoTracker picks={[a, b]} considered={candidate} prevTeam={[a, b, c]} />)
    const warn = container.querySelector('[data-testid="trio-loss-Grifondoro"]')!
    expect(warn).not.toBeNull()
    expect(warn).toHaveTextContent(/Trio di Grifondoro si spegne/i)
  })

  it('senza prevTeam il comportamento è invariato (nessuna riga breaks)', () => {
    const picks = [mage('a', 'Attaccante', ['veleno', 'esecuzione'])]
    const candidate = mage('c', 'Controllo')
    const { container } = render(<DuoTracker picks={picks} considered={candidate} />)
    expect(container.querySelector('[data-breaks]')).toBeNull()
  })
})
