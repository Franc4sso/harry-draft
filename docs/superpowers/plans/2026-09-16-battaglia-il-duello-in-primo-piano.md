# Battaglia — il duello in primo piano — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rifare la scena di battaglia come il mockup approvato la disegna — i due duellanti grandi al centro, gli altri quattro in miniatura ai lati — perché è l'unico pezzo del design che non è mai stato implementato, ed è il motivo per cui la battaglia oggi è peggiore di prima.

**Architecture:** Si sostituisce solo la *disposizione*. `BattleArena` smette di stampare sei `WizardCard` in due file e diventa un palco: due presentazioni nuove (`Duellante`, `Miniatura`) e la logica già esistente che decide chi è attore e chi bersaglio. Tutto il resto del lavoro precedente — pillole, corsia, effetti, guardia di copertura — si riusa intatto.

**Spec:** `docs/superpowers/specs/2026-09-16-battaglia-il-duello-in-primo-piano-design.md`

**Mockup vincolante:** https://claude.ai/artifact/4CshXus1RM1hDnX8eFTfHN — v11.

## Global Constraints

- **Il mockup si riapre e si guarda.** Il piano precedente è fallito perché nessuno ha riletto il disegno durante l'implementazione: i brief descrivevano le parti e davano per scontata la scena, che era proprio ciò che il mockup cambiava. Ogni task che tocca la disposizione cita la misura presa dal mockup.
- **Misure vincolanti** (dal mockup, in px su una cornice 1366×768): barra `1366×38` a `0,0` · miniature `84×104`, nemiche a `x=18` e alleate a `x=1264`, entrambe a `y=62/174/286` · palco `1142×452` a `112,46` · ritratto attore `420×376` a `168,84` · ritratto bersaglio `420×376` a `778,84` · incantesimo al centro a `600,236` largo `166` · corsia `1142×128` a `112,520` · registro `1142×92` a `112,660`.
- **1366×768, niente tagli.** `main` è `max-h-[100dvh] overflow-hidden`: **`scrollHeight` a 768 NON è una prova**, l'eccesso viene nascosto. Va verificato che ogni unità abbia `top >= 0` e `bottom <= 768`.
- **Il ritratto non si rimpicciolisce** (D1).
- `prefers-reduced-motion`: restano gli stati finali, sparisce solo il movimento.
- **Nessun test silenziato.** I test che asserivano sulle sei carte-combat vanno riscritti sulla nuova scena con un commento che spiega perché.
- Non si tocca `game/engine/`, `data/`, il bilanciamento, né `WizardCard` (resta la carta di pesca/reclutamento).
- `npm run test` NON esegue il typecheck: `npm run typecheck 2>&1 | grep -v '.next/dev'` a parte.

## File Structure

| File | Responsabilità |
|---|---|
| `components/battle/Duellante.tsx` | **Creare.** Il ritratto grande 420×376: ritratto, nome, «AGISCE»/«SUBISCE», pillole, barra vita. |
| `components/battle/Miniatura.tsx` | **Creare.** Il riquadro 84×104: ritratto, barra vita 4px, nome troncato, pillole. |
| `components/battle/BattleArena.tsx` | **Riscrivere la resa.** Diventa il palco; la logica attore/bersaglio/salto/scena resta. |
| `components/screens/BattleScreen.tsx` | **Modificare.** Ridistribuire l'altezza sulle misure del mockup. |

---

## Task 1: Il duellante

**Files:**
- Create: `components/battle/Duellante.tsx`
- Test: `tests/battle/Duellante.test.tsx`

**Interfaces:**
- Consumes: `ReplayUnit` da `@/game/engine/combat/replay`; `ActiveEffect` da `@/types`; `StatusPips` da `@/components/battle/StatusPips`; `PortraitImage` da `@/components/ui/PortraitImage`.
- Produces:
  ```tsx
  export function Duellante({ unit, hp, maxHp, role, effects, dead, className, style }: {
    unit: ReplayUnit
    hp: number
    maxHp: number
    /** 'attore' = chi agisce, 'bersaglio' = chi subisce. Decide sottotitolo e colore del bordo. */
    role: 'attore' | 'bersaglio'
    effects: ActiveEffect[]
    dead?: boolean
    className?: string
    style?: React.CSSProperties
  }): JSX.Element
  ```

Dal mockup: bordo 2px (rosso `rgba(240,114,114,.45)` se nemico, oro `--gold` se bersaglio), nome in Cinzel 17px in basso su sfumatura, sottotitolo 9px, pillole in alto a sinistra, barra vita 6px in fondo. Il caduto resta in grigio, non sparisce.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/Duellante.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Duellante } from '@/components/battle/Duellante'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const u = (over: Partial<ReplayUnit> = {}): ReplayUnit =>
  ({ key: 'left:harry', id: 'harry', name: 'Harry Potter', side: 'left',
     house: 'Grifondoro', maxHp: 100, spd: 20, ...over } as ReplayUnit)

const fx = (kind: string): ActiveEffect =>
  ({ kind, statusId: kind, remaining: 2, stacks: 1 } as unknown as ActiveEffect)

describe('Duellante', () => {
  it('mostra il nome del mago', () => {
    render(<Duellante unit={u()} hp={80} maxHp={100} role="attore" effects={[]} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
  })

  it('dice se AGISCE o SUBISCE', () => {
    const { rerender } = render(<Duellante unit={u()} hp={80} maxHp={100} role="attore" effects={[]} />)
    expect(screen.getByTestId('duellante')).toHaveTextContent(/agisce/i)
    rerender(<Duellante unit={u()} hp={80} maxHp={100} role="bersaglio" effects={[]} />)
    expect(screen.getByTestId('duellante')).toHaveTextContent(/subisce/i)
  })

  it('la barra vita riflette gli HP', () => {
    render(<Duellante unit={u()} hp={25} maxHp={100} role="bersaglio" effects={[]} />)
    expect(screen.getByTestId('duellante-hp').style.width).toBe('25%')
  })

  it('mostra le pillole di stato', () => {
    render(<Duellante unit={u()} hp={80} maxHp={100} role="bersaglio" effects={[fx('veleno'), fx('stun')]} />)
    expect(screen.getAllByTestId('status-pip')).toHaveLength(2)
  })

  it('un caduto resta in scena, marcato', () => {
    render(<Duellante unit={u()} hp={0} maxHp={100} role="bersaglio" effects={[]} dead />)
    expect(screen.getByTestId('duellante')).toHaveAttribute('data-dead', 'true')
    expect(screen.getByTestId('duellante-hp').style.width).toBe('0%')
  })

  it('porta la chiave dell unità, che il livello effetti usa per misurare', () => {
    render(<Duellante unit={u()} hp={80} maxHp={100} role="attore" effects={[]} />)
    expect(screen.getByTestId('duellante')).toHaveAttribute('data-unit-key', 'left:harry')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/Duellante.test.tsx` — Expected: FAIL, modulo non risolto.

- [ ] **Step 3: Write the implementation**

Riaprire il mockup e copiare la resa di `.big` (bordo, `.nm`, `.sub`, `.hpline`). `PortraitImage` riempie il riquadro (`variant="poster"` se disponibile, altrimenti quella che rende meglio a 420×376 — guardare il risultato, non solo i test). `data-unit-key` sul nodo radice: `SceneFx` misura i box da lì.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/Duellante.test.tsx` — Expected: PASS, 6 test.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/Duellante.tsx tests/battle/Duellante.test.tsx
git commit -m "feat(battaglia): il duellante, il ritratto grande della scena"
```

---

## Task 2: La miniatura

**Files:**
- Create: `components/battle/Miniatura.tsx`
- Test: `tests/battle/Miniatura.test.tsx`

**Interfaces:**
- Consumes: `ReplayUnit`, `ActiveEffect`, `StatusPips`, `PortraitImage`.
- Produces:
  ```tsx
  export function Miniatura({ unit, hp, maxHp, effects, dimmed, dead, className, style }: {
    unit: ReplayUnit
    hp: number
    maxHp: number
    effects: ActiveEffect[]
    /** L'unità è in scena come duellante: il posto resta, smorzato. */
    dimmed?: boolean
    dead?: boolean
    className?: string
    style?: React.CSSProperties
  }): JSX.Element
  ```

Dal mockup (`.mini`): 84×104, bordo 1.5px del colore del lato, barra vita 4px, nome 8.5px troncato su fondo scuro, pillole in alto a sinistra. `dimmed` → `opacity .3` e `scale(.94)`. `dead` → grigio, `opacity .28`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/Miniatura.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Miniatura } from '@/components/battle/Miniatura'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const u = (over: Partial<ReplayUnit> = {}): ReplayUnit =>
  ({ key: 'right:draco', id: 'draco', name: 'Draco Malfoy', side: 'right',
     house: 'Serpeverde', maxHp: 90, spd: 18, ...over } as ReplayUnit)
const fx = (k: string): ActiveEffect => ({ kind: k, statusId: k, remaining: 2, stacks: 1 } as unknown as ActiveEffect)

describe('Miniatura', () => {
  it('mostra nome e vita, e nient altro di pesante', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[]} />)
    expect(screen.getByTestId('miniatura')).toHaveTextContent('Draco Malfoy')
    expect(screen.getByTestId('miniatura-hp').style.width).toBe('50%')
    // niente banda statistiche né riga incantesimo: è la ragione per cui esiste
    expect(screen.queryByTestId('stat-band')).toBeNull()
    expect(screen.queryByTestId('spell-line')).toBeNull()
  })

  it('mostra le pillole di stato anche in miniatura', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[fx('veleno')]} />)
    expect(screen.getAllByTestId('status-pip')).toHaveLength(1)
  })

  it('smorzata quando la sua unità è in scena come duellante', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[]} dimmed />)
    expect(screen.getByTestId('miniatura')).toHaveAttribute('data-dimmed', 'true')
  })

  it('un caduto resta al suo posto, marcato', () => {
    render(<Miniatura unit={u()} hp={0} maxHp={90} effects={[]} dead />)
    expect(screen.getByTestId('miniatura')).toHaveAttribute('data-dead', 'true')
  })

  it('porta la chiave dell unità', () => {
    render(<Miniatura unit={u()} hp={45} maxHp={90} effects={[]} />)
    expect(screen.getByTestId('miniatura')).toHaveAttribute('data-unit-key', 'right:draco')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/Miniatura.test.tsx` — Expected: FAIL, modulo non risolto.

- [ ] **Step 3: Write the implementation**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/Miniatura.test.tsx` — Expected: PASS, 5 test.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/Miniatura.tsx tests/battle/Miniatura.test.tsx
git commit -m "feat(battaglia): la miniatura, il comprimario di lato"
```

---

## Task 3: Il palco

**Files:**
- Modify: `components/battle/BattleArena.tsx`
- Test: aggiornare `tests/ui/battle.test.tsx` dove asserisce sulle sei carte-combat

**Interfaces:**
- Consumes: `Duellante` (Task 1), `Miniatura` (Task 2), più tutto ciò che l'arena già usa: `sceneEventOf`, `SceneFx`, `StatusPips`, `unitKey`, `lastRealEntryAt` (da `@/lib/initiative`).
- La firma pubblica di `BattleArena` **non cambia**: `BattleScreen` la chiama come oggi.

Cosa cambia: la resa. L'arena diventa il palco descritto dallo spec.

**Chi va grande:** attore = `entry.actorSide`/`actorId`, bersaglio = `entry.targetSide`/`targetId`. Sui frame **senza** attore o bersaglio (sistema, veleno, Duo) si tiene l'ultima azione vera via `lastRealEntryAt(replay, frameKey)` — già in `lib/initiative.ts`, stesso principio della corsia. La scena non si svuota mai.

**Chi va di lato:** tutte e sei le unità hanno sempre il loro posto in miniatura, ciascuna dalla propria parte, nell'ordine stabile di `replay.units`. Le due che sono in scena come duellanti hanno `dimmed` — il posto non scompare, così le file non ballano.

**`data-unit-key` sta sia sul duellante sia sulla miniatura.** `SceneFx` e il livello VFX lo usano per misurare: con la stessa chiave due volte nel DOM, la misura deve prendere **il duellante** quando c'è (è lì che l'effetto va disegnato). Usare un selettore che lo garantisca, ad esempio `[data-testid="duellante"][data-unit-key="..."]` prima del generico.

- [ ] **Step 1: Write the failing test**

```tsx
// in tests/ui/battle.test.tsx
it('la scena mette i due duellanti al centro e gli altri quattro di lato', () => {
  // 2026-09-16: la scena non è più sei carte uguali in due file. Il mockup approvato
  // mette in primo piano chi agisce e chi subisce, e relega gli altri a miniature
  // laterali — è il pezzo di design che il piano precedente non aveva implementato,
  // ed è la ragione per cui la fila del giocatore finiva tagliata sotto la piega.
  renderBattleScreen()
  expect(screen.getAllByTestId('duellante')).toHaveLength(2)
  expect(screen.getAllByTestId('miniatura')).toHaveLength(6)
})

it('sui frame di sistema la scena non si svuota', () => {
  // Un tick di veleno o un Duo non hanno attore/bersaglio propri: i duellanti
  // restano quelli dell'ultima azione vera, come fa la corsia.
  renderBattleScreenAtSystemFrame()
  expect(screen.getAllByTestId('duellante')).toHaveLength(2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battle.test.tsx` — Expected: FAIL, nessun `duellante` nel DOM.

- [ ] **Step 3: Write the implementation**

Riaprire il mockup e riprodurre il posizionamento assoluto del palco. Usare percentuali o un contenitore a proporzioni fisse, perché la cornice reale non è sempre esattamente 1366×768.

- [ ] **Step 4: Aggiornare i test che asserivano sulle carte-combat**

Cercare i test che contano `[data-unit-key]` aspettandosi sei carte `WizardCard`, o che asseriscono su `density="combat"`. Riscriverli sulla nuova scena **con un commento** che dice perché è cambiata. Non cancellarli.

- [ ] **Step 5: Run + suite**

```bash
npx vitest run tests/ui tests/battle
```

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/BattleArena.tsx tests/
git commit -m "feat(battaglia): il palco — duellanti al centro, comprimari ai lati"
```

---

## Task 4: L'altezza, e la prova che tutto si vede

**Files:**
- Modify: `components/screens/BattleScreen.tsx`
- Test: `tests/ui/battle.test.tsx`

Ridistribuire l'altezza sulle misure del mockup: intestazione 38 · palco 452 · corsia 128 · registro 92 · margini ≈ 58. Il totale (~768) torna perché due duellanti e quattro miniature occupano molto meno di sei carte piene.

Il round precedente aveva messo `overflow-hidden` + `justify-start` sul contenitore dell'arena come rete di sicurezza: **tenerlo**, è innocuo e protegge da crescite future.

- [ ] **Step 1: Misurare il prima**

Con `npm run dev` attivo, a 1366×768, su una battaglia vera: per ogni `[data-unit-key]` il `getBoundingClientRect()`. Annotare quanti sono fuori da `[0,768]`. È lo stato di partenza da battere.

- [ ] **Step 2: Ridistribuire l'altezza**

- [ ] **Step 3: Verificare a schermo — questo passo non è sostituibile dai test**

Playwright è installato, `npm run dev` serve su :3000. Su **almeno tre squadre diverse**, avanzando **oltre il turno 10** (i frame ci sono già tutti: si può saltare avanti con «Passo» invece di vincere la partita):

- ogni `[data-unit-key]` ha `top >= 0` **e** `bottom <= 768`;
- la corsia e il registro sono interi;
- **guardare gli screenshot.** In questo progetto una verifica passò tutte le misure mentre un ritratto non veniva disegnato affatto, e un'altra volta la fila nemica era tagliata mentre `scrollHeight` diceva 768.

- [ ] **Step 4: Suite completa + typecheck**

```bash
npx vitest run && npm run typecheck 2>&1 | grep -v '.next/dev'
```

- [ ] **Step 5: Commit**

```bash
git add components/screens/BattleScreen.tsx tests/
git commit -m "feat(battaglia): il budget dell'altezza torna sulle misure del mockup"
```

---

## Self-Review

**Copertura dello spec:**

| Requisito | Task |
|---|---|
| Duellanti grandi al centro | 1, 3 |
| Comprimari in miniatura ai lati | 2, 3 |
| Effetti nello spazio libero, non sopra le carte | 3 (il palco libera il centro) |
| La scena non si svuota sui frame di sistema | 3 |
| 1366×768 senza tagli, verificato guardando | 4 |
| Riuso di pillole/corsia/effetti/guardia | 1, 2, 3 (consumo, nessuna modifica) |

**Scan placeholder:** nessun TBD. I Task 3 e 4 descrivono la composizione a parole invece di dare il codice completo, perché la fonte visiva è il mockup pubblicato: ricopiarne la resa qui creerebbe una seconda verità che divergerebbe — ed è esattamente l'errore che ha fatto fallire il piano precedente, dove i brief testuali hanno sostituito il disegno.

**Coerenza dei tipi:** `Duellante` e `Miniatura` sono definiti nei Task 1 e 2 e consumati nel 3. La firma di `BattleArena` non cambia, quindi `BattleScreen` non si rompe.

**Rischio noto:** `data-unit-key` compare due volte per le unità in scena (duellante + miniatura smorzata). Se `SceneFx` o il livello VFX prendono la prima corrispondenza, l'effetto può finire sulla miniatura invece che sul duellante. Il Task 3 lo affronta esplicitamente; il Task 4 lo verifica guardando.

**Fuori scope:** il motore, i dati, il bilanciamento, `WizardCard`, e le altre schermate.
