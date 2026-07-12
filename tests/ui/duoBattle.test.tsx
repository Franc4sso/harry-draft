import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { calloutFor } from '@/components/battle/Callout'
import { DuoPills } from '@/components/battle/DuoPills'
import { BattleArena } from '@/components/battle/BattleArena'
import { DUO_BY_ID } from '@/data/duos'
import type { Replay } from '@/game/engine/combat/replay'
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

/**
 * La DECISIONE che unisce le due parti pure sopra: BattleArena passa `duoName` a Callout SOLO
 * quando il frame corrente è il PRIMO che marchia quel Duo. È il requisito esplicito della spec
 * ("l'annuncio centrale compare una sola volta per Duo per battaglia") e nessun test lo copriva:
 * calloutFor riceve il nome già deciso, DuoPills riceve il firingId già deciso.
 */
describe('BattleArena: l annuncio del Duo compare una sola volta per battaglia', () => {
  const CANCRENA = DUO_BY_ID['cancrena']!
  const unit = (key: string, id: string, side: 'left' | 'right') => ({
    key, id, name: id, side, house: 'Grifondoro', role: 'Attaccante', tier: 3,
    maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
    spell: { id: 's', name: 'S', cooldown: 0 },
  })
  const tick = (turn: number): LogEntry => entry({
    turn, actorId: 'vel', targetId: 'foe', action: 'Veleno', type: 'Controllo',
    flags: ['dot', 'duo'], duoId: 'cancrena',
  })
  // Due frame marchiati dallo STESSO Duo: solo il primo (indice 1) è il suo esordio.
  const replay = {
    units: [unit('left:vel', 'vel', 'left'), unit('right:foe', 'foe', 'right')],
    frames: [
      { statusEffects: {}, cooldowns: {}, entry: null },
      { statusEffects: {}, cooldowns: {}, entry: tick(1) },
      { statusEffects: {}, cooldowns: {}, entry: tick(2) },
    ],
  } as unknown as Replay
  const hp = { 'left:vel': 100, 'right:foe': 80 }
  const duos = [{ duo: CANCRENA }]

  it('al PRIMO frame marchiato annuncia il nome del Duo al centro', () => {
    const { container } = render(
      <BattleArena replay={replay} hp={hp} entry={tick(1)} frameKey={1} duos={duos} />,
    )
    expect(screen.getByTestId('battle-callout')).toHaveTextContent(CANCRENA.name.toUpperCase())
    expect(container.querySelector('[data-duo-pill="cancrena"][data-firing]')).not.toBeNull()
  })

  it('al SECONDO frame dello stesso Duo l annuncio non ripete il nome — parla solo la pill', () => {
    const { container, rerender } = render(
      <BattleArena replay={replay} hp={hp} entry={tick(1)} frameKey={1} duos={duos} />,
    )
    expect(screen.getByTestId('battle-callout')).toHaveTextContent(CANCRENA.name.toUpperCase())

    rerender(<BattleArena replay={replay} hp={hp} entry={tick(2)} frameKey={2} duos={duos} />)
    // L'annuncio col nome del Duo non torna (il frame ricade sul suo callout naturale, VELENO)…
    expect(screen.queryByTestId('battle-callout')).not.toHaveTextContent(CANCRENA.name.toUpperCase())
    // …ma la pill continua a lampeggiare: il Duo sta ancora scattando, ed è quello il segnale sottile.
    expect(container.querySelector('[data-duo-pill="cancrena"][data-firing]')).not.toBeNull()
  })
})
