# Tutorial guidato (prima run con coach-marks) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un tutorial opt-in dal menu che avvia una run reale con coach-marks su 4 tappe (Draft → Ruoli → Auto-battle → Duo), più un nudge una-tantum, senza dipendenze dal DB.

**Architecture:** Overlay React puro montato sopra il gioco esistente quando `?tutorial=1`. Le tappe si ancorano a fasi/eventi del gioco (robusto). L'ingresso di draft è curato (`tutorialStarterOffer`) per garantire una coppia-Duo. Persistenza del nudge in `localStorage` via `MetaProfile`.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Vitest + @testing-library/react, framer-motion (già in uso), Tailwind v4.

## Global Constraints

- **NO camera shake** in nessuna animazione dell'overlay (regola di progetto).
- **L'overlay è pura UI:** non deve alterare il motore, l'RNG, o la parità del replay. Una run in tutorial mode con la stessa offerta iniziale deve produrre lo stesso stato di una normale.
- **Nessun uso del DB Netlify / Blobs.** Solo `localStorage` via `lib/metaStore.ts`.
- **Determinismo:** niente `Math.random()`/`Date.now()` in codice che entra nel motore o negli snapshot.
- Copy in **italiano**, coerente col resto della UI.
- Seguire i pattern esistenti dei componenti (`components/ui/*`, `data-testid` sugli elementi interattivi).

---

### Task 1: Flag `tutorialNudgeSeen` nel profilo

**Files:**
- Modify: `lib/metaStore.ts`
- Test: `tests/lib/tutorialNudge.test.ts`

**Interfaces:**
- Produces: `MetaProfile.tutorialNudgeSeen?: boolean` (default `false`); `markTutorialNudgeSeen(p: MetaProfile): MetaProfile` (pure, returns a new profile with the flag `true`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/tutorialNudge.test.ts
import { describe, it, expect } from 'vitest'
import { defaultProfile, markTutorialNudgeSeen, saveProfile, loadProfile, PROFILE_KEY } from '@/lib/metaStore'

describe('tutorialNudgeSeen', () => {
  it('defaults to false on a fresh profile', () => {
    expect(defaultProfile().tutorialNudgeSeen ?? false).toBe(false)
  })
  it('markTutorialNudgeSeen sets it true without mutating the input', () => {
    const p = defaultProfile()
    const next = markTutorialNudgeSeen(p)
    expect(next.tutorialNudgeSeen).toBe(true)
    expect(p.tutorialNudgeSeen ?? false).toBe(false) // pure
  })
  it('persists through save/load (localStorage round-trip)', () => {
    localStorage.removeItem(PROFILE_KEY)
    saveProfile(markTutorialNudgeSeen(defaultProfile()))
    expect(loadProfile().tutorialNudgeSeen).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/tutorialNudge.test.ts`
Expected: FAIL — `markTutorialNudgeSeen` is not exported.

- [ ] **Step 3: Implement**

In `lib/metaStore.ts`, add `tutorialNudgeSeen?: boolean` to the `MetaProfile` interface (after `codex: MetaCodex`). `defaultProfile()` leaves it absent (falsy). `loadProfile`'s merge already spreads `...parsed` onto the default, so a persisted `true` survives — no change needed there. Add the pure helper:

```ts
export function markTutorialNudgeSeen(p: MetaProfile): MetaProfile {
  return { ...p, tutorialNudgeSeen: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/tutorialNudge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/metaStore.ts tests/lib/tutorialNudge.test.ts
git commit -m "feat(tutorial): flag tutorialNudgeSeen nel profilo (localStorage)"
```

---

### Task 2: `tutorialStarterOffer()` — ingresso curato che garantisce un Duo

**Files:**
- Create: `game/engine/tutorialOffer.ts`
- Test: `tests/engine/tutorialOffer.test.ts`

**Interfaces:**
- Consumes: `starterOffer(seed, house)` and `DraftedWizard` from the engine; `detectDuos(team, relics)` from `@/game/engine/duos`; wizard data from `@/data/wizards`.
- Produces:
  - `TUTORIAL_SEED: string` — the fixed seed the tutorial run uses.
  - `TUTORIAL_DUO_ID: string` — the Duo the curated trio forms.
  - `tutorialStarterOffer(house: string): DraftedWizard[]` — a starter offer whose first three entries (`slice(0,3)`) form `TUTORIAL_DUO_ID` via `detectDuos`.
  - `tutorialGuidedPickIds: string[]` — the 3 wizard ids the draft coach-mark highlights (the Duo-forming trio), in offer order.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/tutorialOffer.test.ts
import { describe, it, expect } from 'vitest'
import { detectDuos } from '@/game/engine/duos'
import { tutorialStarterOffer, tutorialGuidedPickIds, TUTORIAL_DUO_ID } from '@/game/engine/tutorialOffer'

describe('tutorialStarterOffer', () => {
  it('offers at least 3 wizards', () => {
    expect(tutorialStarterOffer('Grifondoro').length).toBeGreaterThanOrEqual(3)
  })
  it('the guided trio forms the target Duo (no relics)', () => {
    const offer = tutorialStarterOffer('Grifondoro')
    const trio = tutorialGuidedPickIds.map(id => offer.find(d => d.wizard.id === id)!)
    expect(trio.every(Boolean)).toBe(true)
    const active = detectDuos(trio, []).map(a => a.duo.id)
    expect(active).toContain(TUTORIAL_DUO_ID)
  })
  it('is deterministic (same offer twice)', () => {
    const a = tutorialStarterOffer('Grifondoro').map(d => d.wizard.id)
    const b = tutorialStarterOffer('Grifondoro').map(d => d.wizard.id)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/tutorialOffer.test.ts`
Expected: FAIL — module `@/game/engine/tutorialOffer` not found.

- [ ] **Step 3: Implement**

First, in a scratch REPL or by reading `data/wizards.ts` + `game/engine/duos.ts`, pick a concrete Duo and a 3-wizard trio that activates it with NO relics. Recall the activation rules (`game/engine/duos.ts` `signalActive`): `taunt` = 1 Tank; role signals (`supporto`/`controllo`) = 2 of that role; tag signals (`veleno`/`esecuzione`/`scudirigen`/`magieOscure`) = 2 wizards carrying that tag. The cheapest Duo from a 3-pick trio is one pairing a **role signal (1–2 wizards)** with a **tag signal (2 tagged wizards)** where wizards overlap — e.g. `muro-vivente` (`scudirigen` + `taunt`): a Tank that also carries the `scudirigen` tag + one more `scudirigen` wizard lights both signals with 2 wizards. Verify the chosen ids against `data/wizards.ts` (`wizard.role`, `wizard.tags`).

Build `tutorialStarterOffer` on top of the real `starterOffer` so the offer is genuine, but guarantee the trio is present:

```ts
import type { DraftedWizard } from '@/types'
import { starterOffer } from '@/game/engine/runEngine'

// Fixed, deterministic tutorial run seed.
export const TUTORIAL_SEED = 'tutorial'

// Chosen so the guided trio activates it with no relics — VERIFY against data/wizards.ts.
export const TUTORIAL_DUO_ID = '<duo-id>'            // e.g. 'muro-vivente'
export const tutorialGuidedPickIds: string[] = ['<w1>', '<w2>', '<w3>'] // the Duo trio, verified

/** The real starter offer for TUTORIAL_SEED, re-ordered so the guided Duo trio occupies the
 *  first three slots. If any guided wizard isn't in the seed's natural offer, it is injected
 *  (as a real DraftedWizard from starterOffer of a seed that contains it), so the tutorial
 *  never depends on the seed's emergent roll. */
export function tutorialStarterOffer(house: string): DraftedWizard[] {
  const base = starterOffer(TUTORIAL_SEED, house)
  const byId = new Map(base.map(d => [d.wizard.id, d]))
  // Ensure every guided id is present as a real DraftedWizard.
  for (const id of tutorialGuidedPickIds) {
    if (!byId.has(id)) {
      const found = findDraftedById(id, house) // helper below
      if (found) byId.set(id, found)
    }
  }
  const trio = tutorialGuidedPickIds.map(id => byId.get(id)!).filter(Boolean)
  const rest = base.filter(d => !tutorialGuidedPickIds.includes(d.wizard.id))
  return [...trio, ...rest]
}

// Deterministically resolve a specific wizard id to a DraftedWizard by scanning a fixed set
// of seeds' starter offers. Pure (no rng/time): iterates fixed seed strings in order.
function findDraftedById(id: string, house: string): DraftedWizard | undefined {
  for (let i = 0; i < 50; i++) {
    const hit = starterOffer(`tutorial-${i}`, house).find(d => d.wizard.id === id)
    if (hit) return hit
  }
  return undefined
}
```

Replace `<duo-id>` / `<w1..3>` with the verified concrete values. If `findDraftedById` can't reliably reach a needed wizard, instead build the `DraftedWizard` directly from `data/wizards.ts` using the same construction `starterOffer` uses (read `runEngine.ts` for the exact `DraftedWizard` shape — stats rolled at the offer's midpoint or via the seed). The invariant that MUST hold is the Task-2 test: the trio forms `TUTORIAL_DUO_ID`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/tutorialOffer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/tutorialOffer.ts tests/engine/tutorialOffer.test.ts
git commit -m "feat(tutorial): tutorialStarterOffer — ingresso curato che garantisce un Duo"
```

---

### Task 3: Modello e dati delle 4 tappe

**Files:**
- Create: `components/tutorial/steps.ts`
- Test: `tests/tutorial/steps.test.ts`

**Interfaces:**
- Produces:
  - `type TutorialStepId = 'draft' | 'ruoli' | 'autobattle' | 'duo'`
  - `interface TutorialCtx { phase: 'draft' | 'battle' | 'other'; hasActiveDuo: boolean }`
  - `interface TutorialStep { id: TutorialStepId; anchor: string; title: string; body: string; placement: 'top'|'bottom'|'left'|'right'; when: (c: TutorialCtx) => boolean }`
  - `TUTORIAL_STEPS: TutorialStep[]` (length 4, order draft→ruoli→autobattle→duo)

- [ ] **Step 1: Write the failing test**

```ts
// tests/tutorial/steps.test.ts
import { describe, it, expect } from 'vitest'
import { TUTORIAL_STEPS } from '@/components/tutorial/steps'

describe('TUTORIAL_STEPS', () => {
  it('has the 4 steps in order', () => {
    expect(TUTORIAL_STEPS.map(s => s.id)).toEqual(['draft', 'ruoli', 'autobattle', 'duo'])
  })
  it('draft & ruoli gate on the draft phase; autobattle on battle; duo on an active duo', () => {
    const byId = Object.fromEntries(TUTORIAL_STEPS.map(s => [s.id, s]))
    expect(byId.draft.when({ phase: 'draft', hasActiveDuo: false })).toBe(true)
    expect(byId.ruoli.when({ phase: 'draft', hasActiveDuo: false })).toBe(true)
    expect(byId.autobattle.when({ phase: 'battle', hasActiveDuo: false })).toBe(true)
    expect(byId.autobattle.when({ phase: 'draft', hasActiveDuo: false })).toBe(false)
    expect(byId.duo.when({ phase: 'battle', hasActiveDuo: true })).toBe(true)
    expect(byId.duo.when({ phase: 'draft', hasActiveDuo: false })).toBe(false)
  })
  it('every step has a non-empty anchor, title and body', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.anchor.length).toBeGreaterThan(0)
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.body.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tutorial/steps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// components/tutorial/steps.ts
export type TutorialStepId = 'draft' | 'ruoli' | 'autobattle' | 'duo'

export interface TutorialCtx {
  phase: 'draft' | 'battle' | 'other'
  hasActiveDuo: boolean
}

export interface TutorialStep {
  id: TutorialStepId
  anchor: string // data-testid of the element to highlight
  title: string
  body: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  when: (c: TutorialCtx) => boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'draft', anchor: 'draft-pick-0', placement: 'right',
    title: 'Pesca la tua squadra',
    body: 'Scegli 3 maghi: sono la squadra con cui affronterai tutta la run.',
    when: (c) => c.phase === 'draft',
  },
  {
    id: 'ruoli', anchor: 'draft-pick-0', placement: 'right',
    title: 'I ruoli si contrano',
    body: 'Ogni mago ha un ruolo. Tank → Attaccante → Supporto → Controllo → Tank: ognuno è forte contro il successivo.',
    when: (c) => c.phase === 'draft',
  },
  {
    id: 'autobattle', anchor: 'battle-arena', placement: 'top',
    title: 'Prepari, poi guardi',
    body: 'Non controlli i colpi: la squadra combatte da sola in base a come l’hai formata. Il tuo lavoro è la preparazione.',
    when: (c) => c.phase === 'battle',
  },
  {
    id: 'duo', anchor: 'duo-panel', placement: 'left',
    title: 'Hai formato un Duo!',
    body: 'Due maghi compatibili accendono una combo automatica. Guardala nel pannello: si scatenerà in battaglia.',
    when: (c) => c.hasActiveDuo,
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tutorial/steps.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/tutorial/steps.ts tests/tutorial/steps.test.ts
git commit -m "feat(tutorial): modello e dati delle 4 tappe coach-mark"
```

---

### Task 4: `TutorialProvider` — stato e derivazione della tappa visibile

**Files:**
- Create: `components/tutorial/TutorialProvider.tsx`
- Test: `tests/tutorial/TutorialProvider.test.tsx`

**Interfaces:**
- Consumes: `TUTORIAL_STEPS`, `TutorialCtx`, `TutorialStep` from Task 3.
- Produces:
  - `interface TutorialControls { active: boolean; visibleStep: TutorialStep | null; advance(): void; skip(): void }`
  - `useTutorial(): TutorialControls` (throws if outside provider)
  - `<TutorialProvider active={boolean} ctx={TutorialCtx}>{children}</TutorialProvider>`
  - Derivation rule: keep a linear `stepIndex` (starts 0). `visibleStep = active && stepIndex < TUTORIAL_STEPS.length && TUTORIAL_STEPS[stepIndex].when(ctx) ? TUTORIAL_STEPS[stepIndex] : null` (a step waits, showing nothing, until its phase gate holds). `advance()` → `stepIndex++`. `skip()` → sets an internal `skipped` true so `active` reads false regardless of the prop.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/tutorial/TutorialProvider.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TutorialProvider, useTutorial } from '@/components/tutorial/TutorialProvider'
import type { TutorialCtx } from '@/components/tutorial/steps'

function Probe() {
  const { visibleStep, advance, skip, active } = useTutorial()
  return (
    <div>
      <span data-testid="active">{String(active)}</span>
      <span data-testid="step">{visibleStep?.id ?? 'none'}</span>
      <button onClick={advance}>adv</button>
      <button onClick={skip}>skip</button>
    </div>
  )
}
const ctx = (o: Partial<TutorialCtx> = {}): TutorialCtx => ({ phase: 'draft', hasActiveDuo: false, ...o })

describe('TutorialProvider', () => {
  it('shows the draft step first, advances to ruoli in the draft phase', () => {
    render(<TutorialProvider active ctx={ctx()}><Probe /></TutorialProvider>)
    expect(screen.getByTestId('step').textContent).toBe('draft')
    fireEvent.click(screen.getByText('adv'))
    expect(screen.getByTestId('step').textContent).toBe('ruoli')
  })
  it('a step waits (null) until its phase gate holds', () => {
    const { rerender } = render(<TutorialProvider active ctx={ctx()}><Probe /></TutorialProvider>)
    fireEvent.click(screen.getByText('adv')) // -> ruoli
    fireEvent.click(screen.getByText('adv')) // -> autobattle, but phase is draft
    expect(screen.getByTestId('step').textContent).toBe('none')
    rerender(<TutorialProvider active ctx={ctx({ phase: 'battle' })}><Probe /></TutorialProvider>)
    expect(screen.getByTestId('step').textContent).toBe('autobattle')
  })
  it('skip() turns active off and hides the step', () => {
    render(<TutorialProvider active ctx={ctx()}><Probe /></TutorialProvider>)
    fireEvent.click(screen.getByText('skip'))
    expect(screen.getByTestId('active').textContent).toBe('false')
    expect(screen.getByTestId('step').textContent).toBe('none')
  })
  it('inactive provider never shows a step', () => {
    render(<TutorialProvider active={false} ctx={ctx()}><Probe /></TutorialProvider>)
    expect(screen.getByTestId('step').textContent).toBe('none')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tutorial/TutorialProvider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/tutorial/TutorialProvider.tsx
'use client'
import { createContext, useContext, useState, useMemo } from 'react'
import { TUTORIAL_STEPS, type TutorialCtx, type TutorialStep } from './steps'

export interface TutorialControls {
  active: boolean
  visibleStep: TutorialStep | null
  advance: () => void
  skip: () => void
}

const Ctx = createContext<TutorialControls | null>(null)

export function useTutorial(): TutorialControls {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTutorial must be used within <TutorialProvider>')
  return c
}

export function TutorialProvider(
  { active, ctx, children }: { active: boolean; ctx: TutorialCtx; children: React.ReactNode },
) {
  const [stepIndex, setStepIndex] = useState(0)
  const [skipped, setSkipped] = useState(false)
  const isActive = active && !skipped

  const value = useMemo<TutorialControls>(() => {
    const step = TUTORIAL_STEPS[stepIndex]
    const visibleStep = isActive && step && step.when(ctx) ? step : null
    return {
      active: isActive,
      visibleStep,
      advance: () => setStepIndex(i => Math.min(i + 1, TUTORIAL_STEPS.length)),
      skip: () => setSkipped(true),
    }
  }, [isActive, stepIndex, ctx])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tutorial/TutorialProvider.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/tutorial/TutorialProvider.tsx tests/tutorial/TutorialProvider.test.tsx
git commit -m "feat(tutorial): TutorialProvider — stato tappe + derivazione visibile"
```

---

### Task 5: `TutorialOverlay` — la coach-mark a schermo

**Files:**
- Create: `components/tutorial/TutorialOverlay.tsx`
- Test: `tests/tutorial/TutorialOverlay.test.tsx`

**Interfaces:**
- Consumes: `useTutorial()` (Task 4). Renders nothing when `visibleStep` is null.
- Produces: `<TutorialOverlay />` — a fixed-position coach-mark card: title, body, "Avanti" (calls `advance`), "Salta tutorial" (calls `skip`). It positions itself near the element with `data-testid={visibleStep.anchor}` if present (via `getBoundingClientRect`); if the anchor isn't in the DOM, it falls back to a centered card. It also renders a highlight ring around the anchor. NO camera shake / screen-jump animations (fade only).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/tutorial/TutorialOverlay.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TutorialProvider } from '@/components/tutorial/TutorialProvider'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import type { TutorialCtx } from '@/components/tutorial/steps'

const ctx = (o: Partial<TutorialCtx> = {}): TutorialCtx => ({ phase: 'draft', hasActiveDuo: false, ...o })

function mount(active: boolean, c = ctx()) {
  return render(
    <TutorialProvider active={active} ctx={c}>
      <div data-testid="draft-pick-0">card</div>
      <TutorialOverlay />
    </TutorialProvider>,
  )
}

describe('TutorialOverlay', () => {
  it('renders the current step title & body when active', () => {
    mount(true)
    expect(screen.getByText('Pesca la tua squadra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avanti/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salta/i })).toBeInTheDocument()
  })
  it('Avanti advances to the next step', () => {
    mount(true)
    fireEvent.click(screen.getByRole('button', { name: /Avanti/i }))
    expect(screen.getByText('I ruoli si contrano')).toBeInTheDocument()
  })
  it('Salta hides the overlay entirely', () => {
    mount(true)
    fireEvent.click(screen.getByRole('button', { name: /Salta/i }))
    expect(screen.queryByText('Pesca la tua squadra')).toBeNull()
  })
  it('renders nothing when inactive', () => {
    mount(false)
    expect(screen.queryByText('Pesca la tua squadra')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tutorial/TutorialOverlay.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/tutorial/TutorialOverlay.tsx
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTutorial } from './TutorialProvider'

export function TutorialOverlay() {
  const { visibleStep, advance, skip } = useTutorial()
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!visibleStep) { setRect(null); return }
    const el = document.querySelector<HTMLElement>(`[data-testid="${visibleStep.anchor}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [visibleStep])

  if (!visibleStep) return null

  // Position the card near the anchor; fall back to centered.
  const cardStyle: React.CSSProperties = rect
    ? { position: 'fixed', top: Math.min(rect.bottom + 12, window.innerHeight - 180), left: Math.max(12, rect.left) }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {/* dim scrim (no shake, fade only) */}
      <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      {/* highlight ring around the anchor */}
      {rect && (
        <div
          className="absolute rounded-xl ring-2 ring-[#f3e6a0]"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}
        />
      )}
      <motion.div
        data-testid="tutorial-coachmark"
        className="pointer-events-auto max-w-xs rounded-xl border border-gold/50 bg-[#141024] p-4 text-left shadow-xl"
        style={cardStyle}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      >
        <p className="font-display text-sm font-semibold text-[#f3e6c4]">{visibleStep.title}</p>
        <p className="mt-1 text-xs leading-snug text-white/70">{visibleStep.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={skip} className="text-[11px] uppercase tracking-wide text-white/40 hover:text-white/70">
            Salta tutorial
          </button>
          <button type="button" onClick={advance} className="rounded-lg bg-gold/20 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/30">
            Avanti
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

Note: the scrim uses `box-shadow: 0 0 0 9999px` on the ring to darken everything except the highlighted element — a static mask, no motion of the page. If jsdom lacks `window.innerHeight` sizing the test still passes (it only asserts text/buttons).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tutorial/TutorialOverlay.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/tutorial/TutorialOverlay.tsx tests/tutorial/TutorialOverlay.test.tsx
git commit -m "feat(tutorial): TutorialOverlay — coach-mark con Avanti/Salta"
```

---

### Task 6: Voce "Tutorial" + nudge nel menu

**Files:**
- Modify: `components/screens/MenuScreen.tsx`
- Test: `tests/screens/MenuTutorial.test.tsx`

**Interfaces:**
- Consumes: `loadProfile`, `saveProfile`, `markTutorialNudgeSeen` (Task 1); `useRouter` (already imported).
- Behaviour: a new button `data-testid="tutorial-cta"` labelled "Tutorial". On click: `saveProfile(markTutorialNudgeSeen(loadProfile()))` then `router.push('/play?tutorial=1')`. Also, clicking the existing "Gioca" (`play-cta`) marks the nudge seen. The nudge badge (`data-testid="tutorial-nudge"`, text "Nuovo? Inizia qui") renders next to the Tutorial button only while `loadProfile().tutorialNudgeSeen` is falsy (read once on mount into state, same pattern as `hasSavedRun`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/MenuTutorial.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MenuScreen } from '@/components/screens/MenuScreen'
import { PROFILE_KEY } from '@/lib/metaStore'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

describe('MenuScreen — tutorial entry', () => {
  beforeEach(() => { push.mockClear(); localStorage.removeItem(PROFILE_KEY) })

  it('shows a Tutorial button and, on a fresh profile, the nudge', () => {
    render(<MenuScreen />)
    expect(screen.getByTestId('tutorial-cta')).toBeInTheDocument()
    expect(screen.getByTestId('tutorial-nudge')).toBeInTheDocument()
  })
  it('clicking Tutorial navigates with ?tutorial=1 and marks the nudge seen', () => {
    render(<MenuScreen />)
    fireEvent.click(screen.getByTestId('tutorial-cta'))
    expect(push).toHaveBeenCalledWith('/play?tutorial=1')
    // re-render: nudge gone
    render(<MenuScreen />)
    expect(screen.queryAllByTestId('tutorial-nudge').length).toBe(0)
  })
})
```

(If `MenuScreen` already imports `next/navigation`, keep this `vi.mock`; it replaces the router for the test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/screens/MenuTutorial.test.tsx`
Expected: FAIL — no `tutorial-cta`.

- [ ] **Step 3: Implement**

In `MenuScreen.tsx`: import `loadProfile, saveProfile, markTutorialNudgeSeen` from `@/lib/metaStore`. Add mount-time state `const [nudge, setNudge] = useState(false)` and in the existing `useEffect` set `setNudge(!(loadProfile().tutorialNudgeSeen))`. Add a `dismissNudge()` helper: `saveProfile(markTutorialNudgeSeen(loadProfile())); setNudge(false)`. Change `play()` to call `dismissNudge()` before navigating. Add a `tutorial()` handler: `dismissNudge(); router.push('/play?tutorial=1')`. Render, right under the `endless-cta` button, the Tutorial button + conditional nudge:

```tsx
<button
  type="button"
  onClick={tutorial}
  data-testid="tutorial-cta"
  className="relative font-display text-sm uppercase tracking-wider text-gold/80 transition-colors hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3e6a0]"
>
  Tutorial
  {nudge && (
    <span data-testid="tutorial-nudge" className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
      ✨ Nuovo? Inizia qui
    </span>
  )}
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/screens/MenuTutorial.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/screens/MenuScreen.tsx tests/screens/MenuTutorial.test.tsx
git commit -m "feat(tutorial): voce Tutorial + nudge una-tantum nel menu"
```

---

### Task 7: Wiring nel flusso di gioco (mode, offerta curata, overlay)

**Files:**
- Modify: `components/screens/PlayFlow.gate.tsx` (read `?tutorial=1`)
- Modify: `components/screens/PlayFlow.tsx` (thread `tutorial` prop)
- Modify: `components/screens/RunBRunner.tsx` (curated offer + provider + overlay + `battle-arena` testid + `hasActiveDuo`)
- Test: `tests/screens/RunBRunnerTutorial.test.tsx`

**Interfaces:**
- Consumes: `tutorialStarterOffer`, `TUTORIAL_SEED` (Task 2); `TutorialProvider`, `TutorialOverlay` (Tasks 4–5); `detectDuos` + `livingOf`; `TutorialCtx` (Task 3).
- Wiring rules (read `RunBRunner.tsx` to place precisely):
  1. `PlaySeedGate` reads `params.get('tutorial') === '1'` and passes `tutorial` to `<PlayFlow seed={...} tutorial={tutorial} />`; when tutorial, force `seed = TUTORIAL_SEED`.
  2. `PlayFlow` forwards `tutorial` to `<RunBRunner seed tutorial />`.
  3. In `RunBRunner`, when `tutorial` is true, the starter draft offer is `tutorialStarterOffer(house)` instead of the normal `starterOffer(seed, house)` (locate where the offer is produced/passed to the draft screen).
  4. Wrap the RunBRunner render tree in `<TutorialProvider active={tutorial} ctx={ctx}>…<TutorialOverlay/></TutorialProvider>`, where `ctx: TutorialCtx = { phase, hasActiveDuo }`. Derive `phase`: `'draft'` while the starter-draft screen is shown, `'battle'` while a battle is shown, else `'other'` (map RunBRunner's existing view/phase state — read the file). Derive `hasActiveDuo = detectDuos(livingOf(run.team), run.relics).length > 0`.
  5. Add `data-testid="battle-arena"` to the battle arena container element if not already present.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/RunBRunnerTutorial.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunBRunner } from '@/components/screens/RunBRunner'
import { TUTORIAL_SEED } from '@/game/engine/tutorialOffer'
import { RUN_KEY } from '@/lib/runStore'

beforeEach(() => { localStorage.clear() })

describe('RunBRunner tutorial mode', () => {
  it('mounts the coach-mark overlay in tutorial mode at the draft', () => {
    render(<RunBRunner seed={TUTORIAL_SEED} tutorial />)
    // draft is the first screen; the draft step should render
    expect(screen.getByTestId('tutorial-coachmark')).toBeInTheDocument()
    expect(screen.getByText('Pesca la tua squadra')).toBeInTheDocument()
  })
  it('does NOT mount the overlay without tutorial mode', () => {
    render(<RunBRunner seed="normal-seed" />)
    expect(screen.queryByTestId('tutorial-coachmark')).toBeNull()
  })
})
```

(Adjust the import of `RUN_KEY`/props to match `RunBRunner`'s real signature after reading the file. If `RunBRunner`'s draft screen renders `draft-pick-*`, the coach-mark's anchor resolves; the assertion only needs the coach-mark card + its text.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/screens/RunBRunnerTutorial.test.tsx`
Expected: FAIL — `RunBRunner` has no `tutorial` prop / no overlay.

- [ ] **Step 3: Implement**

Apply wiring rules 1–5. Read `RunBRunner.tsx` to find: (a) where the starter offer is built, (b) the view/phase state that distinguishes draft vs battle, (c) the battle arena container. Add the `tutorial?: boolean` prop through `PlayFlow.gate` → `PlayFlow` → `RunBRunner`. Compute `ctx` each render and wrap the tree in the provider with the overlay as the last child so it sits on top.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/screens/RunBRunnerTutorial.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck clean; all tests pass (no regressions to run/replay/duo suites).

- [ ] **Step 6: Commit**

```bash
git add components/screens/PlayFlow.gate.tsx components/screens/PlayFlow.tsx components/screens/RunBRunner.tsx tests/screens/RunBRunnerTutorial.test.tsx
git commit -m "feat(tutorial): wiring mode ?tutorial=1 — offerta curata + overlay coach-mark"
```

---

### Task 8: Verifica visiva end-to-end

**Files:** none (verification only).

- [ ] **Step 1:** Build/run the dev server and drive `/play?tutorial=1` with the screenshot harness (Playwright, `reducedMotion: 'reduce'`). Confirm each of the 4 coach-marks appears at the right moment: draft (highlight on `draft-pick-0`), ruoli (same anchor, roles copy), auto-battle (arena), duo (duo-panel after picking the guided trio). Confirm "Salta" removes the overlay and the run continues. Confirm the menu shows the Tutorial button + nudge, and the nudge disappears after the first Tutorial/Gioca click.

- [ ] **Step 2:** If anything is off, open a follow-up (do not silently pass). Otherwise, done.

---

## Self-Review

- **Spec coverage:** menu entry + nudge (T6), persistence flag (T1), tutorial mode via `?tutorial=1` (T7), curated offer guaranteeing a Duo (T2), overlay + provider + 4 steps anchored to phases (T3–T5), skip continues run (T4/T5), determinism/no-DB (constraints + T2/T7), testing (each task) — all covered.
- **Placeholders:** the only intentionally-deferred concretes are the tutorial Duo/wizard ids in T2, which are pinned by T2's test (`detectDuos(trio, [])` contains `TUTORIAL_DUO_ID`) — the implementer selects real ids from `data/wizards.ts` and the test enforces correctness. Not a free-form placeholder.
- **Type consistency:** `TutorialCtx`/`TutorialStep`/`TutorialControls` are defined in T3–T4 and consumed with the same names/shapes in T5/T7. `markTutorialNudgeSeen`, `tutorialStarterOffer`, `TUTORIAL_SEED`, `detectDuos` used consistently.
