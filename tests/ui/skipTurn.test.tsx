import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import { BattleArena } from '@/components/battle/BattleArena'
import type { ReplayUnit, Replay } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const unit = (over: Partial<ReplayUnit> = {}): ReplayUnit => ({
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
  ...over,
})

describe('UnitBust: lampo SALTA', () => {
  it("skipping='freeze' rende [data-skipping=\"freeze\"] con testo SALTA", () => {
    const { container } = render(<UnitBust unit={unit()} hp={80} skipping="freeze" />)
    const flash = container.querySelector('[data-skipping]')
    expect(flash).toHaveAttribute('data-skipping', 'freeze')
    expect(flash).toHaveTextContent(/salta/i)
  })

  it('skipping=null non rende alcun [data-skipping]', () => {
    const { container } = render(<UnitBust unit={unit()} hp={80} skipping={null} />)
    expect(container.querySelector('[data-skipping]')).toBeNull()
    expect(screen.getByTestId('battle-unit')).not.toHaveTextContent(/salta/i)
  })
})

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
    const { container } = render(<BattleArena replay={replay} hp={hp} entry={stordito} frameKey={1} />)
    const busts = screen.getAllByTestId('battle-unit')
    const skipper = busts.find(b => b.getAttribute('data-unit-key') === 'left:x')!
    expect(skipper).not.toHaveAttribute('data-acting')
    const flash = skipper.querySelector('[data-skipping]') ?? container.querySelector('[data-unit-key="left:x"] [data-skipping]')
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
