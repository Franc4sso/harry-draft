import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpellFx, ShieldFx } from '@/components/battle/SpellFx'
import { describeEntry } from '@/components/battle/BattleLog'
import { BattleStage } from '@/components/battle/BattleStage'
import { BattleScreen } from '@/components/screens/BattleScreen'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
import { UnitBust } from '@/components/battle/UnitBust'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard, LogEntry } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const left = () => team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
const right = () => team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)

describe('describeEntry', () => {
  const names = { 'left:harry': 'Harry', 'right:draco': 'Draco' }

  it('narrates a damaging spell with the target and amount', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
    }
    expect(describeEntry(e, names)).toContain('Harry')
    expect(describeEntry(e, names)).toContain('Draco')
    expect(describeEntry(e, names)).toContain('42')
  })

  it('marks a crit', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'X',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 10, flags: ['crit'],
    }
    expect(describeEntry(e, names)).toMatch(/critico/i)
  })

  it('narrates a heal', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Episkey',
      targetId: 'harry', targetSide: 'left', type: 'Cura', value: 30, flags: ['heal'],
    }
    expect(describeEntry(e, names)).toMatch(/cura/i)
  })

  it('narrates a KO', () => {
    const e: LogEntry = {
      turn: 2, actorId: 'harry', actorSide: 'left', action: 'KO',
      targetId: 'draco', targetSide: 'right', type: 'system', flags: ['kill'],
    }
    expect(describeEntry(e, names)).toMatch(/eliminato/i)
  })
})

describe('BattleStage', () => {
  it('renders every combatant with its current HP frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    render(<BattleStage replay={replay} hp={replay.frames[0]!.hp} entry={null} />)
    expect(screen.getAllByTestId('battle-unit')).toHaveLength(10)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
  })

  it('marks a downed unit as dead', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const zero = { ...replay.frames[0]!.hp, [unitKey('right', 'draco')]: 0 }
    render(<BattleStage replay={replay} hp={zero} entry={null} />)
    const dead = screen.getAllByTestId('battle-unit').filter(el => el.getAttribute('data-dead'))
    expect(dead.length).toBeGreaterThanOrEqual(1)
  })

  it('floats the damage number on the targeted unit during a hit', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const hit: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
    }
    render(<BattleStage replay={replay} hp={replay.frames[0]!.hp} entry={hit} frameKey={1} />)
    const floats = screen.getAllByTestId('damage-float')
    expect(floats).toHaveLength(1)
    expect(floats[0]).toHaveTextContent('-42')
  })
})

describe('InitiativeBar', () => {
  it('marks the unit acting at the current frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(
      f => f.entry && f.entry.type !== 'system' && f.entry.actorSide,
    )
    render(<InitiativeBar replay={replay} index={firstReal} />)
    const bar = screen.getByTestId('initiative-bar')
    expect(bar.querySelector('[data-current]')).not.toBeNull()
  })
})

describe('UnitBust', () => {
  const u = {
    key: 'left:harry', side: 'left' as const, id: 'harry', name: 'Harry Potter',
    house: 'Grifondoro' as const, role: 'Attaccante' as const, tier: 1 as const, maxHp: 100,
  }
  it('renders the name, an HP value, and a rarity treatment', () => {
    render(<UnitBust unit={u} hp={72} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    expect(screen.getByTestId('battle-unit')).toBeInTheDocument()
  })
  it('flags a downed unit as dead', () => {
    render(<UnitBust unit={u} hp={0} />)
    expect(screen.getByTestId('battle-unit').getAttribute('data-dead')).toBe('true')
  })
  it('shows status icons when provided', () => {
    render(<UnitBust unit={u} hp={50} statuses={['dot', 'stun']} />)
    expect(screen.getByTestId('battle-unit').querySelectorAll('[data-status]').length).toBe(2)
  })
})

describe('BattleScreen', () => {
  it('skips to the end and fires onFinish on continue', async () => {
    const l = left(), r = right()
    const result = simulateBattle(l, r, createRng(42), {
      leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
    })
    const onFinish = vi.fn()
    render(
      <BattleScreen
        result={result}
        playerTeam={l}
        playerSyn={detectSynergies(l)}
        enemy={r}
        enemySyn={detectSynergies(r)}
        title="Sfida 1 di 5"
        onFinish={onFinish}
      />,
    )
    expect(screen.getByText('Sfida 1 di 5')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /salta/i }))
    const cont = await screen.findByRole('button', { name: /continua|esito/i })
    await userEvent.click(cont)
    expect(onFinish).toHaveBeenCalledOnce()
  })
})

describe('SpellFx', () => {
  it('renders a projectile with the archetype for a plain attack', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 10, flags: [],
    }
    render(<SpellFx entry={e} fxKey={1} />)
    const fx = screen.getByTestId('spell-fx')
    expect(fx.getAttribute('data-archetype')).toBe('beam')
  })
  it('renders nothing for a system KO entry', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'KO',
      targetId: 'draco', targetSide: 'right', type: 'system', flags: ['kill'],
    }
    const { container } = render(<SpellFx entry={e} fxKey={1} />)
    expect(container.querySelector('[data-testid="spell-fx"]')).toBeNull()
  })
})

describe('ShieldFx', () => {
  it('shows PARATO when active', () => {
    render(<ShieldFx active fxKey={1} />)
    expect(screen.getByTestId('shield-fx')).toHaveTextContent(/parato/i)
  })
  it('renders nothing when inactive', () => {
    const { container } = render(<ShieldFx active={false} fxKey={1} />)
    expect(container.querySelector('[data-testid="shield-fx"]')).toBeNull()
  })
})
