import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import type { ReplayUnit, Replay } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const unit = (over: Partial<ReplayUnit> = {}): ReplayUnit => ({
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
  ...over,
})

// Il describe "UnitBust: lampo SALTA" che testava UnitBust direttamente è stato rimosso
// (Task 11 — UnitBust cancellato): il lampo SALTA vive ora SOLO dentro BattleArena (mai
// più su una card isolata), quindi la copertura sotto — che già passava per BattleArena —
// è l'unica che resta, ed è invariata nel suo principio.
//
// 2026-09-16 (Task 5, "la scena, composta"): lo stage a due Duellante grandi (Task 3) è
// stato respinto dall'utente a schermo — "fa totalmente schifo" — e sostituito da dieci
// CartaCombat complete e uguali, in due file. Non esistono più gli slot `stage-attore`/
// `stage-bersaglio` (erano wrapper posizionati assolutamente per i due duellanti); ogni
// unità — inclusa quella che salta — è ora semplicemente una `carta-combat` nella sua riga,
// col lampo SALTA come fratello DENTRO il wrapper `relative` che BattleArena crea per ogni
// carta (vedi `renderRow` in BattleArena.tsx: `<div key={u.key} className="relative">` col
// ribbon, la CartaCombat, e il flash SALTA tutti come fratelli). Questa riscrittura sostituisce
// la query sullo slot di scena con una query sul wrapper della carta stessa, individuata da
// `data-unit-key`.
describe('BattleArena: un frame Stordito salta il turno senza accendere acting', () => {
  const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
    turn: 1, actorId: 'x', actorSide: 'left', action: 'Colpo', targetId: 'foe', targetSide: 'right',
    type: 'Attacco', value: 10, flags: [], ...over,
  })
  const stordito: LogEntry = {
    turn: 2, actorId: 'x', actorSide: 'left', action: 'Stordito', type: 'system', flags: ['stun'],
  }
  const replay = {
    units: [unit(), unit({ key: 'right:foe', id: 'foe', side: 'right' })],
    frames: [
      { statusEffects: {}, cooldowns: {}, entry: null },
      {
        statusEffects: { 'left:x': [{ kind: 'stun', remaining: 1 }] },
        cooldowns: {},
        entry: stordito,
      },
    ],
  } as unknown as Replay
  const hp = { 'left:x': 80, 'right:foe': 100 }

  it('mostra SALTA sull\'unità e NON la fa sembrare in azione', () => {
    render(<BattleArena replay={replay} hp={hp} entry={stordito} frameKey={1} />)
    // L'unità che salta è l'attore di questo frame (Stordito porta il suo `actorSide`),
    // quindi porta il ribbon ◆ LANCIA e la cornice dorata "attore" sulla sua carta. Nessuna
    // motion class fx-strike si accende (lo Stordito non produce un colpo, produce lo
    // shiver+SALTA).
    const skipper = document.querySelector('[data-testid="carta-combat"][data-unit-key="left:x"]') as HTMLElement
    expect(skipper).not.toBeNull()
    expect(skipper).not.toHaveClass('fx-strike')
    expect(skipper.getAttribute('data-ruolo')).toBe('attore')
    const wrapper = skipper.closest('.relative') as HTMLElement
    const flash = wrapper.querySelector('[data-skipping]')
    expect(flash).toHaveAttribute('data-skipping', 'stun')
    expect(flash).toHaveTextContent(/salta/i)
  })

  it('un frame di attacco NORMALE non mostra SALTA', () => {
    const normalReplay = {
      units: replay.units,
      frames: [
        { statusEffects: {}, cooldowns: {}, entry: null },
        { statusEffects: {}, cooldowns: {}, entry: entry() },
      ],
    } as unknown as Replay
    const { container } = render(<BattleArena replay={normalReplay} hp={hp} entry={entry()} frameKey={1} />)
    expect(container.querySelector('[data-skipping]')).toBeNull()
  })
})
