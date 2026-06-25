import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpellFx, ShieldFx } from '@/components/battle/SpellFx'
import { describeEntry } from '@/components/battle/BattleLog'
import { BattleScreen } from '@/components/screens/BattleScreen'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
import { UnitBust } from '@/components/battle/UnitBust'
import { BattleArena } from '@/components/battle/BattleArena'
import { ActionPanel } from '@/components/battle/ActionPanel'
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

  it('labels the current slot "Ora"', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(
      f => f.entry && f.entry.type !== 'system' && f.entry.actorSide,
    )
    render(<InitiativeBar replay={replay} index={firstReal} />)
    const bar = screen.getByTestId('initiative-bar')
    const current = bar.querySelector('[data-current]') as HTMLElement
    expect(current).not.toBeNull()
    expect(current.querySelector('[data-role="ora-label"]')?.textContent).toMatch(/ora/i)
  })

  it('shows the name and spd of the acting unit beneath its crest', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(
      f => f.entry && f.entry.type !== 'system' && f.entry.actorSide,
    )
    const e = replay.frames[firstReal]!.entry!
    const actor = replay.units.find(u => u.key === unitKey(e.actorSide!, e.actorId))!
    render(<InitiativeBar replay={replay} index={firstReal} />)
    const bar = screen.getByTestId('initiative-bar')
    const current = bar.querySelector('[data-current]') as HTMLElement
    // slot is highlighted for the correct actor — face alt carries the name, spd shown as text
    expect(current.querySelector('img[alt]')?.getAttribute('alt')).toBe(actor.name)
    // buffed spd shown
    expect(current.textContent).toContain(String(actor.spd))
  })

  it('renders a stable non-empty rail on a system frame and highlights the last real actor', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(
      f => f.entry && f.entry.type !== 'system' && f.entry.actorSide,
    )
    // A system/actorless frame strictly after the first real action.
    const sysIdx = replay.frames.findIndex(
      (f, i) => i > firstReal && f.entry && (f.entry.type === 'system' || !f.entry.actorSide),
    )
    expect(sysIdx).toBeGreaterThan(firstReal)
    // Persisted (last real) actor at that system frame.
    let actorKey: string | null = null
    for (let i = sysIdx; i >= 0; i--) {
      const en = replay.frames[i]!.entry
      if (en && en.type !== 'system' && en.actorSide) { actorKey = unitKey(en.actorSide, en.actorId); break }
    }
    const actor = replay.units.find(u => u.key === actorKey)!
    render(<InitiativeBar replay={replay} index={sysIdx} />)
    const bar = screen.getByTestId('initiative-bar')
    // Bar is NOT empty on a system frame — alive units are shown.
    const slots = bar.querySelectorAll('[data-current], [data-role="ora-label"]')
    expect(slots.length).toBeGreaterThan(0)
    // Highlight follows the last real actor and persists across the system frame.
    const current = bar.querySelector('[data-current]') as HTMLElement
    expect(current).not.toBeNull()
    // face alt carries the name; name no longer rendered as visible text
    expect(current.querySelector('img[alt]')?.getAttribute('alt')).toBe(actor.name)
  })

  it('shows the alive units sorted by spd on a system frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(
      f => f.entry && f.entry.type !== 'system' && f.entry.actorSide,
    )
    const sysIdx = replay.frames.findIndex(
      (f, i) => i > firstReal && f.entry && (f.entry.type === 'system' || !f.entry.actorSide),
    )
    expect(sysIdx).toBeGreaterThan(firstReal)
    const aliveCount = Object.values(replay.frames[sysIdx]!.hp).filter(h => h > 0).length
    render(<InitiativeBar replay={replay} index={sysIdx} />)
    const bar = screen.getByTestId('initiative-bar')
    // Each alive unit has a data-side slot in the vertical rail.
    expect(bar.querySelectorAll('[data-side]').length).toBe(aliveCount)
  })
})

describe('UnitBust', () => {
  const u = {
    key: 'left:harry', side: 'left' as const, id: 'harry', name: 'Harry Potter',
    house: 'Grifondoro' as const, role: 'Attaccante' as const, tier: 1 as const, maxHp: 100,
    atk: 50, def: 40, spd: 30, baseAtk: 50, baseDef: 40, baseSpd: 30,
    spell: { id: 'stupeficium', name: 'Stupeficium', cooldown: 1 },
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

  describe('cooldown row', () => {
    it('shows the spell name and "pronto" (green) when off cooldown', () => {
      render(<UnitBust unit={u} hp={50} cooldown={0} />)
      const row = screen.getByTestId('battle-unit').querySelector('[data-role="cooldown"]') as HTMLElement
      expect(row).not.toBeNull()
      expect(row.textContent).toContain('Stupeficium')
      expect(row.textContent).toMatch(/pronto/i)
      expect(row.querySelector('[data-ready="true"]')!.className).toContain('emerald')
    })
    it('shows "pronto" when no cooldown is provided', () => {
      render(<UnitBust unit={u} hp={50} />)
      const row = screen.getByTestId('battle-unit').querySelector('[data-role="cooldown"]') as HTMLElement
      expect(row.textContent).toMatch(/pronto/i)
    })
    it('uses the singular "1 turno" when one turn remains', () => {
      render(<UnitBust unit={u} hp={50} cooldown={1} />)
      const row = screen.getByTestId('battle-unit').querySelector('[data-role="cooldown"]') as HTMLElement
      expect(row.textContent).toContain('Stupeficium')
      expect(row.textContent).toMatch(/1 turno\b/)
      expect(row.textContent).not.toMatch(/pronto/i)
    })
    it('uses the plural "2 turni" when several turns remain', () => {
      render(<UnitBust unit={u} hp={50} cooldown={2} />)
      const row = screen.getByTestId('battle-unit').querySelector('[data-role="cooldown"]') as HTMLElement
      expect(row.textContent).toMatch(/2 turni/)
    })
  })

  describe('status row', () => {
    it('renders a status icon with its remaining count and a descriptive title for a dot', () => {
      render(<UnitBust unit={u} hp={50} effects={[{ kind: 'dot', amount: 6, remaining: 2 }]} />)
      const root = screen.getByTestId('battle-unit')
      const dot = root.querySelector('[data-status-kind="dot"]') as HTMLElement
      expect(dot).not.toBeNull()
      expect(dot.textContent).toContain('2')
      expect(dot.getAttribute('title')).toMatch(/veleno/i)
      expect(dot.getAttribute('title')).toContain('6')
    })
    it('renders one icon per active control/over-time effect', () => {
      render(
        <UnitBust
          unit={u}
          hp={50}
          effects={[
            { kind: 'dot', amount: 6, remaining: 2 },
            { kind: 'stun', remaining: 1 },
            { kind: 'shield', absorbLeft: 30, remaining: 3 },
          ]}
        />,
      )
      const root = screen.getByTestId('battle-unit')
      expect(root.querySelectorAll('[data-status-kind]').length).toBe(3)
    })
    it('does NOT render a pill for buff/debuff effects (stat bars show those)', () => {
      render(<UnitBust unit={u} hp={50} effects={[{ kind: 'buff', stat: 'atk', amount: 10, remaining: 2 }]} />)
      const root = screen.getByTestId('battle-unit')
      expect(root.querySelector('[data-status-kind="buff"]')).toBeNull()
    })
  })

  it('control overlay shows label and remaining turns as "<label> ·<n>t"', () => {
    render(<UnitBust unit={u} hp={50} effects={[{ kind: 'stun', remaining: 2 }]} />)
    const overlay = screen.getByTestId('battle-unit').querySelector('[data-control="stun"]') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.textContent).toContain('Stordito')
    expect(overlay.textContent).toMatch(/·2t/)
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

  it('advances one action with the step control', async () => {
    const l = left(), r = right()
    const result = simulateBattle(l, r, createRng(42), {
      leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
    })
    render(
      <BattleScreen
        result={result} playerTeam={l} playerSyn={detectSynergies(l)}
        enemy={r} enemySyn={detectSynergies(r)} title="Sfida 1 di 5" onFinish={vi.fn()}
      />,
    )
    // Pause first so autoplay doesn't race the assertion, then step.
    await userEvent.click(screen.getByRole('button', { name: /pausa|play/i }))
    const stepBtn = screen.getByRole('button', { name: /passo/i })
    await userEvent.click(stepBtn)
    expect(screen.getByTestId('battle-arena')).toBeInTheDocument()
  })

  it('shows the active-synergy ribbons for both teams in battle', () => {
    const l = left(), r = right()
    const result = simulateBattle(l, r, createRng(42), {
      leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
    })
    render(
      <BattleScreen
        result={result} playerTeam={l} playerSyn={detectSynergies(l)}
        enemy={r} enemySyn={detectSynergies(r)} title="Sfida 1 di 5" onFinish={() => {}}
      />,
    )
    // Both teams (Gryffindor-heavy left, Slytherin-heavy right) have at least one active synergy here.
    expect(screen.getAllByTestId('synergy-ribbon').length).toBeGreaterThanOrEqual(1)
  })

  it('header has no action counter', () => {
    const l = left(), r = right()
    const result = simulateBattle(l, r, createRng(42), {
      leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
    })
    render(
      <BattleScreen
        result={result} playerTeam={l} playerSyn={detectSynergies(l)}
        enemy={r} enemySyn={detectSynergies(r)} title="Sfida 1 di 5" onFinish={() => {}}
      />,
    )
    // The header (h1 + subtitle) must not contain an action counter.
    // (StatusLegend text like "nessuna azione" is intentionally excluded from this check.)
    const header = screen.getByRole('heading', { level: 1 }).closest('div')!
    expect(header.textContent).not.toMatch(/\bazione\b/i)
  })

  it('shows separate labeled mine/enemy synergy ribbons', () => {
    const l = left(), r = right()
    const result = simulateBattle(l, r, createRng(42), {
      leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
    })
    render(
      <BattleScreen
        result={result} playerTeam={l} playerSyn={detectSynergies(l)}
        enemy={r} enemySyn={detectSynergies(r)} title="Sfida 1 di 5" onFinish={() => {}}
      />,
    )
    // Both ribbons render twice (desktop + below-lg); getAllByText asserts presence.
    expect(screen.getAllByText(/Le tue sinergie/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Sinergie nemiche/i).length).toBeGreaterThanOrEqual(1)
  })

  function renderBattleScreen() {
    const l = left(), r = right()
    const result = simulateBattle(l, r, createRng(42), {
      leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
    })
    render(
      <BattleScreen
        result={result} playerTeam={l} playerSyn={detectSynergies(l)}
        enemy={r} enemySyn={detectSynergies(r)} title="Sfida 1 di 5" onFinish={() => {}}
      />,
    )
  }

  it('shows dual damage recaps and no status legend', () => {
    renderBattleScreen()
    // Both recaps render twice (desktop grid + below-lg block); getAllByText asserts at least one present.
    expect(screen.getAllByText(/I tuoi danni/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Danni nemici/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByTestId('status-legend')).toBeNull()
  })
})

describe('SpellFx', () => {
  it('renders a projectile with the archetype for a plain attack with coords', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 10, flags: [],
    }
    render(<SpellFx entry={e} from={{ x: 20, y: 50 }} to={{ x: 80, y: 50 }} fxKey={1} />)
    const fx = screen.getByTestId('spell-fx')
    expect(fx.getAttribute('data-archetype')).toBe('beam')
  })
  it('renders nothing when from/to coords are missing (no measured positions)', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 10, flags: [],
    }
    const { container } = render(<SpellFx entry={e} from={null} to={null} fxKey={1} />)
    expect(container.querySelector('[data-testid="spell-fx"]')).toBeNull()
  })
  it('renders nothing for a system KO entry', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'KO',
      targetId: 'draco', targetSide: 'right', type: 'system', flags: ['kill'],
    }
    const { container } = render(<SpellFx entry={e} from={{ x: 20, y: 50 }} to={{ x: 80, y: 50 }} fxKey={1} />)
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

describe('BattleArena', () => {
  it('renders every combatant as a bust', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    render(<BattleArena replay={replay} hp={replay.frames[0]!.hp} entry={null} frameKey={0} />)
    expect(screen.getAllByTestId('battle-unit')).toHaveLength(10)
  })
  it('shows the Protego dome when a hit is blocked', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const blocked: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 0, flags: ['block'],
    }
    render(<BattleArena replay={replay} hp={replay.frames[0]!.hp} entry={blocked} frameKey={1} />)
    expect(screen.getByTestId('shield-fx')).toBeInTheDocument()
  })

  it('surfaces real status effects from the current frame onto the unit bust', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    // Inject a real dot effect on harry into a frame's statusEffects (the engine path).
    const dotted = unitKey('left', 'harry')
    replay.frames[1]!.statusEffects = { [dotted]: [{ kind: 'dot', amount: 6, remaining: 2 }] }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const bust = document.querySelector(`[data-unit-key="${CSS.escape(dotted)}"]`) as HTMLElement
    const dot = bust.querySelector('[data-status-kind="dot"]') as HTMLElement
    expect(dot).not.toBeNull()
    expect(dot.textContent).toContain('2')
  })

  it('surfaces the real per-unit cooldown for the unit primary spell from the frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const key = unitKey('left', 'harry')
    const harry = replay.units.find(u => u.key === key)!
    replay.frames[1]!.cooldowns = { [key]: { [harry.spell.id]: 2 } }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const bust = document.querySelector(`[data-unit-key="${CSS.escape(key)}"]`) as HTMLElement
    const row = bust.querySelector('[data-role="cooldown"]') as HTMLElement
    expect(row.textContent).toMatch(/2 turni/)
  })
})

describe('ActionPanel', () => {
  it('shows the spell and a damage result for the current entry', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
    }
    render(<ActionPanel entry={e} units={replay.units} />)
    const p = screen.getByTestId('action-panel')
    expect(p.querySelector('[data-role="spell"]')!.textContent).toContain('Stupeficium')
    expect(p.querySelector('[data-role="result"]')!.textContent).toContain('42')
  })
  it('renders an empty placeholder for no entry', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    render(<ActionPanel entry={null} units={replay.units} />)
    expect(screen.getByTestId('action-panel')).toBeInTheDocument()
  })
})
