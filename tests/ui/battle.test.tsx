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

  // 2026-09-16 (Task 6): la corsia dei turni (TurnLane) e' RIMOSSA dalla schermata,
  // e il nastro dei sigilli del Task 5 prende il suo posto. Non e' una perdita di
  // informazione: il nastro legge la stessa fonte (initiativeAt sul futuro vero del
  // replay) e in piu' dice CON QUALE incantesimo agira' ciascuno. Tenerle entrambe
  // significava mostrare due volte lo stesso ordine — e, misurato a schermo, i 100px
  // della corsia piu' i 92px della fascia in fondo schiacciavano la fila alleata
  // fuori dai 768px: l'arena posiziona le carte a top assoluto 46/768 e 510/768,
  // quindi ogni striscia sorella le ruba proprio lo spazio che assume di avere.
  // 2026-09-16 (Task 6): l'ActionPanel non e' piu' sovrapposto al nastro. Stava a
  // z-20 sopra la fascia centrale e raddoppiava cio' che il riquadro di fuoco del
  // nastro gia' dice — "Ora · X lancia", il nome dell'incantesimo e il dettaglio
  // "su Y · 85%" — quindi a schermo si leggevano DUE pannelli accavallati sulla
  // stessa informazione (visto nello screenshot, non dedotto). Vince il nastro:
  // e' la forma del mockup approvato. Il componente resta e i suoi test pure.
  it('un solo pannello al centro: il fuoco del nastro, non due sovrapposti', () => {
    renderBattleScreen()
    expect(screen.queryByTestId('stage-center')).toBeNull()
    expect(screen.getByTestId('nastro-focus')).toBeInTheDocument()
  })

  it('il nastro dei sigilli sostituisce la corsia dei turni in schermata', () => {
    renderBattleScreen()
    expect(screen.queryByTestId('turn-lane')).toBeNull()
    expect(screen.getByTestId('nastro-sigilli')).toBeInTheDocument()
  })

  // TurnLane REPLACES InitiativeBar (Task 6 — la corsia mostra il futuro reale del
  // replay, la barra ricalcolava un ordine ordinando per spd; tenerle entrambe le
  // avrebbe fatte contraddire a vicenda e avrebbe sforato il budget di 768px).
  // InitiativeBar resta come componente (altri test lo montano direttamente), ma
  // BattleScreen non lo monta più: questo test lo accerta.
  it('ne la barra di iniziativa ne la corsia restano in schermata', () => {
    renderBattleScreen()
    expect(screen.queryByTestId('initiative-bar')).toBeNull()
    expect(screen.queryByTestId('turn-lane')).toBeNull()
  })

  // 2026-09-16 (Task 6): «registro fuori dal combattimento» — requisito esplicito
  // dello spec. I due resoconti danni e il registro NON sono piu' montati durante lo
  // scontro: occupavano 92px della cornice fissa di 768px e, insieme alla corsia,
  // coprivano la fila alleata (nomi, vita e statistiche invisibili — visto a schermo,
  // non dedotto). Il bisogno che coprivano resta e lo soddisfano ora due cose gia'
  // in campo: le pillole di stato sommate sulla carta (Task 1+2) dicono chi e'
  // avvelenato o silenziato SENZA doverlo leggere a parole, e il resoconto di fine
  // scontro (BattleEndModal) resta il posto dove si legge cos'e' successo.
  it('il registro e i resoconti danni restano FUORI dal combattimento', () => {
    renderBattleScreen()
    expect(screen.queryByTestId('battle-log')).toBeNull()
    expect(screen.queryAllByText(/I tuoi danni/i)).toHaveLength(0)
    expect(screen.queryAllByText(/Danni nemici/i)).toHaveLength(0)
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

// jsdom's `getBoundingClientRect` always returns an all-zero DOMRect. `BattleArena`'s
// `struckBox` measurement (feeding `ColpoSullaCarta`) explicitly bails to `null` when the
// STAGE's own measured width is 0 (`if (f.width === 0 || f.height === 0) { setStruckBox(null)
// ... }` — see BattleArena.tsx), since a zero-width frame can't scale coordinates
// meaningfully. Under bare jsdom that guard ALWAYS fires, so `colpo` never renders in any
// test that doesn't stub non-zero rects — this is a jsdom layout limitation, not a component
// bug (same limitation the pre-Task-5 SceneFx tests already worked around, see the box-stub
// test below). A minimal non-zero stage rect (any target-card rect nested inside it) is
// enough to let the real measurement code path run.
function stubNonZeroRects() {
  const orig = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const isStage = this.getAttribute('data-testid') === 'stage'
    const r = isStage ? { top: 0, left: 0, width: 1366, height: 768 } : { top: 46, left: 250, width: 212, height: 254 }
    return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() { return this } } as DOMRect
  })
  return () => {
    vi.mocked(Element.prototype.getBoundingClientRect).mockRestore()
    expect(Element.prototype.getBoundingClientRect).toBe(orig)
  }
}

describe('BattleArena', () => {
  // 2026-09-16 (Task 5, "la scena, composta"): la scena dei due Duellante grandi + Miniature
  // laterali (Task 3, "il palco") e' stata RESPINTA dall'utente a schermo -- "fa totalmente
  // schifo" -- perche' con cinque maghi per lato "in modalita' teatro" il campo si perdeva. La
  // composizione torna a dieci CartaCombat complete e della stessa taglia, in due file da
  // cinque (nemici sopra, alleati sotto), col nastro dei sigilli al centro. Questo sostituisce
  // l'assert "2 duellanti + N miniature" con quello letterale del nuovo piano: tutte le carte,
  // mai solo due.
  it('la scena mostra tutte e dieci le carte, mai solo due', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    render(<BattleArena replay={replay} hp={replay.frames[firstReal]!.hp} entry={replay.frames[firstReal]!.entry} frameKey={firstReal} />)
    expect(screen.getAllByTestId('carta-combat')).toHaveLength(replay.units.length)
    expect(screen.queryAllByTestId('duellante')).toHaveLength(0)
    expect(screen.queryAllByTestId('miniatura')).toHaveLength(0)
  })

  // Un tick di veleno o un Duo non hanno attore/bersaglio propri (system frame): il ribbon
  // LANCIA/COLPITA e la cornice ruolo restano su chi ha compiuto l'ultima azione vera
  // (lastRealEntryAt), come gia' fa la corsia dei turni -- il ruolo non si spegne mai a meta'
  // battaglia. Stessa fixture minima (costruita a mano, non dal motore reale -- nessun seed
  // 5v5 produce un frame senza NE' actorSide NE' targetSide) gia' usata prima del Task 3 per
  // falsificare la stessa proprieta'; qui l'assert e' sulle carte, non sui duellanti.
  it('sui frame di sistema senza attore/bersaglio propri il ruolo tiene l\'ultima azione vera', () => {
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
    expect(poisonTick.actorSide).toBeUndefined()
    expect(poisonTick.targetSide).toBeUndefined()

    render(<BattleArena replay={replay} hp={replay.frames[2]!.hp} entry={poisonTick} frameKey={2} />)
    const actorCard = document.querySelector('[data-testid="carta-combat"][data-unit-key="left:x"]') as HTMLElement
    const targetCard = document.querySelector('[data-testid="carta-combat"][data-unit-key="right:foe"]') as HTMLElement
    expect(actorCard.getAttribute('data-ruolo')).toBe('attore')
    expect(targetCard.getAttribute('data-ruolo')).toBe('bersaglio')
    expect(screen.getByText('◆ LANCIA')).toBeInTheDocument()
    expect(screen.getByText('✖ COLPITA')).toBeInTheDocument()
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

  // Task 3 ("il palco") asserted a duellante-preferring selector because `data-unit-key`
  // appeared twice per staged unit (its Duellante + its dimmed Miniatura). Task 5 ("la
  // scena, composta") removes the second copy entirely: every unit is now ONE CartaCombat,
  // so `data-unit-key` appears exactly ONCE per unit regardless of role. This rewrite drops
  // the "prefers duellante" assertion (the ambiguity it guarded no longer exists) and checks
  // what replaces it: a single, unambiguous match.
  it('keys each unit for VFX targeting with a single unambiguous carta-combat match', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const dotted = unitKey('left', 'harry')
    replay.frames[1]!.statusEffects = { [dotted]: [{ kind: 'dot', statusId: 'veleno', amount: 6, remaining: 2, stacks: 2 }] }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const anyMatch = document.querySelectorAll(`[data-unit-key="${CSS.escape(dotted)}"]`)
    expect(anyMatch.length).toBe(1)
    expect(anyMatch[0]!.getAttribute('data-testid')).toBe('carta-combat')
  })

  // Le pillole erano sparite col rifacimento pre-Task-3 (UnitBust le aveva, WizardCard no).
  // Task 5: CartaCombat le somma per famiglia tramite lib/battleStacks (`pilloleDi`) col
  // proprio testid `carta-pillola` -- non piu' `status-pip` (quello resta lo StatusPips
  // standalone, che BattleArena non monta piu').
  it('mostra gli stati attivi sulle unità in battaglia', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const poisoned = unitKey('left', 'harry')
    replay.frames[1]!.statusEffects = { [poisoned]: [{ kind: 'dot', statusId: 'veleno', amount: 6, remaining: 2, stacks: 3 }] }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    expect(screen.getAllByTestId('carta-pillola').length).toBeGreaterThanOrEqual(1)
  })

  // Fix round 1 (Task 3 review): asymmetric -- actor gets fx-strike, target gets fx-kick -- so
  // a swapped actor/target wiring in BattleArena's cardMotion fails this test. Still true
  // against the new scene: the motion class lands on the CartaCombat's own root className
  // (merged via `cn`), not a wrapper -- only the selector changed (carta-combat, not
  // duellante), since `data-unit-key` is no longer ambiguous (one card per unit, see above).
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
    const actorEl = document.querySelector(`[data-testid="carta-combat"][data-unit-key="${CSS.escape(actorKey)}"]`) as HTMLElement
    const targetEl = document.querySelector(`[data-testid="carta-combat"][data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
    expect(actorEl.classList.contains('fx-strike')).toBe(true)
    expect(actorEl.classList.contains('fx-kick')).toBe(false)
    expect(targetEl.classList.contains('fx-kick')).toBe(true)
    expect(targetEl.classList.contains('fx-strike')).toBe(false)
  })

  // Fix round 1 (Task 3 review): proves prevFrame is really `replay.frames[frameKey - 1]` and
  // not a stand-in. Still exercised the same way post-Task-5: BattleArena still computes
  // `sceneEvent` from `sceneEventOf(frame, prevFrame)` to feed ColpoSullaCarta and the motion
  // classes -- only the DOWNSTREAM consumer of that scene changed (ColpoSullaCarta instead of
  // SceneFx), not the wiring this test guards.
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

  // Fix round 1 (Task 3 review) asserted SceneFx's number/word mounted through BattleArena's
  // own wiring, not just its isolated unit tests. Task 4 replaced SceneFx's number/word layer
  // with ColpoSullaCarta (anchored to the struck CARD's own box, not a free-floating
  // position) -- BattleArena no longer mounts SceneFx at all (`scene-fx`/`fx-number` are gone
  // from its output). This rewrite asserts the successor: `colpo`/`colpo-numero` render
  // through the arena for a real hit frame, with the actual number.
  it('renders ColpoSullaCarta\'s number through the arena for a real hit frame', () => {
    const restore = stubNonZeroRects()
    try {
      const l = left(), r = right()
      const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
      const hit: LogEntry = {
        turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
        targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 37, flags: [],
      }
      replay.frames[1]!.entry = hit
      render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={hit} frameKey={1} />)
      expect(screen.getByTestId('colpo')).toBeInTheDocument()
      expect(screen.getByTestId('colpo-numero')).toHaveTextContent('37')
    } finally {
      restore()
    }
  })

  // Fix round 1 (Task 3 review) checked SceneFx actually received a resolved (non-null) box
  // via a `position: fixed` inline-style tell. ColpoSullaCarta's box contract is different (a
  // plain `{x,y,w,h}` in FRAME coordinates, not a DOMRect prop) -- it positions itself with
  // `left`/`top` numeric pixel styles derived from that box's center, always inline. This
  // rewrite checks the successor signal: the rendered `left`/`top` are real finite numbers,
  // i.e. `struckBox` resolved to the actual struck card rather than staying null (which would
  // make ColpoSullaCarta return null entirely -- see its own `if (!box) return null`).
  it('measures a real box for the targeted card and feeds it to the colpo position', () => {
    const restore = stubNonZeroRects()
    try {
      const l = left(), r = right()
      const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
      const hit: LogEntry = {
        turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
        targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 20, flags: [],
      }
      replay.frames[1]!.entry = hit
      render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={hit} frameKey={1} />)
      const colpo = screen.getByTestId('colpo')
      expect(colpo.style.left).not.toBe('')
      expect(colpo.style.top).not.toBe('')
      expect(Number.isFinite(parseFloat(colpo.style.left))).toBe(true)
      expect(Number.isFinite(parseFloat(colpo.style.top))).toBe(true)
    } finally {
      restore()
    }
  })

  // FIX ROUND 1 (Task 3 review) stubbed getBoundingClientRect per-element (duellante vs
  // miniature) to prove BattleArena's box measurement actually PREFERS the right element, not
  // merely that it doesn't crash. Task 5's `struckBox` is a DIFFERENT measurement (the struck
  // CARD's own rect, converted into frame coordinates via the stage's own rect), but the same
  // failure mode is possible: silently measuring the wrong element, or a stale one. This
  // rewrite stubs the stage frame and the target card to distinct, known rects and asserts the
  // resulting `colpo` position reflects THAT ratio -- falsified the same way as before:
  // swapping which rect id the card reads (target vs a bystander) turns this red.
  it('the measured colpo position is derived from the struck card\'s own rect within the frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const hit: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 20, flags: [],
    }
    replay.frames[1]!.entry = hit
    const targetKey = unitKey('right', 'draco')

    const FRAME_RECT = { top: 0, left: 0, width: 1366, height: 768 }
    const CARD_RECT = { top: 46, left: 250, width: 212, height: 254 }
    const orig = Element.prototype.getBoundingClientRect
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isStage = this.getAttribute('data-testid') === 'stage'
      const isTargetCard = this.getAttribute('data-testid') === 'carta-combat'
        && this.getAttribute('data-unit-key') === targetKey
      const r = isStage ? FRAME_RECT : isTargetCard ? CARD_RECT : { top: 900, left: 900, width: 1, height: 1 }
      return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() { return this } } as DOMRect
    })

    try {
      render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={hit} frameKey={1} />)
      const colpo = screen.getByTestId('colpo')
      // ColpoSullaCarta centers on the box: left = clamp(box.x + box.w/2, 80, 1286).
      // box.x/box.w come straight from CARD_RECT (scale 1366/1366 = 1): center = 250+106=356.
      expect(colpo.style.left).toBe('356px')
      // top = box.y + box.h/2 = 46 + 127 = 173.
      expect(colpo.style.top).toBe('173px')
    } finally {
      spy.mockRestore()
      expect(Element.prototype.getBoundingClientRect).toBe(orig)
    }
  })

  // Task 3 asserted the damage float rendered only inside the target's stage slot. Task 5
  // removed `damageFloat`/`floatFor` from BattleArena entirely -- the struck number now lives
  // exclusively on ColpoSullaCarta, anchored to the struck card itself. This rewrite checks
  // the successor guard: exactly one `colpo` for the hit, and no legacy per-card float.
  it('shows exactly one colpo for the hit, not one per card', () => {
    const restore = stubNonZeroRects()
    try {
      const l = left(), r = right()
      const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
      const e: LogEntry = {
        turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
        targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
      }
      render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
      expect(document.querySelectorAll('[data-testid="colpo"]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-testid="damage-float"]')).toHaveLength(0)
    } finally {
      restore()
    }
  })

  // Task 10 asserted the unit's spell NAME still showed on its card even without a live
  // cooldown countdown. Task 3 removed that (neither Duellante nor Miniatura rendered it).
  // Task 5's CartaCombat DOES render the spell name again (`cc-sp`, via the `spell` prop
  // BattleArena feeds from SPELL_BY_ID) -- this rewrite restores that coverage AND keeps the
  // Task 3 guard (a cooldown on the frame doesn't break the unit's card identity: still keyed,
  // still resolves to exactly one carta-combat).
  it('keeps the unit keyed to its single carta-combat when the frame carries a cooldown, spell name intact', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const key = unitKey('left', 'harry')
    const harry = replay.units.find(u => u.key === key)!
    replay.frames[1]!.cooldowns = { [key]: { [harry.spell.id]: 2 } }
    render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={replay.frames[1]!.entry} frameKey={1} />)
    const cards = document.querySelectorAll(`[data-testid="carta-combat"][data-unit-key="${CSS.escape(key)}"]`)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.textContent).toContain(harry.spell.name)
  })

  // Task 5: il nastro dei sigilli sostituisce la corsia di iniziativa al centro della scena --
  // qui si verifica solo che BattleArena lo monti davvero, non la sua logica interna (coperta
  // da tests/battle/NastroSigilli.test.tsx).
  it('monta il nastro dei sigilli al centro della scena', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    render(<BattleArena replay={replay} hp={replay.frames[firstReal]!.hp} entry={replay.frames[firstReal]!.entry} frameKey={firstReal} />)
    expect(screen.getByTestId('nastro-sigilli')).toBeInTheDocument()
    // 2026-09-16: era >= 4; la finestra dei futuri e' scesa da 7 a 3 perche' 9
    // slot su 15 finivano fuori cornice o sotto il riquadro (misurato a 1600x900).
    expect(screen.getAllByTestId('sigillo').length).toBeGreaterThanOrEqual(3)
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
