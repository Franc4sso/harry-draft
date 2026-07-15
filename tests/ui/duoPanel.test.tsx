import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DuoPanel } from '@/components/run/DuoPanel'
import { DUOS } from '@/data/duos'

// Squadra: accende MURO VIVENTE (scudirigen via 2 maghi taggati + taunt via 1 Tank) ed è a un
// passo da CANCRENA (veleno acceso dagli stessi 2 maghi, esecuzione mancante).
const team = [
  { wizard: { id: 'a', name: 'Tank', house: 'Grifondoro', role: 'Tank', tags: [] }, level: 1, stats: {}, maxHp: 100 },
  { wizard: { id: 'b', name: 'Att', house: 'Grifondoro', role: 'Attaccante', tags: ['scudirigen', 'veleno'] }, level: 1, stats: {}, maxHp: 100 },
  { wizard: { id: 'c', name: 'Sup', house: 'Grifondoro', role: 'Supporto', tags: ['scudirigen', 'veleno'] }, level: 1, stats: {}, maxHp: 100 },
] as any

describe('DuoPanel', () => {
  it('mostra TUTTI e 6 i Duo, anche quelli lontani', () => {
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    for (const d of DUOS) {
      expect(container.querySelector(`[data-duo="${d.id}"]`)).not.toBeNull()
    }
  })

  it('marca lo stato: attivo / a un passo / lontano', () => {
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    expect(container.querySelector('[data-duo="muro-vivente"][data-state="active"]')).not.toBeNull()
    expect(container.querySelector('[data-duo="cancrena"][data-state="near"]')).not.toBeNull()
    // esecuzione+controllo: nessuno dei due acceso → lontano
    expect(container.querySelector('[data-duo="esecuzione-a-freddo"][data-state="locked"]')).not.toBeNull()
  })

  it('spiega COME accendere il segnale mancante di un Duo a un passo', () => {
    render(<DuoPanel team={team} relics={[]} />)
    // A Cancrena manca Esecuzione: la soglia reale è "2 maghi ... oppure 1 reliquia".
    expect(screen.getByTestId('howto-cancrena')).toHaveTextContent(/2 maghi/i)
    expect(screen.getByTestId('howto-cancrena')).toHaveTextContent(/reliquia/i)
  })

  it('il Tank si accende con UN SOLO Tank (soglia asimmetrica, non 2)', () => {
    // Squadra senza Tank: Muro Vivente diventa "a un passo" e il suo howto deve dire 1 Tank.
    const noTank = [
      { wizard: { id: 'b', name: 'Att', house: 'Grifondoro', role: 'Attaccante', tags: ['scudirigen'] }, level: 1, stats: {}, maxHp: 100 },
      { wizard: { id: 'c', name: 'Sup', house: 'Grifondoro', role: 'Supporto', tags: ['scudirigen'] }, level: 1, stats: {}, maxHp: 100 },
    ] as any
    render(<DuoPanel team={noTank} relics={[]} />)
    const howto = screen.getByTestId('howto-muro-vivente')
    expect(howto).toHaveTextContent(/1 Tank/i)
    expect(howto).not.toHaveTextContent(/2 Tank/i)
  })

  it('non nomina MAI il segnale Attaccante: nessun Duo spedito lo usa', () => {
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    expect(container.textContent).not.toContain('Attaccante')
  })

  it('le gemme mostrano il conteggio have/need dei maghi che contribuiscono', () => {
    // Cancrena (veleno+esecuzione): il team ha 2 maghi veleno (acceso → ✓) ma 0 esecuzione (0/2).
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    const cancrena = container.querySelector('[data-duo="cancrena"]')!
    const veleno = cancrena.querySelector('[data-signal="veleno"]')!
    const esec = cancrena.querySelector('[data-signal="esecuzione"]')!
    expect(veleno).toHaveTextContent('✓')       // 2/2 → acceso
    expect(esec).toHaveTextContent('0/2')       // nessun mago esecuzione
  })

  it('una gemma accesa da una reliquia mostra "reliquia", non un conteggio maghi', () => {
    // Team senza maghi veleno + una reliquia veleno → il segnale veleno è acceso dalla reliquia.
    const noVenom = [
      { wizard: { id: 'a', name: 'Tank', house: 'Grifondoro', role: 'Tank', tags: [] }, level: 1, stats: {}, maxHp: 100 },
    ] as any
    const venomRelic = [{ relic: { id: 'r', name: '', desc: '', rarity: 'comune', keywords: ['veleno'] } }] as any
    const { container } = render(<DuoPanel team={noVenom} relics={venomRelic} />)
    const veleno = container.querySelector('[data-duo="cancrena"] [data-signal="veleno"]')!
    expect(veleno).toHaveTextContent(/reliquia/i)
  })

  it('ignora i maghi CADUTI: un Duo il cui 2° contributore è morto non risulta attivo', () => {
    // Due Attaccanti portano entrambi veleno+esecuzione, il che accenderebbe Cancrena — ma uno
    // è K.O. (currentHp 0). Con un solo contributore vivo nessuno dei due segnali raggiunge la
    // soglia >=2, quindi Cancrena NON deve risultare "active" (usa livingOf, non tutta la
    // squadra: altrimenti la sidebar mentirebbe rispetto a cosa si accende in battaglia).
    const withFallen = [
      { wizard: { id: 'live', name: 'Vivo', house: 'Grifondoro', role: 'Attaccante', tags: ['veleno', 'esecuzione'] }, level: 1, stats: {}, maxHp: 100, currentHp: 80 },
      { wizard: { id: 'dead', name: 'Morto', house: 'Grifondoro', role: 'Attaccante', tags: ['veleno', 'esecuzione'] }, level: 1, stats: {}, maxHp: 100, currentHp: 0 },
    ] as any
    const { container } = render(<DuoPanel team={withFallen} relics={[]} />)
    expect(container.querySelector('[data-duo="cancrena"][data-state="active"]')).toBeNull()
  })

  it('un Duo LONTANO è compatto (niente desc/howto) e si espande su tap', async () => {
    const user = userEvent.setup()
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    // Mietitore (esecuzione+magieOscure) è lontano: desc e howto nascosti finché non espandi.
    const row = container.querySelector('[data-duo="mietitore"]')!
    expect(row).toHaveAttribute('data-state', 'locked')
    expect(row).not.toHaveTextContent(/carnefice/i)
    expect(screen.queryByTestId('howto-mietitore')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Espandi Mietitore/i }))
    expect(row).toHaveTextContent(/carnefice/i)
    expect(screen.getByTestId('howto-mietitore')).toBeInTheDocument()
  })

  it('mostra il Trio di Casata quando 3+ maghi condividono la casata E un Duo è attivo', () => {
    // `team` sopra: 3 Grifondoro + Muro Vivente attivo → il Trio Grifondoro deve comparire.
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    const panel = container.querySelector('[data-testid="trio-panel"]')
    expect(panel).not.toBeNull()
    const row = panel!.querySelector('[data-house="Grifondoro"]')
    expect(row).not.toBeNull()
    expect(row).toHaveTextContent('Slancio: cooldown delle tue spell −1')
  })

  it('NON mostra alcun Trio se 3+ condividono la casata ma NESSUN Duo è attivo', () => {
    // 3 Grifondoro ma nessun ruolo/tag duplicato: nessun segnale Duo si accende.
    const noDuo = [
      { wizard: { id: 'x', name: 'X', house: 'Grifondoro', role: 'Attaccante', tags: [] }, level: 1, stats: {}, maxHp: 100 },
      { wizard: { id: 'y', name: 'Y', house: 'Grifondoro', role: 'Controllo', tags: [] }, level: 1, stats: {}, maxHp: 100 },
      { wizard: { id: 'z', name: 'Z', house: 'Grifondoro', role: 'Supporto', tags: [] }, level: 1, stats: {}, maxHp: 100 },
    ] as any
    const { container } = render(<DuoPanel team={noDuo} relics={[]} />)
    expect(container.querySelector('[data-testid="trio-panel"]')).toBeNull()
  })
})
