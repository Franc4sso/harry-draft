# Lift & Focus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sui momenti chiave (uccisione/critico/primo scatto Duo) la scena stringe sulle due carte coinvolte: un overlay clona attaccante e bersaglio, li fa volare al centro (attaccante sinistra-ombra, bersaglio destra-grande-luce), mostra la riga-causa (perché quel bersaglio, da `reason`), poi torna alla vista squadra. Solo presentazione.

**Architecture:** Un componente overlay `LiftFocus` montato in `BattleArena` come sibling di `PixiArena`/`Callout` (assoluto, pointer-events-none, z alto). Al frame-chiave misura i rect DOM reali delle due carte (`data-unit-key` + `getBoundingClientRect`), monta due CLONI (riusando `UnitBust` compatto) sui rect, e li anima con GSAP one-shot verso le posizioni cinematografiche. Le UnitBust ORIGINALI restano nel flow ma oscurate (estensione del dimming esistente). Predicato momento-chiave puro (`liftMomentFor`). Pattern one-shot keyed su `frameKey` come `Callout`. Nessun cambio al motore/replay.

**Tech Stack:** React (Next.js), TypeScript, GSAP (già in uso per VFX), framer-motion (`useReducedMotion`), Tailwind, Vitest + Testing Library.

## Global Constraints

- **Solo presentazione**: NESSUN cambio a `game/engine/*`. Replay/anti-cheat intatti; l'overlay è additivo.
- **PERF (regola dura)**: event-driven, GSAP one-shot keyed su `frameKey`. NIENTE loop CSS continui (`animate-pulse` è collo di bottiglia noto). L'overlay non renderizza nulla fuori dai momenti chiave (monta/smonta col lift) → zero costo nei frame normali. grep di verifica in ogni task che aggiunge CSS.
- **Reduced-motion**: rispettato — con `useReducedMotion()`, niente volo (focus statico breve ~700ms, come Callout).
- **Robusto a pause/step/skip**: keyed su `frameKey` + `lastFiredRef` (fire once), timeout auto-clear INDIPENDENTE dal loop di playback (`useBattleReplay` può clearare il suo setTimeout su pausa/speed).
- **Memo-safe**: il dimming forte durante il lift si applica a livello `BattleArena` (una flag `lifting`), NON passando prop instabili alle singole UnitBust. `React.memo(UnitBust)` non va disturbato.
- **Copy in italiano.**
- `npm run test` NON esegue typecheck → `npm run typecheck` a parte.

---

### Task 1: `liftMomentFor` — predicato puro del momento chiave

Una funzione pura che, data un'entry + il set dei primi-scatti-Duo, ritorna il tipo di momento chiave o null.

**Files:**
- Create: `components/battle/liftMoment.ts`
- Test: `tests/ui/liftMoment.test.ts` (nuovo)

**Interfaces:**
- Consumes: `LogEntry` (types); `firstDuoFireFrames(frames): Map<string, number>` (`game/engine/combat/replay.ts:72`).
- Produces:
  - `type LiftMoment = { kind: 'kill' | 'crit' | 'duo'; duoName?: string }`
  - `liftMomentFor(entry: LogEntry | null, frameKey: number, firstDuo: Map<string, number>): LiftMoment | null`
  - Priorità: kill > crit > duo. Solo il PRIMO scatto di un Duo conta.

- [ ] **Step 1: Write the failing test**

Crea `tests/ui/liftMoment.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { liftMomentFor } from '@/components/battle/liftMoment'

const E = (flags: string[], extra: any = {}) =>
  ({ turn: 1, actorId: 'a', actorSide: 'left', targetId: 'b', targetSide: 'right', action: 'X', type: 'Attacco', flags, ...extra } as any)

describe('liftMomentFor', () => {
  const noDuo = new Map<string, number>()
  it('un colpo che uccide → kill', () => {
    expect(liftMomentFor(E(['kill']), 3, noDuo)).toEqual({ kind: 'kill' })
  })
  it('un crit → crit', () => {
    expect(liftMomentFor(E(['crit']), 3, noDuo)).toEqual({ kind: 'crit' })
  })
  it('kill batte crit (priorità)', () => {
    expect(liftMomentFor(E(['crit', 'kill']), 3, noDuo)).toEqual({ kind: 'kill' })
  })
  it('primo scatto di un Duo → duo con nome', () => {
    const first = new Map([['cancrena', 5]])
    expect(liftMomentFor(E(['duo'], { duoId: 'cancrena' }), 5, first)).toEqual({ kind: 'duo', duoName: expect.any(String) })
  })
  it('scatto Duo NON-primo → null', () => {
    const first = new Map([['cancrena', 5]])
    expect(liftMomentFor(E(['duo'], { duoId: 'cancrena' }), 9, first)).toBeNull()
  })
  it('un colpo normale → null', () => {
    expect(liftMomentFor(E([]), 3, noDuo)).toBeNull()
  })
  it('entry null → null', () => {
    expect(liftMomentFor(null, 3, noDuo)).toBeNull()
  })
})
```

(Per il `duoName`: risolvi dal `duoId` via `DUO_BY_ID` in `data/duos.ts` — verifica il nome esatto dell'export con `grep -n "DUO_BY_ID\|export.*DUOS" data/duos.ts`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/liftMoment.test.ts`
Expected: FAIL — `liftMomentFor` non esiste.

- [ ] **Step 3: Implementa `liftMoment.ts`**

```ts
import type { LogEntry } from '@/types'
import { DUO_BY_ID } from '@/data/duos'

export type LiftMoment = { kind: 'kill' | 'crit' | 'duo'; duoName?: string }

/** Il momento è "chiave" (merita il lift & focus) se è un'uccisione, un critico, o il PRIMO
 *  scatto di un Duo. Priorità kill > crit > duo (allineata a calloutFor). Puro. */
export function liftMomentFor(
  entry: LogEntry | null, frameKey: number, firstDuo: Map<string, number>,
): LiftMoment | null {
  if (!entry) return null
  if (entry.flags.includes('kill')) return { kind: 'kill' }
  if (entry.flags.includes('crit')) return { kind: 'crit' }
  if (entry.duoId && firstDuo.get(entry.duoId) === frameKey) {
    return { kind: 'duo', duoName: DUO_BY_ID[entry.duoId]?.name ?? entry.duoId }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/liftMoment.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: pulito.

- [ ] **Step 6: Commit**

```bash
git add components/battle/liftMoment.ts tests/ui/liftMoment.test.ts
git commit -m "feat(battle): liftMomentFor — predicato del momento chiave (kill/crit/duo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `LiftFocus` overlay — trigger + riga-causa (STATICO, no volo ancora)

L'overlay che, al frame-chiave, monta e mostra i due cloni + la riga-causa, con lo scheletro one-shot. Nessuna animazione di volo ancora — solo la comparsa/scomparsa e i contenuti.

**Files:**
- Create: `components/battle/LiftFocus.tsx`
- Modify: `components/battle/BattleArena.tsx` (monta `<LiftFocus .../>` come sibling di Callout; passa entry/frameKey/units/reason/firstDuo/speed)
- Test: `tests/ui/liftFocus.test.tsx` (nuovo)

**Interfaces:**
- Consumes: `liftMomentFor` (Task 1); `LogEntry`, `ReplayUnit`, `TargetReason`, `TARGET_REASON_LABEL` (types); `useReducedMotion`.
- Produces: `LiftFocus({ entry, frameKey, units, firstDuo, speed })`. Al frame-chiave monta `[data-testid="lift-focus"]` con i due cloni (per ora statici, posizionati al centro) + il nome-evento + la riga-causa (`data-testid="lift-cause"`) SOLO se `entry.reason`. Si auto-cleara con timeout (come Callout). Fuori dai momenti chiave: ritorna null (nessun DOM).

- [ ] **Step 1: Write the failing test**

Crea `tests/ui/liftFocus.test.tsx`. Riusa il factory di `ReplayUnit` dei test UnitBust/BattleArena (`grep -rln "ReplayUnit" tests/`).

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LiftFocus } from '@/components/battle/LiftFocus'
// riusa il factory units + un builder di entry

const units = [/* left:cho (Controllo), right:cedric (Attaccante) ... come ReplayUnit[] */]

describe('LiftFocus', () => {
  it('su un colpo che uccide con reason, monta l\'overlay + la riga-causa', () => {
    const entry = { turn: 1, actorId: 'cho', actorSide: 'left', targetId: 'cedric', targetSide: 'right',
      action: 'X', type: 'Attacco', flags: ['kill'], reason: 'weakest', value: 20 } as any
    const { container } = render(<LiftFocus entry={entry} frameKey={3} units={units} firstDuo={new Map()} speed={1} />)
    expect(container.querySelector('[data-testid="lift-focus"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="lift-cause"]')).toHaveTextContent(/più debole/i)
  })
  it('su un colpo che uccide SENZA reason, monta l\'overlay ma NESSUNA riga-causa', () => {
    const entry = { /* ... flags:['kill'], no reason */ } as any
    const { container } = render(<LiftFocus entry={entry} frameKey={3} units={units} firstDuo={new Map()} speed={1} />)
    expect(container.querySelector('[data-testid="lift-focus"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="lift-cause"]')).toBeNull()
  })
  it('su un frame normale (no kill/crit/duo), NON monta nulla', () => {
    const entry = { /* flags:[] */ } as any
    const { container } = render(<LiftFocus entry={entry} frameKey={3} units={units} firstDuo={new Map()} speed={1} />)
    expect(container.querySelector('[data-testid="lift-focus"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/liftFocus.test.tsx`
Expected: FAIL — `LiftFocus` non esiste.

- [ ] **Step 3: Implementa `LiftFocus.tsx` (statico)**

Segui il pattern one-shot di `Callout.tsx:56-73`. Struttura:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import { TARGET_REASON_LABEL } from '@/types'   // o dal path corretto di combat.ts
import { liftMomentFor } from './liftMoment'

export function LiftFocus({ entry, frameKey, units, firstDuo, speed }: {
  entry: LogEntry | null; frameKey: number; units: ReplayUnit[];
  firstDuo: Map<string, number>; speed: number
}) {
  const reduced = !!useReducedMotion()
  const lastFiredRef = useRef(0)
  const [active, setActive] = useState<{ moment; entry: LogEntry; key: number } | null>(null)

  useEffect(() => {
    if (frameKey === 0 || lastFiredRef.current === frameKey) return
    lastFiredRef.current = frameKey
    const moment = liftMomentFor(entry, frameKey, firstDuo)
    setActive(moment && entry ? { moment, entry, key: frameKey } : null)
  }, [frameKey, entry, firstDuo])

  useEffect(() => {
    if (!active) return
    const dur = reduced ? 700 : Math.max(900, 2200 / speed)
    const t = setTimeout(() => setActive(null), dur)
    return () => clearTimeout(t)
  }, [active, reduced, speed])

  if (!active) return null
  const { entry: e, moment } = active
  const attacker = units.find(u => u.key === `${e.actorSide}:${e.actorId}`)
  const target = units.find(u => u.key === `${e.targetSide}:${e.targetId}`)
  const cause = e.reason ? TARGET_REASON_LABEL[e.reason] : null

  return (
    <div data-testid="lift-focus" aria-hidden
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      {/* backdrop scuro */}
      <div className="absolute inset-0 bg-black/70" />
      {/* per ora: due cloni statici affiancati al centro (il volo arriva al Task 3) */}
      <div className="relative flex items-center gap-8">
        {/* clone attaccante (piccolo, in ombra) + clone bersaglio (grande, luce) — vedi Task 3 per UnitBust */}
        {/* nome-evento */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 font-display text-2xl uppercase text-[#f3e6c4]">
          {moment.kind === 'duo' ? moment.duoName : moment.kind === 'kill' ? 'Esecuzione' : 'Critico'}
        </div>
        {cause && (
          <div data-testid="lift-cause" className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#3a5680] bg-black/85 px-4 py-1.5 text-sm font-bold text-[#efe7d2]">
            💔 <span className="text-[#7dd3fc]">{cause}</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

(Per ora i cloni sono placeholder testuali/nomi; il rendering fedele coi cloni UnitBust è il Task 3. Verifica il path esatto di `TARGET_REASON_LABEL` — è in `types/combat.ts`, esportato via il barrel `@/types` se presente; controlla con `grep -rn "TARGET_REASON_LABEL" types/`.)

- [ ] **Step 4: Monta LiftFocus in BattleArena**

In `components/battle/BattleArena.tsx`, dopo `<Callout .../>` (`:169`):
```tsx
<LiftFocus entry={entry} frameKey={frameKey} units={units} firstDuo={firstFireAt} speed={speed} />
```
- BattleArena ha GIÀ in scope (verificato): `replay.units` (units), `firstFireAt` (= `firstDuoFireFrames(replay.frames)`, memoizzato a `:97` — passalo come `firstDuo`), `speed` (prop, `:30`). `TARGET_REASON_LABEL` si importa da `@/types` (barrel ri-esporta `./combat`). Quindi: `<LiftFocus entry={entry} frameKey={frameKey} units={replay.units} firstDuo={firstFireAt} speed={speed} />`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ui/liftFocus.test.tsx`
Expected: PASS.

- [ ] **Step 6: PERF + typecheck + non-regressione**

Run: `grep -n "animate-" components/battle/LiftFocus.tsx` → nessun loop CSS (in questa fase statica non ce n'è).
Run: `npm run typecheck` → pulito.
Run: `npx vitest run tests/ui/` → verdi.

- [ ] **Step 7: Commit**

```bash
git add components/battle/LiftFocus.tsx components/battle/BattleArena.tsx tests/ui/liftFocus.test.tsx
git commit -m "feat(battle): LiftFocus overlay — trigger momento-chiave + riga-causa (statico)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: I cloni fedeli + l'animazione FLIP (il volo)

Sostituisci i placeholder con cloni fedeli (riusa `UnitBust`), misura i rect reali, e anima i cloni dalla posizione originale a quella cinematografica con GSAP.

**Files:**
- Modify: `components/battle/LiftFocus.tsx` (cloni UnitBust + misura rect + GSAP FLIP)
- Test: `tests/ui/liftFocus.test.tsx` (estendi — i cloni rendono le due unità)

**Interfaces:**
- Consumes: `UnitBust` (per il clone fedele); `data-unit-key` sui bust originali (`UnitBust.tsx:219`); il pattern rect di `PixiArena.tsx:105-114`.
- Produces: l'overlay rende due `UnitBust` (attaccante + bersaglio) come cloni; al mount vengono posizionati sui rect DOM reali e animati (GSAP) verso sinistra-ombra / destra-grande-luce; reduced-motion → statici al centro senza volo.

- [ ] **Step 1: Write the failing test (i cloni rendono le unità)**

Estendi `liftFocus.test.tsx`:
```tsx
it('i cloni mostrano attaccante e bersaglio (per nome)', () => {
  // entry kill, units con cho+cedric
  const { getAllByText } = render(<LiftFocus .../>)
  // il clone dell'attaccante e del bersaglio rendono i nomi/ritratti
  expect(getAllByText(/Cho|Cedric/).length).toBeGreaterThanOrEqual(2)
})
```
(In jsdom non c'è layout reale → `getBoundingClientRect` ritorna 0. Il test verifica il RENDER dei cloni, non le posizioni animate. Assicurati che il componente non crashi quando i rect sono 0 — fallback a posizioni di default centrate.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/liftFocus.test.tsx`
Expected: FAIL — i cloni sono ancora placeholder testuali, non UnitBust coi nomi.

- [ ] **Step 3: Cloni UnitBust + misura rect + GSAP FLIP**

In `LiftFocus.tsx`:
- Sostituisci i placeholder con due `<UnitBust unit={attacker} hp={...} compact ... />` e `<UnitBust unit={target} hp={...} ... />`. (Per l'hp del clone: leggilo dal frame? In alternativa passa gli hp correnti — verifica cosa serve; il clone è visivo, un hp ragionevole basta. Se serve l'hp preciso, BattleArena ha `hp` per-frame — valuta se passarlo. NON complicare: il clone mostra la carta, l'HP esatto è secondario.)
- **Misura i rect** (in un `useLayoutEffect`, dopo il mount): `document.querySelector('[data-unit-key="..."]')` per attaccante e bersaglio → `getBoundingClientRect()` relativo al box dell'overlay/arena. Pattern esatto in `PixiArena.tsx:105-114`.
- **GSAP FLIP one-shot**: posiziona i cloni sui rect misurati (`gsap.set`), poi `gsap.to` verso le posizioni cinematografiche (attaccante: sinistra ~28%, scale ~1.1, brightness bassa; bersaglio: destra ~70%, scale ~1.4, luce). Registra la timeline e killala su unmount/onComplete (pattern `PixiArena.tsx:120-125`). Durata scalata con `speed`.
- **Reduced-motion**: se `reduced`, salta il volo — mostra i due cloni statici alle posizioni finali (nessun `gsap.to`).
- **Fallback rect-0** (jsdom/test): se i rect sono 0/nulli, posiziona i cloni alle posizioni finali di default (niente crash).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/liftFocus.test.tsx`
Expected: PASS.

- [ ] **Step 5: PERF + typecheck + non-regressione**

Run: `grep -n "animate-" components/battle/LiftFocus.tsx` → nessun loop CSS infinito (il volo è GSAP one-shot).
Run: `npm run typecheck` → pulito.
Run: `npx vitest run tests/ui/` → verdi. Se un test di BattleArena verifica il conteggio dei bust e i cloni lo alterano, aggiorna con `data-testid` mirati (i cloni sono nell'overlay, i test dovrebbero contare i bust nelle righe `row-player`/`row-enemies`, non l'overlay).

- [ ] **Step 6: Commit**

```bash
git add components/battle/LiftFocus.tsx tests/ui/liftFocus.test.tsx
git commit -m "feat(battle): lift & focus — cloni fedeli + volo GSAP dai rect reali

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Dimming forte delle originali durante il lift

Durante un lift, TUTTE le carte originali si oscurano (non solo i non-coinvolti), così l'overlay è l'unica cosa a fuoco.

**Files:**
- Modify: `components/battle/BattleArena.tsx` (flag `lifting` + dimming forte durante il lift)
- Test: `tests/ui/liftDimming.test.tsx` (nuovo) o estendi liftFocus

**Interfaces:**
- Consumes: lo stesso predicato `liftMomentFor` (per sapere se il frame corrente è un lift).
- Produces: durante un frame-lift, i wrapper delle UnitBust originali hanno un'opacity bassa (es. 0.15) — memo-safe (applicato a livello del wrapper in BattleArena, non come prop instabile a UnitBust).

- [ ] **Step 1: Write the failing test**

`tests/ui/liftDimming.test.tsx`: renderizza BattleArena a un frame-lift (kill) e verifica che i wrapper dei bust abbiano l'opacity di lift-dimming; a un frame normale, l'opacity è quella standard (1 o 0.45 per i non-coinvolti). Riusa il builder di replay di un test BattleArena esistente. (Se testare BattleArena end-to-end è pesante, testa la funzione/derivazione dell'opacity isolata.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/liftDimming.test.tsx`
Expected: FAIL — durante un lift le originali non sono ancora oscurate forte.

- [ ] **Step 3: Aggiungi il flag `lifting` + dimming in BattleArena**

In `BattleArena.tsx`, deriva se il frame corrente è un lift (riusa `firstFireAt`, già memoizzato a `:97`):
```tsx
const lifting = !!liftMomentFor(entry, frameKey, firstFireAt)
```
(Nota: `import { TARGET_REASON_LABEL } from '@/types'` in LiftFocus; `liftMomentFor` da `./liftMoment`.)
Nel wrapper di ogni bust (`renderSide`, `:115`), estendi l'opacity:
```tsx
style={{ opacity: lifting ? 0.15 : anyAction && !involved ? 0.45 : 1 }}
```
(La transizione CSS `transition-opacity duration-200` già presente rende morbido il passaggio. Il dimming forte + il backdrop dell'overlay isolano la coppia.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/liftDimming.test.tsx`
Expected: PASS.

- [ ] **Step 5: PERF + typecheck + non-regressione**

Run: `npm run typecheck` → pulito.
Run: `npx vitest run tests/ui/` → verdi.

- [ ] **Step 6: Commit**

```bash
git add components/battle/BattleArena.tsx tests/ui/liftDimming.test.tsx
git commit -m "feat(battle): dimming forte delle carte durante il lift (l'overlay è il fuoco)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verifica a schermo + coordinamento Callout + suite piena

Guida una battaglia fino a un'uccisione, cattura l'animazione, verifica coordinamento con Callout e reduced-motion. Ritocca se serve.

**Files:**
- Nessuna modifica di produzione attesa (solo ritocchi se lo screenshot rivela problemi: collisione Callout, timing, posizioni).

- [ ] **Step 1: Suite piena + typecheck**

Run: `npm run typecheck && npm run test`
Expected: tutto verde. Nota: la suite piena è lenta (~4-8min) — se timeout, gira in background e attendi. Se `tests/screens/CollectionScreen.test.tsx` va in timeout (env-slow, pre-esistente col fix a 20s), non è correlato.

- [ ] **Step 2: Screenshot/registrazione dell'animazione**

Con `npm run dev` attivo, guida Playwright fino a una battaglia e avanza il replay fino a un frame `kill`. (Riusa il pattern degli screenshot harness. Per trovare un'uccisione: avanza il replay a velocità e cattura più frame attorno a un KO, oppure monta una route di preview temporanea che renderizza `<LiftFocus>` con un entry kill+reason — come fatto per gli stati.) Ispeziona:
- Le due carte volano al centro (attaccante sinistra-ombra, bersaglio destra-grande-luce).
- La riga-causa appare ("il più debole"/"provocato"/...).
- Le altre carte sono oscurate.
- Il Callout (parola grande) coordina, non collide col lift.
- Tutto torna alla vista squadra dopo.

- [ ] **Step 3: Coordinamento Callout + ritocchi**

Se lo screenshot mostra che il Callout (parola) e il lift collidono/si sovrappongono male, decidi: (a) il lift sopprime il Callout per quel frame (passa una flag), oppure (b) riposiziona il Callout sopra la scena a fuoco. Applica il fix minimo. Se le posizioni/scale dei cloni o il timing non convincono, ritocca in LiftFocus. Rimuovi eventuale route di preview temporanea.

- [ ] **Step 4: Commit finale (se ci sono stati ritocchi)**

```bash
git add -A
git commit -m "polish(battle): rifiniture lift & focus dopo verifica a schermo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (spec: `docs/superpowers/specs/2026-07-13-lift-focus-design.md`):
- Predicato momento-chiave (kill/crit/primo-Duo, priorità) → Task 1. ✅
- Overlay che monta al frame-chiave + riga-causa solo se reason → Task 2. ✅
- Cloni fedeli (riuso UnitBust) + FLIP dai rect reali + reduced-motion → Task 3. ✅
- Dimming forte delle originali durante il lift, memo-safe → Task 4. ✅
- Coordinamento Callout + verifica a schermo → Task 5. ✅
- PERF (one-shot, no loop, zero costo fuori dai momenti) → grep in Task 2/3 + architettura (monta/smonta). ✅
- Reduced-motion, robusto a pause/skip (keyed frameKey + lastFiredRef) → Task 2/3. ✅
- Solo presentazione (no engine) → nessun task tocca game/engine. ✅

**Placeholder scan:** i punti "verifica il path esatto di TARGET_REASON_LABEL / cosa BattleArena ha in scope" sono controlli di allineamento al codice reale (con grep esatti); il codice di produzione è mostrato. I "adatta al factory/builder di test esistente" riusano fixture reali. Il fallback rect-0 per jsdom è esplicito (niente crash nei test).

**Type consistency:** `LiftMoment`/`liftMomentFor` (Task 1) usati in LiftFocus (Task 2) e nel dimming (Task 4). `LiftFocus` props (entry/frameKey/units/firstDuo/speed) coerenti tra il componente (Task 2) e il montaggio in BattleArena. `data-testid` (`lift-focus`, `lift-cause`) ancore coerenti tra task e test.

**Ordine:** Task 1 (predicato puro) → Task 2 (overlay statico) → Task 3 (volo) → Task 4 (dimming) → Task 5 (verifica). Ogni task verde a sé; il volo (3) e il dimming (4) sono additivi sopra l'overlay del Task 2. Rischio più alto nel Task 3 (FLIP/GSAP/rect) — isolato e testato col fallback rect-0; la verifica a schermo (Task 5) è la rete finale sul risultato visivo.
