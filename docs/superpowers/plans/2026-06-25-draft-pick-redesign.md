# Draft pick redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire le card verticali della scelta pick con card orizzontali a tutta larghezza, estetica cinematografica per casata, ed eliminare il flicker in hover.

**Architecture:** Nuovo componente orizzontale dedicato `WizardCardRow` (la `WizardCard` verticale resta intatta per gli altri schermi). `DraftCandidateCard` lo rende a tutta larghezza; `DraftScreen` dispone i candidati in colonna unica e memoizza la mappa `candidateId → hotSynergyIds`. `SynergyTracker` usa un ordine stabile (no reorder tra stato corrente e preview) con transizione CSS sulla barra. Il flicker sparisce perché la card non ha più il lift `whileHover` di framer-motion (sostituito da glow/sheen CSS senza `transform`).

**Tech Stack:** Next.js (vedi `node_modules/next/dist/docs/` — questa NON è la Next.js standard), React, TypeScript, framer-motion, Tailwind, Vitest + React Testing Library.

## Global Constraints

- **NON modificare** `components/cards/WizardCard.tsx` (verticale): è usata da `TeamScreen`, `MenuScreen`, `DraftSlot` e dai test `wizardCard.test.tsx`. Tutti i test esistenti devono restare verdi.
- **NON** toccare la logica di gioco: `useDraft`, `synergyProgress`, `previewSynergies`, `detectSynergies` restano invariati.
- **Hook DOM da preservare** (vincolati dai test esistenti): `data-testid="affiliation-strip"`, le chip con `data-synergy`/`data-hot`, `PortraitImage` con `variant="card"`, l'aria-label del ruolo via `RoleIcon`, il nome del mago come testo cliccabile, il `data-house` sul frame, e il testo header del tracker `Sinergie · cosa sbloccano`.
- **`StatBar` è già occupato** da `components/battle/StatBar.tsx` (API diversa): NON creare un componente con quel nome; la cella stat della row va inline.
- Rispettare `prefers-reduced-motion`.
- Comando test: `npx vitest run <path>` (singolo file) o `npx vitest run` (suite intera).

---

### Task 1: `WizardCardRow` — card orizzontale cinematografica + CSS hover no-flicker

**Files:**
- Create: `components/cards/WizardCardRow.tsx`
- Modify: `app/globals.css` (append in fondo)
- Test: `tests/ui/wizardCardRow.test.tsx`

**Interfaces:**
- Consumes: `CARD_STAT_MAX` esportato da `components/cards/WizardCard.tsx`; helper esistenti `houseTheme`, `affiliationChips`, `spellTypeChip`, `spellEffectChips`, `formatSpellStats`, `roleTooltip`, `TRAIT_BY_ID`; componenti `TierBadge`, `RoleIcon`, `Chip`, `PortraitImage`, `Tooltip`.
- Produces: `export function WizardCardRow({ drafted, selected?, onClick?, className?, hotSynergyIds? }): JSX.Element` — stessa firma props rilevanti di `WizardCard`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/wizardCardRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCardRow', () => {
  it('renders name, all four stat labels and the spell name', () => {
    const d = harry()
    render(<WizardCardRow drafted={d} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    for (const stat of ['HP', 'ATK', 'DIF', 'VEL']) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
    expect(screen.getByText(d.spell.name)).toBeInTheDocument()
  })

  it('conveys the house via a data-house frame and shows the card portrait', () => {
    const d = harry()
    const { container } = render(<WizardCardRow drafted={d} />)
    expect(container.querySelector(`[data-house="${d.wizard.house}"]`)).not.toBeNull()
    expect(container.querySelector('img[data-variant="card"]')).not.toBeNull()
  })

  it('exposes the role as an icon badge (aria-label)', () => {
    const d = harry()
    render(<WizardCardRow drafted={d} />)
    expect(screen.getByLabelText(d.wizard.role)).toBeInTheDocument()
  })

  it('shows the special-synergy strip and marks a hot chip', () => {
    render(<WizardCardRow drafted={harry()} hotSynergyIds={new Set(['goldenTrio'])} />)
    const strip = screen.getByTestId('affiliation-strip')
    expect(within(strip).getByText(/Golden Trio/i)).toBeInTheDocument()
    expect(strip.querySelector('[data-synergy="goldenTrio"][data-hot]')).not.toBeNull()
  })

  it('renders trait chips for a wizard that has traits', () => {
    const voldemort = draftWizard(createRng(1), WIZARD_BY_ID['voldemort']!)
    render(<WizardCardRow drafted={voldemort} />)
    const trait = TRAIT_BY_ID[voldemort.wizard.traits![0]!]!
    expect(screen.getByText(trait.name)).toBeInTheDocument()
  })

  it('fires onClick when clickable', async () => {
    const handler = vi.fn()
    render(<WizardCardRow drafted={harry()} onClick={handler} />)
    await userEvent.click(screen.getByText('Harry Potter'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not use a vertical card width', () => {
    const { container } = render(<WizardCardRow drafted={harry()} />)
    // The row is full-width, not the w-56 vertical card.
    expect(container.querySelector('.w-56')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/wizardCardRow.test.tsx`
Expected: FAIL — `Cannot find module '@/components/cards/WizardCardRow'`.

- [ ] **Step 3: Create the component**

Create `components/cards/WizardCardRow.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn, houseTheme } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { CARD_STAT_MAX } from './WizardCard'
import { Chip } from '@/components/ui/Chip'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { affiliationChips } from '@/lib/affiliationChips'
import { spellTypeChip, spellEffectChips, formatSpellStats } from '@/lib/glossary'
import { roleTooltip } from '@/lib/roleInfo'
import { Tooltip } from '@/components/ui/Tooltip'
import { TRAIT_BY_ID } from '@/data/traits'

const STAT_CELLS: Array<{ key: keyof typeof CARD_STAT_MAX; label: string; color: string }> = [
  { key: 'hp', label: 'HP', color: '#7CFC9B' },
  { key: 'atk', label: 'ATK', color: '#FF8A7A' },
  { key: 'def', label: 'DIF', color: '#7DB7FF' },
  { key: 'spd', label: 'VEL', color: '#FFD37D' },
]

function StatCell({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const ratio = Math.min(1, max <= 0 ? 0 : value / max)
  return (
    <div className="flex items-center gap-1">
      <span className="w-7 shrink-0 text-[9px] uppercase tracking-wide text-white/45">{label}</span>
      <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-white/85">{value}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/40">
        <span className="block h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </span>
    </div>
  )
}

export function WizardCardRow({
  drafted, selected, onClick, className, hotSynergyIds,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
  hotSynergyIds?: ReadonlySet<string>
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)
  const theme = houseTheme(wizard.house)
  const typeChip = spellTypeChip(spell.type)
  const effectChips = spellEffectChips(spell)
  const spellStats = formatSpellStats(spell)
  const specialChips = affiliationChips(wizard).filter((c) => c.kind === 'special')
  const traitChips = (wizard.traits ?? [])
    .map((id) => TRAIT_BY_ID[id])
    .filter((t): t is NonNullable<typeof t> => t != null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      data-house={wizard.house}
      className={cn(
        'wizard-row group relative flex w-full select-none overflow-hidden rounded-2xl text-white',
        clickable && 'cursor-pointer', className,
      )}
      style={{
        border: `2px solid ${theme.color}`,
        background: `linear-gradient(100deg, ${theme.color}cc 0%, ${theme.color}44 26%, #0c0a16 62%)`,
        boxShadow: selected
          ? `0 8px 28px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.85), 0 0 16px ${theme.glow}55`
          : `0 8px 28px rgba(0,0,0,0.5), 0 0 14px ${theme.glow}33, inset 0 0 26px ${theme.color}22`,
      }}
    >
      {/* Hover sheen — CSS only, no transform, so the card never moves out from under the cursor. */}
      <span aria-hidden className="wizard-row__sheen" />

      {/* LEFT: portrait, full card height */}
      <div className="relative w-28 shrink-0 self-stretch overflow-hidden">
        <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, transparent 28%, #0c0a16 96%)' }} />
        <div className="absolute left-1.5 top-1.5"><TierBadge tier={wizard.tier} /></div>
        <Tooltip
          className="absolute bottom-1.5 left-1.5"
          triggerClassName="grid h-6 w-6 place-items-center rounded-full border border-white/25 bg-black/55 backdrop-blur-sm"
          content={roleTooltip(wizard.role)}
        >
          <RoleIcon role={wizard.role} size={13} className="text-white/90" />
        </Tooltip>
      </div>

      {/* BODY: identity on top, then stats + spell (side by side on sm+, stacked on mobile) */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-base leading-tight truncate">{wizard.name}</h3>
          {specialChips.length > 0 && (
            <div data-testid="affiliation-strip" className="flex flex-wrap items-center gap-1">
              {specialChips.map((c) => {
                const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
                return (
                  <span
                    key={c.id}
                    data-synergy={c.synergyId}
                    data-hot={hot ? '' : undefined}
                    className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                    style={
                      hot
                        ? { color: '#f3e6c4', borderColor: '#caa24a', background: 'rgba(120,90,40,0.6)', boxShadow: '0 0 8px rgba(202,162,74,0.6)' }
                        : { color: '#ead9b0', borderColor: 'rgba(176,141,87,0.55)', background: 'rgba(176,141,87,0.12)' }
                    }
                  >
                    <span aria-hidden style={{ color: '#caa24a' }}>◆</span>
                    {c.label}
                  </span>
                )
              })}
            </div>
          )}
          {traitChips.map((trait) => (
            <Tooltip key={trait.id} content={trait.desc}>
              <span
                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ color: '#c4dff3', borderColor: 'rgba(100,160,220,0.5)', background: 'rgba(60,110,180,0.18)' }}
              >
                {trait.name}
              </span>
            </Tooltip>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-4">
          {/* Stats */}
          <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 self-center">
            {STAT_CELLS.map((c) => (
              <StatCell key={c.key} label={c.label} value={stats[c.key as Stat]} max={CARD_STAT_MAX[c.key]} color={c.color} />
            ))}
          </div>

          {/* Spell */}
          <div className="shrink-0 rounded-lg bg-black/30 p-2 sm:w-44 sm:border-l sm:border-white/10 sm:bg-transparent sm:pl-4">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-xs font-semibold">{spell.name}</p>
              <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/70">
              {spellStats.map((s) => (
                <span key={s.label} className="tabular-nums">
                  <span className="text-white/45">{s.label}</span> <span className="text-white/85">{s.value}</span>
                </span>
              ))}
            </div>
            {effectChips.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {effectChips.map((e) => (
                  <Chip key={e.label} label={e.label} color={e.color} icon={e.icon} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 4: Append the hover CSS to `app/globals.css`**

Append at the end of `app/globals.css`:

```css
/* Draft roster row: hover treatment uses glow + sheen only (NO transform), so the
   card never shifts out from under the cursor — that shift was the old hover flicker. */
.wizard-row { transition: filter 200ms ease; }
.wizard-row:hover { filter: brightness(1.06); }
.wizard-row__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 220ms ease;
  background: linear-gradient(100deg, transparent 38%, rgba(255,255,255,0.10) 50%, transparent 62%);
}
.wizard-row:hover .wizard-row__sheen { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .wizard-row, .wizard-row__sheen { transition: none; }
  .wizard-row:hover { filter: none; }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/ui/wizardCardRow.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Verify no regression on the vertical card**

Run: `npx vitest run tests/ui/wizardCard.test.tsx`
Expected: PASS (WizardCard untouched).

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/cards/WizardCardRow.tsx app/globals.css tests/ui/wizardCardRow.test.tsx
git commit -m "feat(draft): horizontal WizardCardRow with house-cinematic styling, flicker-free hover"
```

---

### Task 2: Wire the row into the draft — `DraftCandidateCard` + `DraftScreen` single column + memo

**Files:**
- Modify: `components/draft/DraftCandidateCard.tsx`
- Modify: `components/screens/DraftScreen.tsx`
- Test: existing `tests/ui/draftCandidateCard.test.tsx` and `tests/ui/draftScreen.test.tsx` must stay green (no new test file).

**Interfaces:**
- Consumes: `WizardCardRow` from Task 1.
- Produces: no new exports — `DraftCandidateCard` keeps its current prop signature `{ drafted, hotSynergyIds?, onPick?, onConsider? }`.

- [ ] **Step 1: Update `DraftCandidateCard` to render the row full-width**

Replace the whole body of `components/draft/DraftCandidateCard.tsx` with:

```tsx
'use client'
import type { DraftedWizard } from '@/types'
import { WizardCardRow } from '@/components/cards/WizardCardRow'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  return (
    <div className="relative w-full" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCardRow drafted={drafted} onClick={onPick} hotSynergyIds={hotSynergyIds} />
    </div>
  )
}
```

- [ ] **Step 2: Run the candidate test to verify it still passes**

Run: `npx vitest run tests/ui/draftCandidateCard.test.tsx`
Expected: PASS (affiliation strip, hot chip, onConsider on enter/focus, onPick on click).

- [ ] **Step 3: Update `DraftScreen` — single column candidates + memoized hot map**

In `components/screens/DraftScreen.tsx`:

3a. Change the React import on line 2 to add `useMemo`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
```

3b. Replace the `hotByCandidate` definition (currently lines 23-24) with a memoized map keyed on `[current, picks]`:

```tsx
  // Memoize the per-candidate "hot synergy" sets so they keep a stable identity
  // across re-renders (e.g. when `considered` changes on hover). Recomputing a new
  // Set for every candidate on every render was a source of hover churn.
  const hotByCandidate = useMemo(() => {
    const m = new Map<string, ReadonlySet<string>>()
    for (const c of current) {
      m.set(c.wizard.id, new Set(previewSynergies(picks, c).filter((p) => p.advances).map((p) => p.synergy.id)))
    }
    return m
  }, [current, picks])
```

3c. Replace the candidates `<section>` (currently lines 58-71). Change the grid to a single full-width column and read the hot set from the map:

```tsx
        <section
          className="grid grid-cols-1 gap-4"
          onPointerLeave={() => setConsidered(null)}
        >
          {current.map((c, i) => (
            <DraftCandidateCard
              key={c.wizard.id}
              drafted={c}
              hotSynergyIds={hotByCandidate.get(c.wizard.id)}
              onConsider={() => setConsidered(c)}
              onPick={() => { setConsidered(null); pick(i) }}
            />
          ))}
        </section>
```

(Leave the rest of `DraftScreen` — header, tracker aside, `previewSynergies`/`synergyProgress` imports — unchanged.)

- [ ] **Step 4: Run the draft screen test to verify it still passes**

Run: `npx vitest run tests/ui/draftScreen.test.tsx`
Expected: PASS (squad panel, tracker header, candidate portrait, pick advances).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/draft/DraftCandidateCard.tsx components/screens/DraftScreen.tsx
git commit -m "feat(draft): single-column roster of horizontal cards, memoized hot-synergy map"
```

---

### Task 3: `SynergyTracker` — ordine stabile (no reorder/flicker) + transizione barra

**Files:**
- Modify: `components/draft/SynergyTracker.tsx`
- Test: existing `tests/ui/synergyTracker.test.tsx` must stay green.

**Interfaces:**
- Consumes: nothing new. Same props `{ rows, candidateName? }`.
- Produces: no new exports.

**Why:** Oggi `sorted` ordina per `active` poi per `count/threshold`. Quando si passa da stato corrente a preview, righe nuove (`count===0 && advances`) compaiono e l'ordinamento per ratio fa **saltare** le righe (reflow = flicker). Si sostituisce con una chiave d'ordine **stabile** che non dipende dallo stato di preview: le sinergie già in corso (`count>0`) restano in cima in ordine fisso (famiglia → soglia → id), e le sinergie nuove del preview vengono **accodate** in fondo senza spostare le altre.

- [ ] **Step 1: Replace the `sorted` computation**

In `components/draft/SynergyTracker.tsx`, replace the current `sorted` block (lines 28-31):

```tsx
  const sorted = [...relevant].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return b.count / b.threshold - a.count / a.threshold
  })
```

with a stable identity-based order:

```tsx
  // Stable order so rows never swap places between the current and preview states
  // (reordering on hover was the tracker's flicker). In-progress synergies (count>0)
  // stay first in a fixed family→threshold order; brand-new preview synergies
  // (count===0) are appended last. The key uses pre-pick `count`, identical in both modes.
  const orderKey = (r: SynergyProgress | SynergyPreview) =>
    `${r.count > 0 ? 0 : 1}|${r.synergy.family ?? r.synergy.id}|${String(r.threshold).padStart(3, '0')}|${r.synergy.id}`
  const sorted = [...relevant].sort((a, b) => orderKey(a).localeCompare(orderKey(b)))
```

- [ ] **Step 2: Add a smooth width transition to the progress bar**

In the same file, find the progress-bar fill (currently line 70):

```tsx
                <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#b08d57)' }} />
```

Replace it with a version that animates the width change:

```tsx
                <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#b08d57)', transition: 'width 180ms ease' }} />
```

- [ ] **Step 3: Run the tracker test to verify it still passes**

Run: `npx vitest run tests/ui/synergyTracker.test.tsx`
Expected: PASS — all assertions are order-independent (use `getAllByText` / data-attribute queries), so the new stable order doesn't break them.

- [ ] **Step 4: Run the full UI suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS (whole suite green).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/draft/SynergyTracker.tsx
git commit -m "fix(draft): stable synergy-tracker order + animated bar — no hover flicker"
```

---

## Self-Review

**Spec coverage:**
- Card orizzontale 3-zone, cinematografica per casata → Task 1 (`WizardCardRow`, `houseTheme` gradient/glow).
- Lista a colonna unica full-width → Task 2 (`grid-cols-1`, `DraftCandidateCard` `w-full`).
- Fix flicker (no lift, memo Set, tracker stabile) → Task 1 (no `whileHover` transform, sheen/glow CSS), Task 2 (memo `hotByCandidate`), Task 3 (ordine stabile + transizione).
- `WizardCard` verticale intatta → garantito da Global Constraints + Task 1 Step 6.
- Mobile: spell sotto le stat → Task 1 (`flex-col sm:flex-row`).
- reduced-motion → Task 1 Step 4 CSS.
- Testing → ogni task ha test/regressione; nuovo `wizardCardRow.test.tsx`.

**Placeholder scan:** nessun TBD/TODO; tutto il codice è completo.

**Type consistency:** `WizardCardRow` riusa `CARD_STAT_MAX` (esportato da `WizardCard`), tipi `DraftedWizard`/`Stat`; `hotByCandidate` è `Map<string, ReadonlySet<string>>` e `WizardCardRow.hotSynergyIds?: ReadonlySet<string>` combaciano; `orderKey` accetta `SynergyProgress | SynergyPreview` (tipi già importati nel tracker). Nessuna firma incoerente tra task.
