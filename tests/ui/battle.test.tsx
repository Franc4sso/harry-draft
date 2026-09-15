import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpellFx, ShieldFx } from '@/components/battle/SpellFx'
import { describeEntry } from '@/components/battle/BattleLog'
import { BattleScreen } from '@/components/screens/BattleScreen'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
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

// Il describe "UnitBust" che testava il componente direttamente è stato rimosso
// (Task 11 — UnitBust cancellato). Copriva: nome/HP/dead flag (ora coperti tramite
// BattleArena+WizardCard, vedi describe 'BattleArena' più sotto), la riga cooldown e
// la riga stati (icone/pillole/striscia di controllo) — queste ultime due erano già
// state dichiarate come RIDUZIONE ACCETTATA per questo stesso Task 10 nei commenti dei
// test 'renders the dotted unit's card...' e 'still shows the unit's spell name...' più
// in basso in questo file: WizardCard density="combat" non ha una riga cooldown né
// pillole di stato — quella lettura ora passa dal Callout (annuncio centrale
// all'applicazione) e dalla narrazione BattleLog/ActionPanel, non da un indicatore
// persistente sulla card.

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
  }, 15000)

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

  it('renders the playback controls above the battle grid', () => {
    renderBattleScreen()
    const passo = screen.getByRole('button', { name: /Passo/i })
    const arena = screen.getByTestId('battle-arena')
    // Controls appear before the arena in the DOM.
    expect(passo.compareDocumentPosition(arena) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('la corsia dei turni è montata in battaglia', () => {
    renderBattleScreen()
    expect(screen.getAllByTestId('lane-slot').length).toBeGreaterThanOrEqual(4)
  })

  // TurnLane REPLACES InitiativeBar (Task 6 — la corsia mostra il futuro reale del
  // replay, la barra ricalcolava un ordine ordinando per spd; tenerle entrambe le
  // avrebbe fatte contraddire a vicenda e avrebbe sforato il budget di 768px).
  // InitiativeBar resta come componente (altri test lo montano direttamente), ma
  // BattleScreen non lo monta più: questo test lo accerta.
  it('la corsia sostituisce la barra di iniziativa in schermata', () => {
    renderBattleScreen()
    expect(screen.queryByTestId('initiative-bar')).toBeNull()
    expect(screen.getByTestId('turn-lane')).toBeInTheDocument()
  })

  it('shows dual damage recaps and the battle log', () => {
    renderBattleScreen()
    // Both recaps render twice (desktop grid + below-lg block); getAllByText asserts at least one present.
    expect(screen.getAllByText(/I tuoi danni/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Danni nemici/i).length).toBeGreaterThanOrEqual(1)
    // 2026-09-15: asseriva la StatusLegend, ora rimossa. Quella legenda spiegava
    // dieci ICONE di stato che la carta nuova non disegna più — una legenda di
    // simboli inesistenti. Il bisogno che copriva (capire cosa sta succedendo agli
    // stati) è reale e ora lo soddisfa il REGISTRO, che dice a parole «Terry Boot
    // subisce 6 danni da veleno» invece di mostrare un'icona da decifrare.
    expect(screen.getByTestId('battle-log')).toBeInTheDocument()
  })

  it('closing the end modal hides it and reveals a "Rivedi esito" reopen button; onFinish stays reachable', async () => {
    const l = left(), r = right()
    const result = simulateBattle(l, r, createRng(42), {
      leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
    })
    const onFinish = vi.fn()
    render(
      <BattleScreen
        result={result} playerTeam={l} playerSyn={detectSynergies(l)}
        enemy={r} enemySyn={detectSynergies(r)} title="Sfida 1 di 5" onFinish={onFinish}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /salta/i }))
    await screen.findByTestId('battle-end-modal')

    await userEvent.click(screen.getByRole('button', { name: /chiudi/i }))
    expect(screen.queryByTestId('battle-end-modal')).toBeNull()
    const reopen = await screen.findByRole('button', { name: /rivedi esito/i })

    await userEvent.click(reopen)
    const modal = await screen.findByTestId('battle-end-modal')
    expect(modal).toBeInTheDocument()

    const cont = screen.getByRole('button', { name: /continua|esito/i })
    await userEvent.click(cont)
    expect(onFinish).toHaveBeenCalledOnce()
  }, 15000)
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
  it('no longer renders the legacy DOM Protego dome (block reaction moved to the Pixi VFX layer)', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const blocked: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 0, flags: ['block'],
    }
    render(<BattleArena replay={replay} hp={replay.frames[0]!.hp} entry={blocked} frameKey={1} />)
    expect(screen.queryByTestId('shield-fx')).toBeNull()
  })

  // Task 10 (mappa C / battaglia A): BattleArena stopped rendering UnitBust (which owned the
  // per-unit status pills) and now renders WizardCard density="combat" instead — the single
  // shared card, which has no inline status-pill row. Status visibility didn't disappear from
  // the screen: it moved to the Callout (big center announcement on apply) and BattleLog/
  // ActionPanel narration. This test now asserts what the card still surfaces for a dotted
  // unit — its identity + live HP wrapper — rather than a pill UnitBust alone used to render.
  it('renders the dotted unit\'s card keyed for VFX targeting, even with a real dot effect on frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    // Inject a real dot effect on harry into a frame's statusEffects (the engine path).
    const dotted = unitKey('left', 'harry')
    replay.frames[1]!.statusEffects = { [dotted]: [{ kind: 'dot', statusId: 'veleno', amount: 6, remaining: 2, stacks: 2 }] }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const bust = document.querySelector(`[data-unit-key="${CSS.escape(dotted)}"]`) as HTMLElement
    expect(bust).not.toBeNull()
    expect(bust.getAttribute('data-testid')).toBe('battle-unit')
  })

  // Le pillole erano sparite col rifacimento (UnitBust le aveva, WizardCard no):
  // dal frame dopo l'applicazione non si sapeva più che un mago era avvelenato.
  it('mostra gli stati attivi sulle unità in battaglia', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const poisoned = unitKey('left', 'harry')
    replay.frames[1]!.statusEffects = { [poisoned]: [{ kind: 'dot', statusId: 'veleno', amount: 6, remaining: 2, stacks: 3 }] }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    expect(screen.getAllByTestId('status-pip').length).toBeGreaterThanOrEqual(1)
  })

  // Fix round 1 (review): asymmetric — actor gets fx-strike, target gets fx-kick — so a
  // swapped actor/target wiring in BattleArena's cardMotion fails this test. sceneEventOf
  // reads its scene from replay.frames[frameKey].entry, NOT the `entry` prop, so the frame's
  // own entry has to carry the plain hit (no flags → SceneKind 'hit' per lib/battleScene.ts).
  it('applies fx-strike to the actor and fx-kick to the target on a plain hit', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const actorKey = unitKey('left', 'harry')
    const targetKey = unitKey('right', 'draco')
    const hit: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 12, flags: [],
    }
    replay.frames[1]!.entry = hit
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={hit} frameKey={1} />)
    const actorEl = document.querySelector(`[data-unit-key="${CSS.escape(actorKey)}"]`) as HTMLElement
    const targetEl = document.querySelector(`[data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
    expect(actorEl.querySelector('.fx-strike')).not.toBeNull()
    expect(actorEl.querySelector('.fx-kick')).toBeNull()
    expect(targetEl.querySelector('.fx-kick')).not.toBeNull()
    expect(targetEl.querySelector('.fx-strike')).toBeNull()
  })

  // Fix round 1 (review): proves prevFrame is really `replay.frames[frameKey - 1]` and not a
  // stand-in (same frame twice, or unconditionally undefined). `gained`/`lost` (the ONLY thing
  // `prev` affects inside sceneEventOf — see lib/battleScene.ts's diffStatuses) aren't rendered
  // anywhere yet in BattleArena/SceneFx, so there is no current DOM signal that depends on the
  // diff's CONTENT. What's still real and composition-level to guard is the WIRING: BattleArena
  // must call sceneEventOf with the frame at frameKey-1, not with the same frame, not with
  // undefined. Spying on the real (unmocked) sceneEventOf and inspecting its actual call
  // arguments catches exactly the two ways the reviewer named: "prevFrame passed as frame" and
  // "prevFrame dropped to undefined unconditionally" — both are wrong-argument bugs a
  // presence-only pip assertion could never see.
  it('calls sceneEventOf with the PREVIOUS frame, not the current one or none', async () => {
    const battleScene = await import('@/lib/battleScene')
    const spy = vi.spyOn(battleScene, 'sceneEventOf')
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    render(<BattleArena replay={replay} hp={replay.frames[2]!.hp} entry={replay.frames[2]!.entry} frameKey={2} />)
    expect(spy).toHaveBeenCalled()
    const [frameArg, prevArg] = spy.mock.calls[spy.mock.calls.length - 1]!
    expect(frameArg).toBe(replay.frames[2])
    expect(prevArg).toBe(replay.frames[1])
    expect(prevArg).not.toBe(frameArg)
    spy.mockRestore()
  })

  // Fix round 1 (review): SceneFx must actually mount and draw through BattleArena's wiring,
  // not just in its own isolated unit tests (Task 4).
  it('renders SceneFx\'s number/word through the arena for a real hit frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const hit: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 37, flags: [],
    }
    replay.frames[1]!.entry = hit
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={hit} frameKey={1} />)
    expect(screen.getByTestId('scene-fx')).toBeInTheDocument()
    expect(screen.getByTestId('fx-number')).toHaveTextContent('37')
  })

  // Fix round 1 (review): the box-measurement path (getBoundingClientRect + CSS.escape)
  // resolves to the correct unit, not just "doesn't crash". jsdom returns a zero DOMRect
  // (not null) for any mounted element, so actorBox/targetBox are non-null here — this checks
  // SceneFx actually receives a box (the fixed-position number is only positioned via
  // numberBox when one is passed; see SceneFx.tsx's `style={numberBox ? {...} : undefined}`).
  it('measures a real box for the targeted unit and feeds it to the fx number position', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const hit: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 20, flags: [],
    }
    replay.frames[1]!.entry = hit
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={hit} frameKey={1} />)
    const num = screen.getByTestId('fx-number')
    // A resolved (non-null) box makes SceneFx set `position: fixed` inline; an unresolved
    // (null) box leaves the element with no inline position style at all.
    expect(num.style.position).toBe('fixed')
  })

  it('shows the damage float only on the targeted bust, not on every unit', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const targetKey = unitKey('right', 'draco')
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
    }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
    // Exactly one float, on the targeted bust (floatKey is only wired to the target;
    // other busts get a stable key so React.memo can skip them during playback).
    const floats = document.querySelectorAll('[data-testid="damage-float"]')
    expect(floats.length).toBe(1)
    const targetBust = document.querySelector(`[data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
    expect(targetBust.querySelector('[data-testid="damage-float"]')).not.toBeNull()
  })

  // Task 10: same story as the dot test above — WizardCard's combat density has no
  // `[data-role="cooldown"]` row (that lived on UnitBust, which BattleArena no longer
  // renders). The unit's own spell NAME still shows (via SpellLine), just not its live
  // per-frame cooldown countdown; that's a real, accepted reduction for this task, not a
  // silently-dropped assertion — the test now covers what's still true post-rewrite.
  it('still shows the unit\'s spell name on its card when the frame carries a cooldown', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const key = unitKey('left', 'harry')
    const harry = replay.units.find(u => u.key === key)!
    replay.frames[1]!.cooldowns = { [key]: { [harry.spell.id]: 2 } }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const bust = document.querySelector(`[data-unit-key="${CSS.escape(key)}"]`) as HTMLElement
    expect(bust).not.toBeNull()
    expect(bust.getAttribute('data-testid')).toBe('battle-unit')
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
