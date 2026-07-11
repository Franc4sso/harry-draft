# Duo Discoverability on Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wizard cards explain which Duos a wizard feeds — light per-signal marks + a naming tooltip ("Veleno → alimenta: Cancrena · Miasma · Untore"), plus a contextual "completes/advances a Duo" ribbon on draft & recruit candidates.

**Architecture:** Three pure read-only helpers over the existing `DUOS`/`duoProgress` (`wizardDuoSignals`, `duosForSignal`, `previewDuos`), a small reusable `DuoSignalMarks` component, and prop-driven wiring into the poster card (`WizardCardColumn`) and row card (`WizardCardRow`); the draft/recruit screens compute `previewDuos` and pass a `duoPreview` prop. No Duo mechanic, balance, or replay change.

**Tech Stack:** TypeScript, Next.js (custom build — read `node_modules/next/dist/docs/` before touching Next APIs), Vitest + jsdom, React. Reuses `@/components/ui/Tooltip`. No new dependencies.

## Global Constraints

- **Copy in Italian** ("alimenta", "Completa", "verso", `SIGNAL_LABEL` values).
- **Honesty rule:** a card shows a signal mark ONLY for a signal that feeds a shipped Duo (`DUO_SIGNALS_IN_USE`). A wizard that feeds no Duo shows no marks (e.g. a plain Attaccante).
- **Read-only:** no change to Duo activation, balance, or replay/anti-cheat — these are derivations over `DUOS`/`duoProgress`.
- **`livingOf` in `previewDuos`** (a fallen ally must not inflate the preview — matches the battle's Duo computation).
- **No camera shake.** Reuse the DuoBar accents: gold `#d9b65f` (completes), green `#3ecb6a` (advances). Combat busts (`UnitBust`) untouched.
- `npm run test` does NOT typecheck → run `npm run typecheck` (tsc --noEmit) separately after each task.
- Commit after every task.

---

## File Structure

**New files:**
- `components/cards/DuoSignalMarks.tsx` — the light per-signal marks + naming tooltip (Task 2).
- Tests: `tests/engine/duosCards.test.ts` (T1), `tests/ui/duoSignalMarks.test.tsx` (T2).

**Modified files:**
- `data/duos.ts` — add `SIGNAL_ICON`, `SIGNAL_COLOR` maps (T1).
- `game/engine/duos.ts` — add `DUO_SIGNALS_IN_USE`, `wizardDuoSignals`, `duosForSignal`, `previewDuos`, `type DuoPreview` (T1).
- `components/cards/WizardCardColumn.tsx` — `duoPreview` prop, mount marks + ribbon (T3).
- `components/draft/DraftCandidateCard.tsx` — pass `duoPreview` through (T3).
- `components/cards/WizardCardRow.tsx` — `duoPreview` prop, mount marks (compact) + ribbon (T4).
- `components/screens/DraftScreen.tsx` — compute per-candidate `previewDuos`, pass `duoPreview` (T5).
- `components/screens/RecruitScreen.tsx` — add `relics` prop, compute per-offer `previewDuos`, pass `duoPreview` (T5).
- `components/screens/RunBRunner.tsx` + `components/screens/EndlessRunner.tsx` — pass `relics={c.run.relics}` to `RecruitScreen` (T5).
- Tests: extend `tests/ui/wizardCard.test.tsx` (T3), the row-card test (T4), draft/recruit screen tests (T5).

**Verified interfaces (quote these):**
```ts
// game/engine/duos.ts (existing): DuoSignal, signalActive, litSignals, detectDuos,
//   duoProgress(team: DraftedWizard[], relics: ActiveRelic[]): DuoProgress[]  // {duo, lit, active, missing}
// data/duos.ts (existing): DUOS: Duo[], DUO_BY_ID, SIGNAL_LABEL: Record<DuoSignal,string>
// Duo = { id, name, desc, signals: [DuoSignal, DuoSignal] }
// types: Wizard has .role ('Tank'|'Attaccante'|'Supporto'|'Controllo') and .tags?: string[]
// game/engine/roster.ts: livingOf(team) filters out fallen (isDead treats currentHp===undefined as alive)
// components/ui/Tooltip.tsx: <Tooltip content={ReactNode} className? triggerClassName?>{children}</Tooltip>
// WizardCardColumn props: { drafted, selected?, onClick?, className?, hotSynergyIds?, testId? } — body has a shiny-trait row above the spell block
// WizardCardRow props: { drafted, selected?, onClick?, className?, hotSynergyIds?, testId?, showLevel? } — name row + affiliation chips at content top
// DraftCandidateCard props: { drafted, hotSynergyIds?, onPick?, onConsider?, testId? } → renders WizardCardColumn
// DraftScreen: has `current` (candidates) + `picks` (team so far); memoizes hotByCandidate similarly
// RecruitScreen props: { offer, team, teamMax, onPick, onSkip? } — renders WizardCardColumn per offer; NO relics today
```

---

### Task 1: Pure helpers + signal visuals

**Files:**
- Modify: `data/duos.ts`, `game/engine/duos.ts`
- Test: `tests/engine/duosCards.test.ts`

**Interfaces:**
- Produces:
  - `DUO_SIGNALS_IN_USE: ReadonlySet<DuoSignal>`
  - `wizardDuoSignals(wizard: Wizard): DuoSignal[]`
  - `duosForSignal(signal: DuoSignal): Duo[]`
  - `previewDuos(team: DraftedWizard[], relics: ActiveRelic[], candidate: DraftedWizard): DuoPreview`
  - `type DuoPreview = { completes: Duo[]; advances: Duo[] }`
  - `SIGNAL_ICON: Record<DuoSignal,string>`, `SIGNAL_COLOR: Record<DuoSignal,string>`

- [ ] **Step 1: Write the failing test** — `tests/engine/duosCards.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { wizardDuoSignals, duosForSignal, previewDuos, DUO_SIGNALS_IN_USE } from '@/game/engine/duos'
import type { DraftedWizard, Wizard } from '@/types'

const wiz = (id: string, role: string, tags: string[] = []): Wizard =>
  ({ id, name: id, role, house: 'Grifondoro', tags } as unknown as Wizard)
const dw = (id: string, role: string, tags: string[] = [], currentHp?: number): DraftedWizard =>
  ({ wizard: wiz(id, role, tags), level: 1, currentHp } as unknown as DraftedWizard)

describe('wizardDuoSignals (honesty)', () => {
  it('returns veleno for a veleno Attaccante but NOT attaccante (no shipped attaccante Duo)', () => {
    expect(wizardDuoSignals(wiz('a', 'Attaccante', ['veleno']))).toEqual(['veleno'])
  })
  it('returns nothing for a plain Attaccante', () => {
    expect(wizardDuoSignals(wiz('b', 'Attaccante', []))).toEqual([])
  })
  it('returns taunt + scudirigen for a scudirigen Tank', () => {
    expect(wizardDuoSignals(wiz('c', 'Tank', ['scudirigen']))).toEqual(['taunt', 'scudirigen'])
  })
  it('only reports signals actually used by a shipped Duo', () => {
    for (const w of ['Tank', 'Supporto', 'Controllo'] as const)
      for (const s of wizardDuoSignals(wiz('x', w, ['veleno', 'esecuzione', 'magieOscure'])))
        expect(DUO_SIGNALS_IN_USE.has(s)).toBe(true)
  })
})

describe('duosForSignal', () => {
  it('veleno feeds cancrena, miasma, untore', () => {
    expect(duosForSignal('veleno').map(d => d.id).sort()).toEqual(['cancrena', 'miasma', 'untore'])
  })
})

describe('previewDuos', () => {
  it('completes a Duo when the candidate lights the second signal', () => {
    // team already lights esecuzione (2 esecuzione mages); candidate brings the 2nd veleno -> CANCRENA
    const team = [dw('a', 'Attaccante', ['esecuzione', 'veleno']), dw('b', 'Tank', ['esecuzione'])]
    const cand = dw('c', 'Supporto', ['veleno'])
    const { completes } = previewDuos(team, [], cand)
    expect(completes.map(d => d.id)).toContain('cancrena')
  })
  it('does not count a fallen ally toward the preview', () => {
    // 'a' is the only other veleno mage but is DEAD -> candidate can't complete a veleno Duo
    const team = [dw('a', 'Attaccante', ['veleno', 'esecuzione'], 0), dw('b', 'Tank', ['esecuzione'])]
    const cand = dw('c', 'Supporto', ['veleno'])
    const { completes } = previewDuos(team, [], cand)
    expect(completes.map(d => d.id)).not.toContain('cancrena')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/engine/duosCards.test.ts`): exports don't exist.

- [ ] **Step 3: Add signal visuals to `data/duos.ts`** (after the existing `SIGNAL_LABEL`):

```ts
// Light per-signal glyph + accent for the card marks (data/duos.ts).
export const SIGNAL_ICON: Record<DuoSignal, string> = {
  veleno: '☠', esecuzione: '✖', scudirigen: '⛨', magieOscure: '☾',
  taunt: '⚑', attaccante: '⚔', supporto: '✚', controllo: '✦',
}
export const SIGNAL_COLOR: Record<DuoSignal, string> = {
  veleno: '#7ddc7d', esecuzione: '#ff8a7a', scudirigen: '#7db7ff', magieOscure: '#b98cff',
  taunt: '#3aa0f2', attaccante: '#ff5140', supporto: '#20d894', controllo: '#b355ff',
}
```

- [ ] **Step 4: Add helpers to `game/engine/duos.ts`** (append; keep existing exports). Add imports for `Duo`, `Wizard`, and `livingOf`:

```ts
import type { ActiveRelic, DraftedWizard, Duo, DuoSignal, Wizard } from '@/types'
import { livingOf } from '@/game/engine/roster'
// (DUOS is already imported at the top of the file)

const ROLE_SIGNAL: Record<string, DuoSignal> = {
  Tank: 'taunt', Attaccante: 'attaccante', Supporto: 'supporto', Controllo: 'controllo',
}
const TAG_SIGNALS: DuoSignal[] = ['veleno', 'esecuzione', 'scudirigen', 'magieOscure']

/** The Duo signals that appear in at least one shipped Duo. */
export const DUO_SIGNALS_IN_USE: ReadonlySet<DuoSignal> = new Set(DUOS.flatMap(d => d.signals))

/** A wizard's Duo signals that feed a SHIPPED Duo (role-signal if in use, + its Duo-family tags). */
export function wizardDuoSignals(wizard: Wizard): DuoSignal[] {
  const out: DuoSignal[] = []
  const roleSig = ROLE_SIGNAL[wizard.role]
  if (roleSig && DUO_SIGNALS_IN_USE.has(roleSig)) out.push(roleSig)
  const tags = wizard.tags ?? []
  for (const t of TAG_SIGNALS) if (tags.includes(t) && DUO_SIGNALS_IN_USE.has(t)) out.push(t)
  return out
}

/** The shipped Duos a given signal feeds (for the "→ alimenta: …" tooltip). */
export function duosForSignal(signal: DuoSignal): Duo[] {
  return DUOS.filter(d => d.signals.includes(signal))
}

export type DuoPreview = { completes: Duo[]; advances: Duo[] }

/** Diff of duoProgress with `candidate` added: which Duos it completes (inactive→active)
 *  and which it advances (two-away → one-away). Uses livingOf so a fallen ally never inflates it. */
export function previewDuos(team: DraftedWizard[], relics: ActiveRelic[], candidate: DraftedWizard): DuoPreview {
  const before = new Map(duoProgress(livingOf(team), relics).map(p => [p.duo.id, p]))
  const after = duoProgress(livingOf([...team, candidate]), relics)
  const completes: Duo[] = []
  const advances: Duo[] = []
  for (const a of after) {
    const b = before.get(a.duo.id)!
    if (a.active && !b.active) completes.push(a.duo)
    else if (!a.active && a.missing.length === 1 && b.missing.length >= 2) advances.push(a.duo)
  }
  return { completes, advances }
}
```

(If `Duo`/`Wizard`/`DuoSignal` aren't already re-exported from `@/types`, import `Duo`/`DuoSignal` from `@/types/duo` and `Wizard` from `@/types/wizard` — check the existing imports in the file first and match them.)

- [ ] **Step 5: Run — expect PASS** (`npx vitest run tests/engine/duosCards.test.ts tests/engine/duos.test.ts`) + `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add data/duos.ts game/engine/duos.ts tests/engine/duosCards.test.ts
git commit -m "feat(duos): card helpers — wizardDuoSignals, duosForSignal, previewDuos"
```

---

### Task 2: `DuoSignalMarks` component

**Files:**
- Create: `components/cards/DuoSignalMarks.tsx`
- Test: `tests/ui/duoSignalMarks.test.tsx`

**Interfaces:**
- Consumes: `wizardDuoSignals`, `duosForSignal` (T1), `SIGNAL_LABEL`/`SIGNAL_ICON`/`SIGNAL_COLOR`, `Tooltip`.
- Produces: `<DuoSignalMarks wizard={Wizard} compact?={boolean} />` — renders one mark per Duo signal; nothing when the wizard feeds no Duo. Each mark's tooltip = "‹Segnale› → alimenta: ‹Duo names · joined›". `compact` hides the text label (icon-only).

- [ ] **Step 1: Write the failing test** — `tests/ui/duoSignalMarks.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuoSignalMarks } from '@/components/cards/DuoSignalMarks'
import type { Wizard } from '@/types'

const wiz = (role: string, tags: string[] = []): Wizard =>
  ({ id: 'w', name: 'w', role, house: 'Grifondoro', tags } as unknown as Wizard)

describe('DuoSignalMarks', () => {
  it('renders a Veleno mark for a veleno mage', () => {
    render(<DuoSignalMarks wizard={wiz('Attaccante', ['veleno'])} />)
    expect(screen.getByTestId('duo-signal-marks')).toBeInTheDocument()
    expect(screen.getByText('Veleno')).toBeInTheDocument()
  })
  it('renders nothing for a plain attacker', () => {
    const { container } = render(<DuoSignalMarks wizard={wiz('Attaccante', [])} />)
    expect(container.querySelector('[data-testid="duo-signal-marks"]')).toBeNull()
  })
  it('names the fed Duos in the tooltip content', () => {
    render(<DuoSignalMarks wizard={wiz('Attaccante', ['veleno'])} />)
    // Tooltip content is rendered (see how tests/ui asserts Tooltip content elsewhere; the
    // string appears in the DOM). Assert the recipe text is present.
    expect(screen.getByText(/alimenta:/)).toBeInTheDocument()
  })
})
```

(Before writing, open an existing `tests/ui/*` test that renders a `Tooltip` to confirm how its `content` appears in jsdom — the assertion for the third test may need `getByText` on the trigger + checking the content node the same way the codebase already does. Match the existing pattern.)

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Write `components/cards/DuoSignalMarks.tsx`**

```tsx
'use client'
import type { Wizard } from '@/types'
import { wizardDuoSignals, duosForSignal } from '@/game/engine/duos'
import { SIGNAL_LABEL, SIGNAL_ICON, SIGNAL_COLOR } from '@/data/duos'
import { Tooltip } from '@/components/ui/Tooltip'

/** Light per-signal marks on a wizard card: shows the Duo signals this wizard feeds (honest —
 *  only signals used by a shipped Duo). Each mark's tooltip names the Duos it feeds. */
export function DuoSignalMarks({ wizard, compact = false }: { wizard: Wizard; compact?: boolean }) {
  const signals = wizardDuoSignals(wizard)
  if (signals.length === 0) return null
  return (
    <div data-testid="duo-signal-marks" className="flex flex-wrap items-center gap-1">
      {signals.map((s) => {
        const color = SIGNAL_COLOR[s]
        const fed = duosForSignal(s).map((d) => d.name).join(' · ')
        return (
          <Tooltip key={s} content={`${SIGNAL_LABEL[s]} → alimenta: ${fed}`}>
            <span
              data-signal={s}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color, borderColor: `${color}66`, background: `${color}1a` }}
            >
              <span aria-hidden>{SIGNAL_ICON[s]}</span>
              {!compact && <span>{SIGNAL_LABEL[s]}</span>}
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/ui/duoSignalMarks.test.tsx`) + `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add components/cards/DuoSignalMarks.tsx tests/ui/duoSignalMarks.test.tsx
git commit -m "feat(duos): DuoSignalMarks — light per-signal marks + naming tooltip"
```

---

### Task 3: Poster card — mount marks + `duoPreview` ribbon

**Files:**
- Modify: `components/cards/WizardCardColumn.tsx`, `components/draft/DraftCandidateCard.tsx`
- Test: `tests/ui/wizardCard.test.tsx` (extend)

**Interfaces:**
- Consumes: `DuoSignalMarks` (T2), `DuoPreview` (T1).
- Produces: `WizardCardColumn` gains `duoPreview?: DuoPreview`; renders `DuoSignalMarks` in the body and a completion ribbon at the crown. `DraftCandidateCard` gains `duoPreview?: DuoPreview` and passes it through.

- [ ] **Step 1: Write the failing test** — extend `tests/ui/wizardCard.test.tsx`

```tsx
// Assumes the file already imports render/screen and builds a DraftedWizard fixture.
// Add: import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
it('shows a Veleno signal mark for a veleno mage', () => {
  render(<WizardCardColumn drafted={/* a veleno-tagged DraftedWizard */ velenoDrafted} />)
  expect(screen.getByTestId('duo-signal-marks')).toBeInTheDocument()
})
it('shows a gold Completa ribbon when duoPreview completes a Duo', () => {
  render(<WizardCardColumn drafted={velenoDrafted} duoPreview={{ completes: [{ id: 'cancrena', name: 'Cancrena', desc: '', signals: ['veleno', 'esecuzione'] }], advances: [] }} />)
  const ribbon = screen.getByTestId('duo-ribbon')
  expect(ribbon).toHaveAttribute('data-kind', 'completes')
  expect(ribbon).toHaveTextContent('Cancrena')
})
it('shows a green verso cue when duoPreview only advances', () => {
  render(<WizardCardColumn drafted={velenoDrafted} duoPreview={{ completes: [], advances: [{ id: 'muro-vivente', name: 'Muro Vivente', desc: '', signals: ['scudirigen', 'taunt'] }] }} />)
  expect(screen.getByTestId('duo-ribbon')).toHaveAttribute('data-kind', 'advances')
})
```

(Reuse the fixture the file already builds; make `velenoDrafted` a DraftedWizard whose wizard has `tags: ['veleno']`.)

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement in `components/cards/WizardCardColumn.tsx`.**

Add imports + prop + type:
```ts
import { DuoSignalMarks } from './DuoSignalMarks'
import type { DuoPreview } from '@/game/engine/duos'
```
Add `duoPreview?: DuoPreview` to the props destructure + type.

Add the ribbon at the crown — right after the opening `<motion.div ...>` inner content, as the FIRST absolutely-positioned child (above the hero, z-30):
```tsx
{duoPreview && (duoPreview.completes.length > 0 || duoPreview.advances.length > 0) && (() => {
  const done = duoPreview.completes[0]
  const near = duoPreview.advances[0]
  const gold = '#d9b65f', green = '#3ecb6a'
  const extra = duoPreview.completes.length > 1 ? ` ＋${duoPreview.completes.length - 1}` : ''
  return (
    <div
      data-testid="duo-ribbon"
      data-kind={done ? 'completes' : 'advances'}
      className="absolute inset-x-0 top-0 z-30 rounded-t-2xl px-3 py-1 text-center text-[11px] font-bold"
      style={done
        ? { color: '#1a1305', background: gold, boxShadow: `0 0 14px ${gold}88` }
        : { color: green, background: 'rgba(10,8,19,0.85)', border: `1px solid ${green}66` }}
    >
      {done ? `⚡ Completa 「${done.name}」${extra}` : `→ verso 「${near!.name}」`}
    </div>
  )
})()}
```

Mount the static marks in the BODY, just after the shiny-trait block and before the spell block:
```tsx
<div className="mb-2"><DuoSignalMarks wizard={wizard} /></div>
```

- [ ] **Step 4: Pass through in `components/draft/DraftCandidateCard.tsx`** — add `duoPreview?: DuoPreview` (import the type) to props and forward it: `<WizardCardColumn ... duoPreview={duoPreview} />`.

- [ ] **Step 5: Run — expect PASS** (`npx vitest run tests/ui/wizardCard.test.tsx`) + `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add components/cards/WizardCardColumn.tsx components/draft/DraftCandidateCard.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(duos): poster card shows signal marks + completes/advances ribbon"
```

---

### Task 4: Row card — mount marks (compact) + `duoPreview`

**Files:**
- Modify: `components/cards/WizardCardRow.tsx`
- Test: the existing row-card test (grep `tests/` for `WizardCardRow`; if none renders it directly, add `tests/ui/wizardCardRow.test.tsx`)

**Interfaces:**
- Consumes: `DuoSignalMarks` (T2, `compact`), `DuoPreview` (T1).
- Produces: `WizardCardRow` gains `duoPreview?: DuoPreview`; renders compact marks in the name/affiliation area and a small corner ribbon when `duoPreview` is present.

- [ ] **Step 1: Write the failing test** — `tests/ui/wizardCardRow.test.tsx` (or extend an existing one)

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
// build a DraftedWizard `velenoDrafted` with wizard.tags ['veleno'] (mirror the fixture style
// used by the existing card tests in tests/ui)

describe('WizardCardRow Duo affordance', () => {
  it('shows compact signal marks for a veleno mage', () => {
    render(<WizardCardRow drafted={velenoDrafted} />)
    expect(screen.getByTestId('duo-signal-marks')).toBeInTheDocument()
  })
  it('shows a completes ribbon when duoPreview completes', () => {
    render(<WizardCardRow drafted={velenoDrafted} duoPreview={{ completes: [{ id: 'cancrena', name: 'Cancrena', desc: '', signals: ['veleno', 'esecuzione'] }], advances: [] }} />)
    expect(screen.getByTestId('duo-ribbon')).toHaveAttribute('data-kind', 'completes')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement in `components/cards/WizardCardRow.tsx`.**
  - Imports: `import { DuoSignalMarks } from './DuoSignalMarks'` and `import type { DuoPreview } from '@/game/engine/duos'`.
  - Add `duoPreview?: DuoPreview` to props.
  - Mount `<DuoSignalMarks wizard={wizard} compact />` inside the CONTENT block, in the name row (after the affiliation chips, e.g. within the `flex flex-wrap items-center gap-x-2` header row so it flows next to the name/affiliations).
  - Add a small corner ribbon (absolute, top-right of the card root) when `duoPreview` has completes/advances — mirror the poster ribbon's kind/text but compact:
```tsx
{duoPreview && (duoPreview.completes.length > 0 || duoPreview.advances.length > 0) && (() => {
  const done = duoPreview.completes[0]; const near = duoPreview.advances[0]
  const gold = '#d9b65f', green = '#3ecb6a'
  return (
    <div data-testid="duo-ribbon" data-kind={done ? 'completes' : 'advances'}
      className="absolute right-2 top-2 z-20 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={done ? { color: '#1a1305', background: gold } : { color: green, border: `1px solid ${green}66`, background: 'rgba(10,8,19,0.85)' }}>
      {done ? `⚡ ${done.name}` : `→ ${near!.name}`}
    </div>
  )
})()}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/ui/wizardCardRow.test.tsx`) + `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add components/cards/WizardCardRow.tsx tests/ui/wizardCardRow.test.tsx
git commit -m "feat(duos): row card shows compact signal marks + ribbon"
```

---

### Task 5: Wire draft + recruit screens (+ thread relics) + full-suite verify

**Files:**
- Modify: `components/screens/DraftScreen.tsx`, `components/screens/RecruitScreen.tsx`, `components/screens/RunBRunner.tsx`, `components/screens/EndlessRunner.tsx`
- Test: extend `tests/screens/DraftScreen.test.tsx` and `tests/screens/RecruitScreen.test.tsx`

**Interfaces:**
- Consumes: `previewDuos` (T1), the `duoPreview` props on `DraftCandidateCard`/`WizardCardColumn` (T3).

- [ ] **Step 1: Write the failing tests** — assert a draft candidate that completes a Duo renders the ribbon, and a recruit candidate does too. Extend `tests/screens/DraftScreen.test.tsx`:

```tsx
// Drive DraftScreen to a state where a candidate completes a Duo is seed-dependent and brittle;
// instead assert the wiring at the unit level: that DraftScreen passes a duoPreview to the card.
// Simplest robust check: render DraftScreen and assert NO crash + the candidate cards render
// (getAllByTestId(/draft-pick-/)). Then, for the completes-ribbon behavior, rely on Task 3's
// direct WizardCardColumn test. Here assert the screen computes previewDuos without error:
it('renders draft candidates with the Duo affordance wired (no crash)', () => {
  render(<DraftScreen seed="duo-wire-1" onComplete={() => {}} />)
  expect(screen.getAllByTestId(/^draft-pick-/).length).toBeGreaterThan(0)
})
```

For `tests/screens/RecruitScreen.test.tsx`, add a case with a team that already lights one signal + an offer wizard that completes a Duo, asserting `getByTestId('duo-ribbon')` appears on that offer card. (Build the team/offer fixtures directly — RecruitScreen takes plain props, no seed.)

- [ ] **Step 2: Run — expect FAIL** (recruit ribbon not wired; DraftScreen test may pass trivially — keep it as a regression guard).

- [ ] **Step 3: Wire `DraftScreen.tsx`.** Add `import { previewDuos } from '@/game/engine/duos'`. After the existing `hotByCandidate` memo, add:

```tsx
const duoByCandidate = useMemo(() => {
  const m = new Map<string, ReturnType<typeof previewDuos>>()
  for (const c of current) m.set(c.wizard.id, previewDuos(picks, [], c)) // no relics at the initial draft
  return m
}, [current, picks])
```

Pass it to the card: `<DraftCandidateCard ... duoPreview={duoByCandidate.get(c.wizard.id)} />`.

- [ ] **Step 4: Wire `RecruitScreen.tsx`.**
  - Add `relics: ActiveRelic[]` to the props type + destructure (import `ActiveRelic` from `@/types`).
  - Add `import { previewDuos } from '@/game/engine/duos'`.
  - In the `offer.map(d => ...)` candidate loop, compute `const duoPreview = previewDuos(team, relics, d)` and pass `duoPreview` to `<WizardCardColumn drafted={d} selected=... duoPreview={duoPreview} />`. (Use `team` — the current roster; the full-team swap nuance is out of scope for a hint.)
  - The replace-list `WizardCardRow` items are existing team members → do NOT pass `duoPreview` (they show static marks only, which they get for free from Task 4).

- [ ] **Step 5: Thread `relics` into RecruitScreen at its render sites.** Grep `git grep -n "<RecruitScreen"` — add `relics={c.run.relics}` at each (`RunBRunner.tsx` and `EndlessRunner.tsx`). Confirm both runners expose the run's relics as `c.run.relics`.

- [ ] **Step 6: Run — expect PASS** (`npx vitest run tests/screens/DraftScreen.test.tsx tests/screens/RecruitScreen.test.tsx`).

- [ ] **Step 7: Full suite + typecheck** — `npm run test` and `npm run typecheck`. Expected all green (≥ prior 1360 + new). Record counts.

- [ ] **Step 8: Commit**

```bash
git add components/screens/DraftScreen.tsx components/screens/RecruitScreen.tsx components/screens/RunBRunner.tsx components/screens/EndlessRunner.tsx tests/screens/
git commit -m "feat(duos): wire draft + recruit cards to previewDuos (completes/advances)"
```

---

## Self-Review (done at plan-write time)

**Spec coverage:** ✅ data helpers `wizardDuoSignals`/`duosForSignal`/`previewDuos` + honesty rule (T1) · signal icon/color (T1) · light static marks + naming tooltip (T2, mounted T3/T4) · contextual completes/advances ribbon on candidates (T3 poster, T4 row) · draft wiring, relics=[] (T5) · recruit wiring + relics threaded (T5) · `livingOf` in previewDuos (T1) · team-sidebar/member cards get static marks only, no preview (T5 leaves replace-list rows without duoPreview) · combat busts untouched (no task touches UnitBust). No spec requirement without a task.

**Placeholder scan:** No TBD/"handle edge cases". Engine + component code is complete; the two spots that reference existing test fixtures (T3/T4 `velenoDrafted`, the Tooltip-content assertion in T2) instruct the implementer to reuse the file's existing fixture/pattern — grounded, not a placeholder.

**Type consistency:** `DuoPreview = { completes: Duo[]; advances: Duo[] }` defined T1, consumed by T3/T4/T5. `previewDuos(team, relics, candidate)` signature identical across T1 (def), T5 (draft `previewDuos(picks, [], c)`, recruit `previewDuos(team, relics, d)`). `DuoSignalMarks({ wizard, compact })` def T2, used T3 (no compact) / T4 (compact). `SIGNAL_ICON`/`SIGNAL_COLOR` def T1, used T2. `wizardDuoSignals(wizard: Wizard)` takes `Wizard` (= `drafted.wizard`), consistent.
