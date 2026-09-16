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
import type { ReplayUnit, Replay } from '@/game/engine/combat/replay'
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
  // 2026-09-16 (Task 3, "il palco"): la scena non è più sei/dieci carte uguali in due file
  // — il mockup approvato ("La corsia del tempo" v11) mette in primo piano chi agisce e chi
  // subisce come due Duellante grandi al centro, e relega TUTTI gli altri (compresi i due in
  // scena, smorzati — `dimmed`, il posto non scompare mai) a Miniatura laterali. Questo test
  // sostituisce l'assert sulle dieci `battle-unit` (5+5 WizardCard density="combat" in due
  // file) col conteggio della nuova composizione: sempre due duellanti, e una miniatura per
  // OGNI unità del roster (qui 5v5 = 10, non le sei del mockup che usa un 3v3 d'esempio —
  // il principio «ogni unità ha sempre il suo posto in miniatura» vale a qualunque taglia
  // di squadra, la miniatura dei due in scena resta e basta smorzarsi).
  it('la scena mette i due duellanti al centro e tutte le altre unità di lato in miniatura', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    render(<BattleArena replay={replay} hp={replay.frames[firstReal]!.hp} entry={replay.frames[firstReal]!.entry} frameKey={firstReal} />)
    expect(screen.getAllByTestId('duellante')).toHaveLength(2)
    expect(screen.getAllByTestId('miniatura')).toHaveLength(replay.units.length)
  })

  // Un tick di veleno o un Duo non hanno attore/bersaglio propri (system frame): i due
  // duellanti restano quelli dell'ultima azione vera (lastRealEntryAt), come già fa la
  // corsia dei turni — la scena non si svuota mai.
  //
  // FIX ROUND 1 (review): la versione precedente pescava un frame di sistema dal replay
  // REALE (simulateBattle + buildReplay su 5v5) filtrando su `f.entry.type === 'system' ||
  // !f.entry.actorSide` — ma nella fixture di questa suite il primo frame di sistema
  // trovato (`Reliquia`, turno 1) porta COMUNQUE `actorSide`/`targetSide` propri (è un
  // drop di reliquia auto-diretto: attore e bersaglio sono la stessa unità). Con
  // `entry.actorSide` sempre presente, `stageActorSrc`/`stageTargetSrc` in BattleArena non
  // ricadono MAI su `lastRealEntryAt` — il ramo di fallback non veniva mai esercitato, e
  // il test passava per un motivo che non aveva nulla a che fare con l'assert (2 duellanti
  // erano già lì perché il frame aveva il suo proprio attore/bersaglio, non perché il
  // fallback avesse recuperato l'ultima azione vera). Prova diretta: ho tolto il fallback
  // (`stageActorSrc = entry?.actorSide ? entry : null`, stesso per il target) e rilanciato
  // `tests/ui/battle.test.tsx tests/ui/skipTurn.test.tsx tests/ui/poisonTick.test.tsx`:
  // 40/40 verdi. Il replay 5v5 di questa fixture non ha NESSUN frame senza `actorSide` —
  // nessun seed lo produce.
  //
  // Questa riscrittura costruisce a mano (stesso pattern di tests/ui/skipTurn.test.tsx) un
  // replay minimo con un frame REALMENTE privo di attore/bersaglio (un tick di veleno
  // generico, senza `actorSide` né `targetSide` — il caso che il brief cita alla lettera:
  // «veleno, Duo» senza attore/bersaglio propri) e prova non solo che restano 2 duellanti,
  // ma che sono ESATTAMENTE quelli dell'ultima azione vera (harry attore, foe bersaglio),
  // non una coppia qualunque. Rilanciata la stessa falsificazione contro QUESTA versione:
  // togliendo il fallback il test va rosso (vedi task-3-report.md per l'evidenza completa).
  it('sui frame di sistema senza attore/bersaglio propri la scena tiene l\'ultima azione vera', () => {
    const attacker = (): ReplayUnit => ({
      key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
      spell: { id: 's', name: 'S', cooldown: 0 },
    })
    const defender = (): ReplayUnit => ({
      key: 'right:foe', id: 'foe', name: 'Foe', side: 'right', house: 'Serpeverde', role: 'Tank', tier: 3,
      maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
      spell: { id: 's2', name: 'S2', cooldown: 0 },
    })
    const realHit: LogEntry = {
      turn: 1, actorId: 'x', actorSide: 'left', action: 'Colpo', targetId: 'foe', targetSide: 'right',
      type: 'Attacco', value: 10, flags: [],
    }
    // Un tick di veleno "generico" senza actorSide NÉ targetSide — il caso letterale del
    // commento nel codice sorgente: nessun attore che sta agendo, nessun bersaglio scelto
    // questo frame, solo danno passivo sull'unità colpita. `buildReplay`/il motore reale
    // producono sempre un `targetSide` sui tick di veleno (leggono l'attaccante/bersaglio
    // di quel DoT specifico) — questa è la forma "senza nessuno dei due" che il fallback
    // deve coprire, e che nessuna battaglia reale in questa fixture emette.
    const poisonTick: LogEntry = {
      turn: 1, actorId: '', action: 'Veleno', targetId: '', type: 'system', value: 4, flags: ['dot'],
    }
    const replay = {
      units: [attacker(), defender()],
      frames: [
        { statusEffects: {}, cooldowns: {}, entry: null, hp: { 'left:x': 100, 'right:foe': 100 } },
        { statusEffects: {}, cooldowns: {}, entry: realHit, hp: { 'left:x': 100, 'right:foe': 90 } },
        { statusEffects: {}, cooldowns: {}, entry: poisonTick, hp: { 'left:x': 96, 'right:foe': 90 } },
      ],
    } as unknown as Replay
    // Sanity: il frame di sistema che stiamo per rendere davvero non ha né actorSide né
    // targetSide — altrimenti staremmo ripetendo lo stesso errore appena diagnosticato.
    expect(poisonTick.actorSide).toBeUndefined()
    expect(poisonTick.targetSide).toBeUndefined()

    render(<BattleArena replay={replay} hp={replay.frames[2]!.hp} entry={poisonTick} frameKey={2} />)
    const duellanti = screen.getAllByTestId('duellante')
    expect(duellanti).toHaveLength(2)
    // Non una coppia qualunque: quella dell'ultima azione vera (frame 1 — harry-equivalente
    // attore, foe bersaglio), recuperata da lastRealEntryAt.
    const keys = duellanti.map(el => el.getAttribute('data-unit-key')).sort()
    expect(keys).toEqual(['left:x', 'right:foe'])
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

  // Task 10 (superseded) asserted a WizardCard density="combat" bust. Task 3 (il palco)
  // replaced the two-row card grid with the stage: `data-unit-key` now appears TWICE for
  // a unit on stage (its big Duellante AND its dimmed side Miniatura) — a bare
  // `document.querySelector` would silently resolve to whichever mounts first. This test
  // now asserts the composition's own guard: the duellante-preferring selector
  // (`[data-testid="duellante"][data-unit-key=...]`, same one BattleArena/PixiArena use
  // to anchor VFX) resolves to the duellante for a unit that's on stage as the actor,
  // while the plain `[data-unit-key]` selector still finds A match (proving the key isn't
  // just missing) — the point being WHICH element it must prefer, not merely that it's
  // findable, since that ambiguity is exactly what would misplace an effect onto the
  // 84×104 miniature instead of the 420×376 duellante.
  it('renders the dotted unit keyed for VFX targeting, resolving to its duellante (not its miniature)', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    // Inject a real dot effect on harry into a frame's statusEffects (the engine path).
    const dotted = unitKey('left', 'harry')
    replay.frames[1]!.statusEffects = { [dotted]: [{ kind: 'dot', statusId: 'veleno', amount: 6, remaining: 2, stacks: 2 }] }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const anyMatch = document.querySelectorAll(`[data-unit-key="${CSS.escape(dotted)}"]`)
    expect(anyMatch.length).toBe(2) // duellante + miniatura, same key
    const preferred = document.querySelector(`[data-testid="duellante"][data-unit-key="${CSS.escape(dotted)}"]`) as HTMLElement
    expect(preferred).not.toBeNull()
    expect(preferred.getAttribute('data-testid')).toBe('duellante')
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
    // The motion class lands directly on the duellante's OWN root className (merged via
    // `cn`, not a wrapper around it — see BattleArena's renderDuellante), so the check is
    // against the element's own class list, not a descendant. Same duellante-preferring
    // selector as BattleArena/PixiArena's own VFX box lookup, since a bare `[data-unit-key]`
    // selector is now ambiguous (duellante + dimmed miniature share it).
    const actorEl = document.querySelector(`[data-testid="duellante"][data-unit-key="${CSS.escape(actorKey)}"]`) as HTMLElement
    const targetEl = document.querySelector(`[data-testid="duellante"][data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
    expect(actorEl.classList.contains('fx-strike')).toBe(true)
    expect(actorEl.classList.contains('fx-kick')).toBe(false)
    expect(targetEl.classList.contains('fx-kick')).toBe(true)
    expect(targetEl.classList.contains('fx-strike')).toBe(false)
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

  // FIX ROUND 1 (review): the previous suite proved the duellante-preferring selector
  // resolves correctly WHEN CALLED DIRECTLY (in the tests' own queries) but never asserted
  // that BattleArena/PixiArena actually USE that selector internally. Direct falsification:
  // replacing BattleArena's `boxOf` with a bare `document.querySelector('[data-unit-key=…]')`
  // (dropping the `[data-testid="duellante"]` preference) still passed 377/378 of
  // `tests/ui tests/battle` — nothing caught the regression. jsdom's `getBoundingClientRect`
  // returns the same zero-rect for every element, which is exactly why: a test can't tell
  // "measured the duellante" from "measured the miniature" by value unless the two elements
  // are made to report DIFFERENT rects. This test stubs `getBoundingClientRect` per-element
  // (keyed on whether it's the duellante) and asserts the box SceneFx actually receives
  // matches the duellante's stub, not the miniature's — so dropping the preference makes the
  // received box wrong, not merely present. Falsified the same way as Critical 1 (see
  // task-3-report.md for the evidence): reverting `boxOf` to a bare selector turns this red.
  it('the measured box for a staged unit belongs to its duellante (420×376), not its miniature (84×104)', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const hit: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 20, flags: [],
    }
    replay.frames[1]!.entry = hit

    const DUELLANTE_RECT = { top: 84, left: 778, width: 420, height: 376 }
    const MINIATURA_RECT = { top: 62, left: 1264, width: 84, height: 104 }
    const orig = Element.prototype.getBoundingClientRect
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isDuellante = this.getAttribute('data-testid') === 'duellante'
      const r = isDuellante ? DUELLANTE_RECT : MINIATURA_RECT
      return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() { return this } } as DOMRect
    })

    try {
      render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={hit} frameKey={1} />)
      const num = screen.getByTestId('fx-number')
      // SceneFx positions the number at `numberBox.left + numberBox.width / 2`. If the
      // duellante's box won, this is 778 + 210 = 988; if the miniature's box won instead
      // (the regression this test catches), it would be 1264 + 42 = 1306.
      expect(num.style.left).toBe('988px')
      expect(num.style.top).toBe('84px')
    } finally {
      spy.mockRestore()
      expect(Element.prototype.getBoundingClientRect).toBe(orig)
    }
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
    // Exactly one float, inside the "bersaglio" stage slot (the float only renders in the
    // `role === 'bersaglio'` branch of BattleArena's renderDuellante, as a sibling of the
    // Duellante inside that slot's own positioning wrapper — the miniature never gets one).
    const floats = document.querySelectorAll('[data-testid="damage-float"]')
    expect(floats.length).toBe(1)
    const targetSlot = screen.getByTestId('stage-bersaglio')
    const duellanteInSlot = targetSlot.querySelector(`[data-testid="duellante"][data-unit-key="${CSS.escape(targetKey)}"]`)
    expect(duellanteInSlot).not.toBeNull()
    expect(targetSlot.querySelector('[data-testid="damage-float"]')).not.toBeNull()
  })

  // Task 10 asserted the unit's spell NAME still showed on its card (via SpellLine) even
  // without a live cooldown countdown. Task 3 (il palco) removed that assertion's premise
  // entirely: neither `Duellante` nor `Miniatura` renders a spell name or a cooldown row at
  // all — that reading now lives in the ActionPanel/Callout/BattleLog, not on the unit's own
  // portrait. What's still real and worth guarding here is that a cooldown on the frame
  // doesn't break the unit's stage identity: it's still keyed and still resolves to its
  // duellante (the frame's real actor) even while carrying a live cooldown map.
  it('keeps the unit keyed to its duellante when the frame carries a cooldown', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const key = unitKey('left', 'harry')
    const harry = replay.units.find(u => u.key === key)!
    replay.frames[1]!.cooldowns = { [key]: { [harry.spell.id]: 2 } }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const bust = document.querySelector(`[data-testid="duellante"][data-unit-key="${CSS.escape(key)}"]`) as HTMLElement
    expect(bust).not.toBeNull()
    expect(bust.getAttribute('data-testid')).toBe('duellante')
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
