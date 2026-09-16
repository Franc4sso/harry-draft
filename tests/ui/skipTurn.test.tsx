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
// è l'unica che resta, ed è invariata.
//
// 2026-09-16 (Task 3, "il palco"): la card WizardCard density="combat" (`battle-unit`) è
// sparita — chi salta il turno è ora il Duellante grande (l'unità che salta È l'attore di
// questo frame, quindi resta in scena, ora smorzata solo se non stesse agendo). Il lampo
// SALTA è un fratello del Duellante nel suo slot di scena (`stage-attore`), non un
// discendente (Duellante non accetta children) — stessa forma già adottata per
// `damage-float` nel resto della suite.
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
    // quindi resta in scena come duellante — nello slot "attore". Nessuna aura "sta
    // agendo" si accende (quella arriva dalla motion class fx-strike, assente qui: lo
    // Stordito non produce un colpo, produce lo shiver+SALTA).
    const actorSlot = screen.getByTestId('stage-attore')
    const skipper = actorSlot.querySelector('[data-testid="duellante"][data-unit-key="left:x"]')
    expect(skipper).not.toBeNull()
    expect(skipper).not.toHaveClass('fx-strike')
    const flash = actorSlot.querySelector('[data-skipping]')
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
