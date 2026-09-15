# Battaglia — la corsia del tempo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rifare la schermata di battaglia sul layout «corsia del tempo» approvato dall'utente, dando a **ogni evento che il motore produce** una scena visibile: i turni saltati, i dieci stati alterati, i Duo che scattano, le uccisioni.

**Architecture:** Si costruisce dal basso. Prima un modulo puro che traduce un `ReplayFrame` in un *evento di scena* tipizzato (nessun React); poi i tre pezzi visivi indipendenti (pillole di stato, corsia dei turni, livello effetti); infine la schermata che li compone e li guida col replay esistente. Il motore, il bilanciamento e `buildReplay` non si toccano: tutti i dati necessari sono già nei frame.

**Tech Stack:** TypeScript, React 19, Next 16, Tailwind 4, Vitest + Testing Library, animazioni CSS (nessuna libreria nuova).

**Spec:** `docs/superpowers/specs/2026-09-15-battaglia-corsia-del-tempo-design.md`

**Mockup di riferimento:** https://claude.ai/artifact/4CshXus1RM1hDnX8eFTfHN — versione 11, «La corsia del tempo». È la specifica visiva: dove il piano e il mockup divergono, vince il mockup.

## Global Constraints

- **Ogni evento del motore deve avere una scena.** Requisito esplicito dell'utente: «MI DEVI FAR VEDERE TUTTO QUELLO CHE SUCCEDE, SOPRATTUTTO GLI EFFETTI SPECIALI». Un frame che non produce nulla a schermo è un difetto, non una semplificazione.
- **Il turno saltato è una scena, non un buco.** Oggi `action: 'Stordito'` (`simulate.ts:247`) passa senza che si veda nulla.
- **La battaglia resta dentro 1366×768** senza scorrimento del documento, con tutte le unità visibili. È il vincolo che il lavoro precedente ha appena conquistato: non va perso.
- **Non si tocca** `game/engine/` (motore, `simulate.ts`, `replay.ts`), `data/`, né il bilanciamento. Tutti i dati servono già: `ReplayFrame` porta `hp`, `statusEffects`, `cooldowns`, `effSpd`.
- **`prefers-reduced-motion` va rispettato ovunque**: restano gli stati finali (barra scesa, pillole aggiornate, caduto grigio, registro scritto), sparisce solo il movimento. Nessuna informazione può vivere solo dentro un'animazione.
- `npm run test` **non** esegue il typecheck: lanciare `npm run typecheck 2>&1 | grep -v '.next/dev'` a parte (l'errore in `.next/dev/` è un artefatto pre-esistente).
- **Nessun test va silenziato.** Dove un'asserzione cambia, si aggiorna con un commento che spiega perché.
- Alias `@/` per la radice. Singolo file: `npx vitest run <path>`.

---

## Cosa il motore produce davvero

Censito prima di scrivere il piano, perché «tutto quello che succede» va definito con precisione.

**11 azioni di sistema** (`grep "action: '" game/engine/combat/simulate.ts`):
`Stordito` · `Rigenera` · `Miasma` · `MuroVivente` · `Riflesso` · `Untore` · `Purificazione` · `Fatica` · `Ricarica` · `Reliquia` · `KO`

**13 flag di log** (`types/combat.ts:96`):
`crit` · `dodge` · `kill` · `heal` · `block` · `stun` · `dot` · `pen` · `shatter` · `wait` · `recoil` · `revive` · `duo`

**10 `kind` di stato, ma 24 `id`** (`data/statuses.ts`) — ed è l'`id` che va disegnato, perché è lì che sta la differenza fra tre gradi di lentezza:
`stun` · `freeze` · `silence` · `disarm` · `burn` · `veleno` · `regen` · `shield` · `protego` · `atkUp` · `atkUp1` · `defUp` · `spdUp` · `slow` · `slow1..3` · `weaken1..3` · `expose1..3` · `raccolto`

Oggi la battaglia ne mostra tre: il colpo, la barra della vita, e la riga del registro.

---

## File Structure

| File | Responsabilità |
|---|---|
| `lib/battleScene.ts` | **Creare.** Funzione pura `sceneEventOf(frame, prevFrame)` → evento di scena tipizzato. Nessun React, interamente testabile. |
| `components/battle/StatusPips.tsx` | **Creare.** Le pillole di stato di un'unità, col conteggio delle dosi. |
| `components/battle/TurnLane.tsx` | **Creare.** La corsia dei turni: chi agisce, con quale magia, e chi salterà. |
| `components/battle/SceneFx.tsx` | **Creare.** Il livello degli effetti: numeri, parole, onde d'urto, scie, cupole. |
| `components/battle/battleAnim.css` | **Creare.** I fotogrammi chiave, in un file solo. |
| `components/battle/BattleArena.tsx` | **Modificare.** Compone scena + pillole + effetti. |
| `components/screens/BattleScreen.tsx` | **Modificare.** Aggiunge la corsia, ridispone l'altezza. |

---

## Task 1: L'evento di scena

**Files:**
- Create: `lib/battleScene.ts`
- Test: `tests/lib/battleScene.test.ts`

**Interfaces:**
- Consumes: `ReplayFrame`, `ReplayUnit` da `@/game/engine/combat/replay`; `LogEntry`, `ActiveEffect` da `@/types`.
- Produces:
  ```ts
  export type SceneKind =
    | 'hit' | 'crit' | 'dodge' | 'block' | 'pen' | 'heal' | 'kill' | 'revive'
    | 'skip' | 'dot' | 'regen' | 'fatigue' | 'purify' | 'recoil'
    | 'duo-miasma' | 'duo-muro' | 'duo-untore' | 'cooldown' | 'relic' | 'none'

  export interface SceneEvent {
    kind: SceneKind
    actorKey?: string
    targetKey?: string
    /** Danno o cura, già in valore assoluto. */
    amount?: number
    /** Parola da far esplodere al centro (CRITICO, SALTA, K.O., MIASMA…). */
    word?: string
    /** Stati COMPARSI su un'unità in questo frame: unitKey -> kind[]. */
    gained: Record<string, string[]>
    /** Stati SPARITI in questo frame: unitKey -> kind[]. */
    lost: Record<string, string[]>
  }

  export function sceneEventOf(frame: ReplayFrame, prev?: ReplayFrame): SceneEvent
  ```

Il `diff` degli stati fra due frame è il cuore: è ciò che permette di animare la comparsa del veleno o la fine di un congelamento senza che il motore debba dire nulla di nuovo.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/battleScene.test.ts
import { describe, it, expect } from 'vitest'
import { sceneEventOf } from '@/lib/battleScene'
import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const frame = (entry: LogEntry | null, statusEffects: Record<string, {kind: string}[]> = {}): ReplayFrame =>
  ({ index: 1, entry, hp: {}, cooldowns: {}, statusEffects: statusEffects as never } as ReplayFrame)

const entry = (p: Partial<LogEntry>): LogEntry =>
  ({ turn: 1, actorId: 'a', actorSide: 'left', action: 'Colpo', type: 'Attacco', flags: [], ...p } as LogEntry)

describe('sceneEventOf — ogni evento del motore ha una scena', () => {
  it('un turno saltato è una scena, non un buco', () => {
    const e = sceneEventOf(frame(entry({ action: 'Stordito', type: 'system', flags: ['stun'] })))
    expect(e.kind).toBe('skip')
    expect(e.word).toBe('SALTA')
  })

  it('riconosce il critico dal flag, non dal valore', () => {
    expect(sceneEventOf(frame(entry({ flags: ['crit'], value: 74 }))).kind).toBe('crit')
    expect(sceneEventOf(frame(entry({ flags: [], value: 74 }))).kind).toBe('hit')
  })

  it('riconosce schivata, blocco, penetrazione, contraccolpo', () => {
    expect(sceneEventOf(frame(entry({ flags: ['dodge'] }))).kind).toBe('dodge')
    expect(sceneEventOf(frame(entry({ flags: ['block'] }))).kind).toBe('block')
    expect(sceneEventOf(frame(entry({ flags: ['pen'] }))).kind).toBe('pen')
    expect(sceneEventOf(frame(entry({ flags: ['recoil'] }))).kind).toBe('recoil')
  })

  it('la cura e la rianimazione sono scene distinte', () => {
    expect(sceneEventOf(frame(entry({ flags: ['heal'], value: 28 }))).kind).toBe('heal')
    expect(sceneEventOf(frame(entry({ flags: ['revive'] }))).kind).toBe('revive')
  })

  it('l’uccisione vince su qualunque altro flag', () => {
    expect(sceneEventOf(frame(entry({ flags: ['crit', 'kill'] }))).kind).toBe('kill')
  })

  it('riconosce le tre azioni di Duo per nome', () => {
    expect(sceneEventOf(frame(entry({ action: 'Miasma', type: 'system' }))).kind).toBe('duo-miasma')
    expect(sceneEventOf(frame(entry({ action: 'MuroVivente', type: 'system' }))).kind).toBe('duo-muro')
    expect(sceneEventOf(frame(entry({ action: 'Untore', type: 'system' }))).kind).toBe('duo-untore')
  })

  it('riconosce Fatica, Purificazione e Rigenera', () => {
    expect(sceneEventOf(frame(entry({ action: 'Fatica', type: 'system' }))).kind).toBe('fatigue')
    expect(sceneEventOf(frame(entry({ action: 'Purificazione', type: 'system' }))).kind).toBe('purify')
    expect(sceneEventOf(frame(entry({ action: 'Rigenera', type: 'system' }))).kind).toBe('regen')
  })

  it('il danno nel tempo si riconosce dal flag dot', () => {
    expect(sceneEventOf(frame(entry({ flags: ['dot'], value: 6 }))).kind).toBe('dot')
  })

  it('confronta gli stati fra due frame: comparsi e spariti', () => {
    const prev = frame(null, { 'left:harry': [{ kind: 'shield' }] })
    const now  = frame(entry({}), { 'left:harry': [{ kind: 'veleno' }, { kind: 'stun' }] })
    const e = sceneEventOf(now, prev)
    expect(e.gained['left:harry']).toEqual(expect.arrayContaining(['veleno', 'stun']))
    expect(e.lost['left:harry']).toEqual(['shield'])
  })

  it('il valore è sempre positivo, anche per i danni', () => {
    expect(sceneEventOf(frame(entry({ value: -31 }))).amount).toBe(31)
  })

  it('un frame senza entry non produce scena', () => {
    expect(sceneEventOf(frame(null)).kind).toBe('none')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/battleScene.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/battleScene"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/battleScene.ts
import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { ActiveEffect, LogEntry } from '@/types'

export type SceneKind =
  | 'hit' | 'crit' | 'dodge' | 'block' | 'pen' | 'heal' | 'kill' | 'revive'
  | 'skip' | 'dot' | 'regen' | 'fatigue' | 'purify' | 'recoil'
  | 'duo-miasma' | 'duo-muro' | 'duo-untore' | 'cooldown' | 'relic' | 'none'

export interface SceneEvent {
  kind: SceneKind
  actorKey?: string
  targetKey?: string
  amount?: number
  word?: string
  gained: Record<string, string[]>
  lost: Record<string, string[]>
}

/** Azioni di sistema del motore (simulate.ts) → scena. Le tre di Duo hanno una
 *  scena propria perché sono i momenti in cui la build del giocatore si vede
 *  lavorare: meritano il nome esploso al centro, non una riga di registro. */
const BY_ACTION: Record<string, { kind: SceneKind; word?: string }> = {
  Stordito:      { kind: 'skip',        word: 'SALTA' },
  Fatica:        { kind: 'fatigue',     word: 'SFINIMENTO' },
  Purificazione: { kind: 'purify',      word: 'PURIFICATO' },
  Rigenera:      { kind: 'regen' },
  Miasma:        { kind: 'duo-miasma',  word: 'MIASMA' },
  MuroVivente:   { kind: 'duo-muro',    word: 'MURO VIVENTE' },
  Riflesso:      { kind: 'duo-muro',    word: 'RIFLESSO' },
  Untore:        { kind: 'duo-untore',  word: 'UNTORE' },
  Ricarica:      { kind: 'cooldown' },
  Reliquia:      { kind: 'relic' },
  KO:            { kind: 'kill',        word: 'K.O.' },
}

/** Flag → scena, in ordine di PRECEDENZA: un colpo che uccide è una morte, non
 *  un critico, anche se porta entrambi i flag. */
const BY_FLAG: Array<[string, SceneKind, string | undefined]> = [
  ['kill',   'kill',   'K.O.'],
  ['revive', 'revive', 'RIANIMATO'],
  ['dodge',  'dodge',  'SCHIVA'],
  ['block',  'block',  undefined],
  ['recoil', 'recoil', 'CONTRACCOLPO'],
  ['pen',    'pen',    'ARMATURA FORATA'],
  ['crit',   'crit',   'CRITICO'],
  ['dot',    'dot',    undefined],
  ['heal',   'heal',   undefined],
]

function kindsOf(list: ActiveEffect[] | undefined): string[] {
  return (list ?? []).map(e => (e as { statusId?: string; kind: string }).statusId ?? e.kind)
}

/** Stati comparsi e spariti fra due frame. È ciò che permette di animare la
 *  comparsa del veleno o la fine di un congelamento senza che il motore debba
 *  emettere un evento dedicato: la differenza fra due fotogrammi basta. */
function diffStatuses(now: ReplayFrame, prev?: ReplayFrame) {
  const gained: Record<string, string[]> = {}
  const lost: Record<string, string[]> = {}
  const keys = new Set([...Object.keys(now.statusEffects ?? {}), ...Object.keys(prev?.statusEffects ?? {})])
  for (const k of keys) {
    const a = kindsOf(prev?.statusEffects?.[k])
    const b = kindsOf(now.statusEffects?.[k])
    const g = b.filter(x => !a.includes(x))
    const l = a.filter(x => !b.includes(x))
    if (g.length) gained[k] = g
    if (l.length) lost[k] = l
  }
  return { gained, lost }
}

/**
 * Traduce un fotogramma del replay nell'evento che la scena deve mostrare.
 *
 * Pura: stesso frame, stessa scena. Non legge stato di riproduzione, quindi
 * riavvolgere o saltare avanti dà sempre lo stesso risultato.
 */
export function sceneEventOf(frame: ReplayFrame, prev?: ReplayFrame): SceneEvent {
  const { gained, lost } = diffStatuses(frame, prev)
  const e: LogEntry | null = frame.entry
  if (!e) return { kind: 'none', gained, lost }

  const base = {
    actorKey: e.actorSide && e.actorId ? `${e.actorSide}:${e.actorId}` : undefined,
    targetKey: e.targetSide && e.targetId ? `${e.targetSide}:${e.targetId}` : undefined,
    amount: e.value !== undefined ? Math.abs(e.value) : undefined,
    gained, lost,
  }

  for (const [flag, kind, word] of BY_FLAG) {
    if (e.flags.includes(flag as never)) return { ...base, kind, word }
  }
  const byAction = BY_ACTION[e.action]
  if (byAction) return { ...base, kind: byAction.kind, word: byAction.word }

  return { ...base, kind: 'hit' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/battleScene.test.ts`
Expected: PASS — 11 test.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck 2>&1 | grep -v '.next/dev'` — Expected: nessun errore.

```bash
git add lib/battleScene.ts tests/lib/battleScene.test.ts
git commit -m "feat(battaglia): ogni frame del motore diventa un evento di scena"
```

---

## Task 2: Le pillole di stato

**Files:**
- Create: `components/battle/StatusPips.tsx`
- Test: `tests/battle/StatusPips.test.tsx`

**Interfaces:**
- Consumes: `ActiveEffect` da `@/types`.
- Produces:
  ```tsx
  export function StatusPips({ effects, className }: {
    effects: ActiveEffect[]
    className?: string
  }): JSX.Element | null
  ```

Ritorna `null` quando non c'è nessuno stato: niente segnaposto.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/StatusPips.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPips } from '@/components/battle/StatusPips'
import { STATUS_DEFS } from '@/data/statuses'
import type { ActiveEffect } from '@/types'

const fx = (kind: string, extra: Record<string, unknown> = {}) =>
  ({ kind, statusId: kind, remaining: 2, stacks: 1, ...extra } as unknown as ActiveEffect)

describe('StatusPips', () => {
  it('senza stati non mostra nulla', () => {
    const { container } = render(<StatusPips effects={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('una pillola per ogni stato attivo', () => {
    render(<StatusPips effects={[fx('veleno'), fx('stun'), fx('shield')]} />)
    expect(screen.getAllByTestId('status-pip')).toHaveLength(3)
  })

  it('il veleno mostra le DOSI, non i turni rimanenti', () => {
    // Il veleno è permanente: `remaining` resta fermo a 2, il numero che cresce
    // è `stacks`. Mostrare `remaining` è un difetto storico del progetto.
    render(<StatusPips effects={[fx('veleno', { remaining: 2, stacks: 4 })]} />)
    expect(screen.getByTestId('status-pip')).toHaveTextContent('4')
  })

  it('ogni pillola ha un titolo che spiega lo stato', () => {
    render(<StatusPips effects={[fx('freeze')]} />)
    expect(screen.getByTestId('status-pip')).toHaveAttribute('title', expect.stringMatching(/congel/i))
  })

  it('stati diversi hanno colori diversi', () => {
    render(<StatusPips effects={[fx('veleno'), fx('stun')]} />)
    const [a, b] = screen.getAllByTestId('status-pip')
    expect(a!.getAttribute('data-kind')).not.toBe(b!.getAttribute('data-kind'))
  })

  it('OGNI stato del catalogo ha un glifo suo — nessuno cade sul puntino', () => {
    // Il catalogo ha 24 id, non i dieci `kind`: tre gradi di lentezza, tre di
    // indebolimento, due di vulnerabilità. Letto da `STATUS_DEFS` invece che da
    // una lista scritta a mano, così aggiungere uno stato senza dargli una
    // pillola rende questo test rosso.
    const senzaGlifo = STATUS_DEFS.filter(d => {
      render(<StatusPips effects={[fx(d.id)]} />)
      const pip = screen.getAllByTestId('status-pip').at(-1)!
      return pip.textContent?.startsWith('\u2022')
    }).map(d => d.id)
    expect(senzaGlifo, `stati senza glifo: ${senzaGlifo.join(', ')}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/StatusPips.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

Leggere prima `data/statuses.ts` per i dieci `id` reali e le loro descrizioni: la mappa sotto deve coprirli tutti, e il test del passo 1 fallisce finché un `title` non c'è.

```tsx
// components/battle/StatusPips.tsx
import type { ActiveEffect } from '@/types'
import { STATUS_BY_ID } from '@/data/statuses'

/** Glifo e colore per stato. Copre TUTTI i 24 `id` di `data/statuses.ts` —
 *  il test di copertura più sotto lo fa rispettare. I colori riprendono quelli
 *  già usati dal gioco per le stesse idee (verde veleno, ambra stordimento,
 *  azzurro scudo), e gli stati della stessa famiglia condividono il glifo:
 *  tre gradi di lentezza sono la stessa idea, non tre icone da imparare. */
const PIP: Record<string, { glyph: string; color: string }> = {
  // controllo — il turno salta o si perde un'opzione
  stun:     { glyph: '✦', color: '#f0d48a' },
  freeze:   { glyph: '❄', color: '#7dd3ff' },
  silence:  { glyph: '✖', color: '#c4a3ff' },
  disarm:   { glyph: '✋', color: '#ffd37d' },
  // danno nel tempo
  veleno:   { glyph: '☠', color: '#8fd98f' },
  burn:     { glyph: '🔥', color: '#ffb37d' },
  // difesa
  shield:   { glyph: '◈', color: '#8ab6f0' },
  protego:  { glyph: '❖', color: '#8ab6f0' },
  regen:    { glyph: '✚', color: '#7cfc9b' },
  // potenziamenti
  atkUp:    { glyph: '▲', color: '#ff9a7a' },
  atkUp1:   { glyph: '▲', color: '#ff9a7a' },
  defUp:    { glyph: '▲', color: '#8ab6f0' },
  spdUp:    { glyph: '▲', color: '#f0d48a' },
  raccolto: { glyph: '✦', color: '#f0d48a' },
  // indebolimenti
  slow:     { glyph: '▼', color: '#ffb37d' },
  slow1:    { glyph: '▼', color: '#ffb37d' },
  slow2:    { glyph: '▼', color: '#ffb37d' },
  slow3:    { glyph: '▼', color: '#ffb37d' },
  weaken1:  { glyph: '▼', color: '#ffb37d' },
  weaken2:  { glyph: '▼', color: '#ffb37d' },
  weaken3:  { glyph: '▼', color: '#ffb37d' },
  expose1:  { glyph: '◇', color: '#ff9a7a' },
  expose2:  { glyph: '◇', color: '#ff9a7a' },
  expose3:  { glyph: '◇', color: '#ff9a7a' },
}

/** Il numero da mostrare sulla pillola. Per il veleno sono le DOSI (`stacks`):
 *  è permanente, quindi `remaining` resta fermo a 2 e mostrarlo sarebbe una
 *  bugia — il numero che cresce a ogni dose è `stacks`. Per tutto il resto il
 *  numero utile è quanti turni mancano. */
function pipCount(e: ActiveEffect): number | undefined {
  const id = (e as { statusId?: string }).statusId ?? e.kind
  const stacks = (e as { stacks?: number }).stacks ?? 1
  const remaining = (e as { remaining?: number }).remaining
  if (id === 'veleno' || id === 'burn') return stacks > 1 ? stacks : undefined
  return remaining !== undefined && remaining > 1 ? remaining : undefined
}

/** Gli stati attivi di un'unità, come pillole sul suo ritratto. Oggi non si
 *  vedono affatto: dal frame dopo l'applicazione il giocatore non ha modo di
 *  sapere che un mago è avvelenato, silenziato o congelato. */
export function StatusPips({ effects, className }: { effects: ActiveEffect[]; className?: string }) {
  if (!effects || effects.length === 0) return null
  return (
    <span className={`pointer-events-none absolute left-1.5 top-1.5 z-20 flex max-w-[86%] flex-wrap gap-[3px] ${className ?? ''}`}>
      {effects.map((e, i) => {
        const id = (e as { statusId?: string }).statusId ?? e.kind
        const meta = PIP[id] ?? { glyph: '•', color: '#9aa3ad' }
        const def = STATUS_BY_ID[id]
        const n = pipCount(e)
        return (
          <span
            key={`${id}-${i}`}
            data-testid="status-pip"
            data-kind={id}
            title={def ? `${def.name}${n ? ` — ${n}` : ''}` : id}
            className="flex h-[15px] items-center gap-[2px] rounded-[5px] px-1 text-[9px] font-black leading-none text-[#0a0814]"
            style={{ background: meta.color }}
          >
            {meta.glyph}{n !== undefined && <b>{n}</b>}
          </span>
        )
      })}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/StatusPips.test.tsx`
Expected: PASS — 6 test. Se il test di copertura elenca stati senza glifo, aggiungerli alla mappa `PIP` — **non** indebolire il test.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/StatusPips.tsx tests/battle/StatusPips.test.tsx
git commit -m "feat(battaglia): pillole di stato sulle unita, col conteggio dosi"
```

---

## Task 3: La corsia dei turni

**Files:**
- Create: `components/battle/TurnLane.tsx`
- Test: `tests/battle/TurnLane.test.tsx`

**Interfaces:**
- Consumes: `Replay`, `ReplayUnit`, `ReplayFrame` da `@/game/engine/combat/replay`.
- Produces:
  ```tsx
  export function TurnLane({ replay, index, className }: {
    replay: Replay
    index: number
    className?: string
  }): JSX.Element
  ```

La corsia mostra **chi agirà e con quale magia**, e porta il bollino di chi salterà il turno. L'ordine si ricava dallo stesso dato che usa oggi `InitiativeBar`: `frame.effSpd` (velocità effettiva dopo i modificatori), con ripiego sulla `spd` statica dell'unità.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/TurnLane.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurnLane } from '@/components/battle/TurnLane'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const team = (ids: string[]) =>
  ids.map(id => draftWizard(createRng(`lane-${id}`), WIZARDS.find(w => w.id === id)!, false))

function fixture() {
  const l = team(['hermione', 'ron', 'harry'])
  const r = team(['draco', 'goyle', 'crabbe'])
  const res = simulateBattle(l, r, createRng(7), { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r) })
  return buildReplay(res, l, r, { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r), leftRelics: [], rightRelics: [] })
}

describe('TurnLane', () => {
  it('mostra i prossimi turni', () => {
    const replay = fixture()
    render(<TurnLane replay={replay} index={0} />)
    expect(screen.getAllByTestId('lane-slot').length).toBeGreaterThanOrEqual(4)
  })

  it('ogni posto dice CHI agisce e CON COSA', () => {
    const replay = fixture()
    render(<TurnLane replay={replay} index={0} />)
    const first = screen.getAllByTestId('lane-slot')[0]!
    expect(first).toHaveAttribute('data-unit')
    expect(first.textContent).toMatch(/\S/)
  })

  it('marca il posto di chi agisce adesso', () => {
    const replay = fixture()
    render(<TurnLane replay={replay} index={3} />)
    expect(screen.getAllByTestId('lane-slot').filter(s => s.dataset.now === 'true')).toHaveLength(1)
  })

  it('chi è stordito porta il bollino: si sa PRIMA che salterà', () => {
    const replay = fixture()
    const key = replay.units[0]!.key
    const patched = {
      ...replay,
      frames: replay.frames.map(f => ({
        ...f,
        statusEffects: { ...f.statusEffects, [key]: [{ kind: 'stun', statusId: 'stun', remaining: 2, stacks: 1 }] },
      })),
    }
    render(<TurnLane replay={patched as never} index={0} />)
    expect(screen.getAllByTestId('lane-skip').length).toBeGreaterThanOrEqual(1)
  })

  it('un silenziato mostra "colpo base" invece della sua magia', () => {
    const replay = fixture()
    const key = replay.units[0]!.key
    const patched = {
      ...replay,
      frames: replay.frames.map(f => ({
        ...f,
        statusEffects: { ...f.statusEffects, [key]: [{ kind: 'silence', statusId: 'silence', remaining: 2, stacks: 1 }] },
      })),
    }
    render(<TurnLane replay={patched as never} index={0} />)
    expect(screen.getByText(/colpo base/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/TurnLane.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

Prima leggere `components/battle/InitiativeBar.tsx`: l'ordine dei turni è già calcolato lì, e va **riusato** (estraendo la funzione in `lib/initiative.ts` se necessario), non riscritto — due ordinamenti diversi nella stessa schermata sarebbero un difetto.

La corsia:
1. costruisce la sequenza dei prossimi ~8 turni dall'ordine di iniziativa;
2. per ognuno mostra ritratto, nome e **magia**;
3. legge `frame.statusEffects` per marcare chi salterà (`stun`/`freeze`) e chi è silenziato;
4. trasla con `transform: translateX(...)` a ogni avanzamento, con transizione di 0,58 s.

Misure dal mockup: posti larghi 76px, avatar 40px (50px per chi agisce), corsia alta 128px.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/TurnLane.test.tsx`
Expected: PASS — 5 test.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/TurnLane.tsx tests/battle/TurnLane.test.tsx
git commit -m "feat(battaglia): la corsia dei turni mostra chi agisce e con cosa"
```

---

## Task 4: Il livello degli effetti

**Files:**
- Create: `components/battle/SceneFx.tsx`
- Create: `components/battle/battleAnim.css`
- Test: `tests/battle/SceneFx.test.tsx`

**Interfaces:**
- Consumes: `SceneEvent` da `@/lib/battleScene` (Task 1).
- Produces:
  ```tsx
  export function SceneFx({ event, frameKey, actorBox, targetBox }: {
    event: SceneEvent
    /** Cambia a ogni frame: rimonta gli effetti così si riavviano. */
    frameKey: number
    actorBox?: DOMRect | null
    targetBox?: DOMRect | null
  }): JSX.Element | null
  ```

I fotogrammi chiave stanno tutti in `battleAnim.css`, importato una volta sola. Sono quelli del mockup: `strike`, `kick`, `kickBig`, `swerve`, `fall`, `rise`, `numPop`, `numCrit`, `wordPop`, `flash`, `shock`, `trail`, `tickUp`, `domeIn`, `pipPulse`, `shiver`, `breathe`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/SceneFx.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SceneFx } from '@/components/battle/SceneFx'
import type { SceneEvent } from '@/lib/battleScene'

const ev = (p: Partial<SceneEvent>): SceneEvent => ({ kind: 'hit', gained: {}, lost: {}, ...p })

describe('SceneFx', () => {
  it('un colpo mostra il danno', () => {
    render(<SceneFx event={ev({ kind: 'hit', amount: 28 })} frameKey={1} />)
    expect(screen.getByTestId('fx-number')).toHaveTextContent('28')
  })

  it('il critico mostra la parola e un numero piu grande', () => {
    render(<SceneFx event={ev({ kind: 'crit', amount: 74, word: 'CRITICO' })} frameKey={1} />)
    expect(screen.getByTestId('fx-word')).toHaveTextContent('CRITICO')
    expect(screen.getByTestId('fx-number')).toHaveAttribute('data-size', 'big')
  })

  it('il turno saltato mostra SALTA e nessun numero', () => {
    render(<SceneFx event={ev({ kind: 'skip', word: 'SALTA' })} frameKey={1} />)
    expect(screen.getByTestId('fx-word')).toHaveTextContent('SALTA')
    expect(screen.queryByTestId('fx-number')).not.toBeInTheDocument()
  })

  it('la schivata non mostra numeri', () => {
    render(<SceneFx event={ev({ kind: 'dodge', word: 'SCHIVA' })} frameKey={1} />)
    expect(screen.queryByTestId('fx-number')).not.toBeInTheDocument()
  })

  it('lo scudo mostra il numero BARRATO', () => {
    render(<SceneFx event={ev({ kind: 'block', amount: 31 })} frameKey={1} />)
    expect(screen.getByTestId('fx-number')).toHaveAttribute('data-blocked', 'true')
  })

  it('la cura mostra un numero positivo', () => {
    render(<SceneFx event={ev({ kind: 'heal', amount: 28 })} frameKey={1} />)
    expect(screen.getByTestId('fx-number')).toHaveTextContent('+28')
  })

  it('i Duo mostrano il loro nome', () => {
    render(<SceneFx event={ev({ kind: 'duo-miasma', word: 'MIASMA' })} frameKey={1} />)
    expect(screen.getByTestId('fx-word')).toHaveTextContent('MIASMA')
  })

  it('un frame senza scena non rende nulla', () => {
    const { container } = render(<SceneFx event={ev({ kind: 'none' })} frameKey={1} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/SceneFx.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

Il componente è una tabella `SceneKind` → cosa disegnare, presa dal mockup:

| Scena | Cosa disegna |
|---|---|
| `hit` | scia, onda d'urto, numero bianco |
| `crit` | lampo bianco, scia, onda grande, numero dorato `data-size="big"`, parola |
| `dodge` | scia lunga che prosegue, parola, **nessun numero** |
| `block` | cupola azzurra, numero `data-blocked="true"` |
| `pen` | scia viola, numero, parola `ARMATURA FORATA` |
| `heal` | numero verde col `+` |
| `kill` | lampo, onda, numero, parola `K.O.` |
| `revive` | parola `RIANIMATO`, numero verde |
| `skip` | parola `SALTA`, **nessun numero** |
| `dot` | numerino verde che sale |
| `regen` | numerino verde col `+` |
| `fatigue` | lampo, parola `SFINIMENTO` |
| `purify` | cupola verde, parola `PURIFICATO` |
| `recoil` | numero rosso sull'**attore**, non sul bersaglio |
| `duo-*` | nome del Duo esploso in oro + scia |
| `cooldown`, `relic`, `none` | nulla |

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/SceneFx.test.tsx`
Expected: PASS — 8 test.

- [ ] **Step 5: Verificare il ripiego senza movimento**

Con `prefers-reduced-motion`, numeri e parole devono restare **visibili e leggibili** (nessuna animazione che li porti a `opacity: 0`). Verificare con un test o un'ispezione manuale del CSS.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/SceneFx.tsx components/battle/battleAnim.css tests/battle/SceneFx.test.tsx
git commit -m "feat(battaglia): un effetto per ogni evento del motore"
```

---

## Task 5: Comporre l'arena

**Files:**
- Modify: `components/battle/BattleArena.tsx`
- Test: aggiornare `tests/ui/battle.test.tsx` e `tests/ui/battleLayout.test.tsx` dove cambia la struttura

**Interfaces:**
- Consumes: `sceneEventOf` (Task 1), `StatusPips` (Task 2), `SceneFx` (Task 4).

L'arena resta «campo contro campo» come oggi, e guadagna:
1. `StatusPips` su ogni unità, alimentate da `frame.statusEffects[u.key]`;
2. `SceneFx` come livello sopra, alimentato da `sceneEventOf(frame, prevFrame)`;
3. la classe d'animazione sull'unità giusta a seconda della scena (`strike` sull'attore, `kick`/`kickBig` sul bersaglio, `swerve` per la schivata, `shiver` per il turno saltato, `fall` per l'uccisione).

- [ ] **Step 1: Scrivere il test delle pillole**

```tsx
// in tests/ui/battle.test.tsx
it('mostra gli stati attivi sulle unità in battaglia', () => {
  // Le pillole erano sparite col rifacimento (UnitBust le aveva, WizardCard no):
  // dal frame dopo l'applicazione non si sapeva più che un mago era avvelenato.
  renderBattleScreenWithStatus({ kind: 'veleno', stacks: 3 })
  expect(screen.getAllByTestId('status-pip').length).toBeGreaterThanOrEqual(1)
})
```

- [ ] **Step 2: Run per verificare che fallisca**

Run: `npx vitest run tests/ui/battle.test.tsx`
Expected: FAIL — nessuna pillola nel DOM.

- [ ] **Step 3: Comporre**

Le unità restano `WizardCard density="combat"`; pillole ed effetti si sovrappongono nel wrapper che già porta `data-unit-key`.

- [ ] **Step 4: Run + suite di battaglia**

```bash
npx vitest run tests/ui tests/battle
```

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/BattleArena.tsx tests/
git commit -m "feat(battaglia): l'arena mostra stati ed effetti di ogni evento"
```

---

## Task 6: La schermata, con la corsia

**Files:**
- Modify: `components/screens/BattleScreen.tsx`
- Test: `tests/ui/battle.test.tsx`

Aggiunge `TurnLane` fra l'arena e il registro, e ridistribuisce l'altezza nel budget fisso di 768px.

Ripartizione dal mockup: intestazione 38 · arena 452 · corsia 128 · registro 92 · margini ≈ 58.

- [ ] **Step 1: Misurare il prima**

Con `npm run dev` attivo, a 1366×768: `document.documentElement.scrollHeight` e quante delle sei unità sono dentro il viewport. Annotare.

- [ ] **Step 2: Scrivere il test della corsia**

```tsx
it('la corsia dei turni è montata in battaglia', () => {
  renderBattleScreen()
  expect(screen.getAllByTestId('lane-slot').length).toBeGreaterThanOrEqual(4)
})
```

- [ ] **Step 3: Comporre la schermata**

- [ ] **Step 4: Verificare a schermo, non solo coi test**

Playwright è installato, il server gira su `http://localhost:3000`. Aprire una battaglia vera, avanzare **almeno dieci turni** e verificare che:
- `scrollHeight` resti **≤ 768** per tutta la riproduzione (il registro cresce: è il difetto che ha già morso una volta);
- tutte e sei le unità restino visibili;
- la corsia scorra e resti allineata.

**Guardare gli screenshot**, non solo i numeri.

- [ ] **Step 5: Suite completa + typecheck**

```bash
npx vitest run && npm run typecheck 2>&1 | grep -v '.next/dev'
```

- [ ] **Step 6: Commit**

```bash
git add components/screens/BattleScreen.tsx tests/
git commit -m "feat(battaglia): la corsia del tempo entra in scena"
```

---

## Task 7: La prova che niente resta invisibile

**Files:**
- Test: `tests/battle/sceneCoverage.test.ts`

È la guardia che fa rispettare il requisito dell'utente anche fra sei mesi: **ogni evento del motore deve avere una scena**.

- [ ] **Step 1: Scrivere il test di copertura**

```ts
// tests/battle/sceneCoverage.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sceneEventOf } from '@/lib/battleScene'
import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

/** Le azioni di sistema che il motore emette davvero, lette dal sorgente:
 *  se qualcuno ne aggiunge una senza darle una scena, questo test diventa rosso. */
function engineActions(): string[] {
  const src = readFileSync('game/engine/combat/simulate.ts', 'utf8')
  return [...new Set([...src.matchAll(/action: '([^']+)'/g)].map(m => m[1]!))]
}

const frame = (entry: LogEntry): ReplayFrame =>
  ({ index: 1, entry, hp: {}, cooldowns: {}, statusEffects: {} } as ReplayFrame)

describe('copertura: niente resta invisibile', () => {
  it('ogni azione di sistema del motore produce una scena', () => {
    const missing = engineActions().filter(action => {
      const e = sceneEventOf(frame({
        turn: 1, actorId: 'a', actorSide: 'left', action, type: 'system', flags: [],
      } as LogEntry))
      return e.kind === 'none'
    })
    expect(missing, `azioni senza scena: ${missing.join(', ')}`).toEqual([])
  })

  it('ogni flag di log produce una scena', () => {
    const FLAGS = ['crit','dodge','kill','heal','block','stun','dot','pen','shatter','recoil','revive']
    const missing = FLAGS.filter(f => sceneEventOf(frame({
      turn: 1, actorId: 'a', actorSide: 'left', action: 'Colpo', type: 'Attacco', flags: [f],
    } as unknown as LogEntry)).kind === 'none')
    expect(missing, `flag senza scena: ${missing.join(', ')}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/battle/sceneCoverage.test.ts`
Expected: PASS. Se fallisce, **aggiungere la scena mancante** in `lib/battleScene.ts` — mai indebolire il test: è esattamente ciò che il requisito dell'utente chiede di garantire.

- [ ] **Step 3: Commit**

```bash
git add tests/battle/sceneCoverage.test.ts
git commit -m "test(battaglia): guardia — ogni evento del motore ha una scena"
```

---

## Self-Review

**Copertura del requisito:**

| Richiesta dell'utente | Task |
|---|---|
| «la b mi piace molto» — layout corsia del tempo | 3, 6 |
| «con TUTTI gli attacchi» | 1 (flag), 4 (effetti) |
| «ANCHE CON I TURNI SALTATI» | 1 (`skip`), 4 (parola SALTA), 3 (bollino in corsia) |
| «TUTTO QUELLO CHE SUCCEDE» | 7 (guardia di copertura) |
| «SOPRATTUTTO GLI EFFETTI SPECIALI, tipo il veleno» | 2 (pillole con dosi), 4 (`dot`) |
| «una cosa premium ben strutturata» | separazione in quattro moduli testabili invece di un componente solo |

**Scan placeholder:** nessun TBD. I Task 3, 5 e 6 descrivono la composizione a parole invece di dare il codice completo, perché il riferimento visivo è il mockup pubblicato e ricopiarne 400 righe qui lo renderebbe una seconda fonte di verità che divergerebbe.

**Coerenza dei tipi:** `SceneEvent`/`SceneKind` definiti nel Task 1, consumati in 4, 5 e 7. `StatusPips` (2) e `TurnLane` (3) sono indipendenti fra loro e si incontrano solo in 5 e 6.

**Rischio noto:** il Task 6 rischia di far crescere di nuovo il documento oltre 768px, perché il registro si allunga a ogni turno — è già successo una volta in questo progetto. Per questo lo Step 4 impone di verificare su **almeno dieci turni**, non sul primo fotogramma.

**Fuori scope:** il motore, il bilanciamento, `buildReplay`, e le altre schermate. La riproduzione automatica della battaglia (il pulsante «Riproduci» del mockup) esiste già come `useBattleReplay`: non va riscritta.
