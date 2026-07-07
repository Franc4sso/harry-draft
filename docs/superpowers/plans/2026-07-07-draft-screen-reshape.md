# Draft Screen Reshape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the starter draft screen into 3 vertical "collectible" candidate cards with a hybrid tier-track synergy box.

**Architecture:** Additive vertical card component (`WizardCardColumn`) beside the untouched horizontal `WizardCardRow`; shared `StatCell` extraction removes duplication; `SynergyTracker` rebuilt to group synergies by family and render tier-node tracks; one balance constant `screenSize 5→3`.

**Tech Stack:** Next.js (this repo's fork — read `node_modules/next/dist/docs/` before Next-specific code), React client components, framer-motion, Tailwind, Vitest + @testing-library/react.

## Global Constraints

- Copy is **Italian** (labels: "Se peschi", "Sinergie · cosa sbloccano", "SI ATTIVA", "Nessuna sinergia ancora. Pesca per costruirne una.", stat labels HP/ATK/DIF/VEL).
- `WizardCardRow` MUST remain byte-unchanged except for the `StatCell` import swap (Task 1) — team/recruit/level-up screens depend on it.
- Preserve DOM contract on the tracker: `data-synergy`, `data-active`, `data-activates`, `data-superseded` attributes must exist on the per-tier node elements.
- Candidate cards keep `data-testid="draft-pick-{i}"` and the `affiliation-strip` testid.
- Vitest skips `tsc` — run `npx tsc --noEmit` after adding/editing any `.ts`/`.tsx` file.
- After the `screenSize` change, re-run `campaignBalanceB` (enemy win-rate assert) to confirm no balance drift.
- Card root is NOT `overflow-hidden` (only background + portrait layers clip) so tooltips escape.

---

### Task 1: Extract shared `StatCell` from `WizardCardRow`

Removes the stat-bar duplication before the vertical card copies it. Pure refactor — behavior unchanged.

**Files:**
- Create: `components/cards/statCells.tsx`
- Modify: `components/cards/WizardCardRow.tsx` (remove local `StatCell` + `STAT_CELLS`, import from new module)
- Test: `tests/components/statCells.test.tsx`

**Interfaces:**
- Produces:
  - `STAT_CELLS: Array<{ key: keyof typeof CARD_STAT_MAX; label: string; color: string }>`
  - `StatCell({ label, value, max, color }: { label: string; value: number; max: number; color: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/statCells.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCell, STAT_CELLS } from '@/components/cards/statCells'

describe('StatCell', () => {
  it('renders label and value', () => {
    render(<StatCell label="HP" value={80} max={100} color="#7CFC9B" />)
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })
  it('STAT_CELLS covers the four combat stats', () => {
    expect(STAT_CELLS.map((c) => c.label)).toEqual(['HP', 'ATK', 'DIF', 'VEL'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/statCells.test.tsx`
Expected: FAIL — cannot resolve `@/components/cards/statCells`.

- [ ] **Step 3: Create the shared module**

```tsx
// components/cards/statCells.tsx
import { CARD_STAT_MAX } from './WizardCard'

export const STAT_CELLS: Array<{ key: keyof typeof CARD_STAT_MAX; label: string; color: string }> = [
  { key: 'hp', label: 'HP', color: '#7CFC9B' },
  { key: 'atk', label: 'ATK', color: '#FF8A7A' },
  { key: 'def', label: 'DIF', color: '#7DB7FF' },
  { key: 'spd', label: 'VEL', color: '#FFD37D' },
]

export function StatCell({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const ratio = Math.min(1, max <= 0 ? 0 : value / max)
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 shrink-0 text-[8px] font-semibold uppercase tracking-wide text-white/40">{label}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/45">
        <span className="block h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </span>
      <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-white/80">{value}</span>
    </div>
  )
}
```

- [ ] **Step 4: Rewire `WizardCardRow` to the shared module**

In `components/cards/WizardCardRow.tsx`:
- Delete the local `STAT_CELLS` const (lines ~18-23) and the local `StatCell` function (lines ~25-36).
- Remove the now-unused `import { CARD_STAT_MAX } from './WizardCard'` **only if** `CARD_STAT_MAX` is not referenced elsewhere in the file (it IS still used in the stats grid `max={CARD_STAT_MAX[c.key]}` — keep that import).
- Add: `import { StatCell, STAT_CELLS } from './statCells'`

- [ ] **Step 5: Run tests to verify green**

Run: `npx vitest run tests/components/statCells.test.tsx tests/ui/wizardCardRow.test.tsx tests/components/WizardCardRow.signature.test.tsx`
Expected: PASS (row card renders identically).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/cards/statCells.tsx components/cards/WizardCardRow.tsx tests/components/statCells.test.tsx
git commit -m "refactor(cards): extract shared StatCell/STAT_CELLS out of WizardCardRow"
```

---

### Task 2: Vertical `WizardCardColumn` component

The new collectible-style candidate card: portrait on top, spell panel at the bottom.

**Files:**
- Create: `components/cards/WizardCardColumn.tsx`
- Test: `tests/components/WizardCardColumn.test.tsx`

**Interfaces:**
- Consumes: `StatCell`, `STAT_CELLS` from `components/cards/statCells` (Task 1).
- Produces:
  - `WizardCardColumn({ drafted, selected?, onClick?, className?, hotSynergyIds?, testId? }: { drafted: DraftedWizard; selected?: boolean; onClick?: () => void; className?: string; hotSynergyIds?: ReadonlySet<string>; testId?: string }): JSX.Element`
  - Same prop names as `WizardCardRow` minus `showLevel` (draft candidates are always level 1).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/WizardCardColumn.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCardColumn', () => {
  it('renders name, spell name, and the four stat labels', () => {
    const d = harry()
    render(<WizardCardColumn drafted={d} testId="col-0" />)
    expect(screen.getByTestId('col-0')).toBeInTheDocument()
    expect(screen.getByText(displayName(d))).toBeInTheDocument()
    expect(screen.getByText(d.spell.name)).toBeInTheDocument()
    for (const l of ['HP', 'ATK', 'DIF', 'VEL']) expect(screen.getByText(l)).toBeInTheDocument()
  })
  it('exposes the affiliation strip with special synergies', () => {
    render(<WizardCardColumn drafted={harry()} />)
    expect(screen.getByTestId('affiliation-strip')).toBeInTheDocument()
  })
  it('marks a hot synergy chip', () => {
    render(<WizardCardColumn drafted={harry()} hotSynergyIds={new Set(['goldenTrio'])} />)
    expect(screen.getByTestId('affiliation-strip').querySelector('[data-synergy="goldenTrio"][data-hot]')).not.toBeNull()
  })
  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(<WizardCardColumn drafted={harry()} onClick={onClick} testId="col-0" />)
    screen.getByTestId('col-0').click()
    expect(onClick).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/WizardCardColumn.test.tsx`
Expected: FAIL — cannot resolve `@/components/cards/WizardCardColumn`.

- [ ] **Step 3: Implement `WizardCardColumn`**

Model the internals on `WizardCardRow` but stack vertically. Portrait spans the full width on top; name/chips/signature/trait/stats/spell stack below. Keep the tooltip-escape pattern (badges over the portrait live outside the clipped layer). Reuse `spellTypeChip`, `spellEffectChips`, `spellEffectDetails`, `formatSpellStats`, `affiliationChips`, `roleTooltip`, `TRAIT_BY_ID`, `SIGNATURE_BY_ID`, `houseTheme`, `displayName`.

```tsx
// components/cards/WizardCardColumn.tsx
'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn, houseTheme } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { CARD_STAT_MAX } from './WizardCard'
import { StatCell, STAT_CELLS } from './statCells'
import { Chip } from '@/components/ui/Chip'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { affiliationChips } from '@/lib/affiliationChips'
import { spellTypeChip, spellEffectChips, spellEffectDetails, formatSpellStats } from '@/lib/glossary'
import { roleTooltip } from '@/lib/roleInfo'
import { Tooltip } from '@/components/ui/Tooltip'
import { TRAIT_BY_ID } from '@/data/traits'
import { SIGNATURE_BY_ID } from '@/data/signatures'
import { displayName } from '@/lib/displayName'

/**
 * Vertical "collectible" card for the draft. Portrait on top, spell panel at the
 * bottom. Sibling to WizardCardRow (which stays horizontal for team/recruit).
 * Root is NOT overflow-hidden (only the bg + portrait clip) so tooltips escape.
 */
export function WizardCardColumn({
  drafted, selected, onClick, className, hotSynergyIds, testId,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
  hotSynergyIds?: ReadonlySet<string>
  testId?: string
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)
  const theme = houseTheme(wizard.house)
  const typeChip = spellTypeChip(spell.type)
  const effectChips = spellEffectChips(spell)
  const effectDetails = spellEffectDetails(spell)
  const spellStats = formatSpellStats(spell)
  const specialChips = affiliationChips(wizard).filter((c) => c.kind === 'special')
  const shinyTrait = drafted.shiny ? TRAIT_BY_ID[drafted.shiny.traitId] : undefined
  const shinyGlow = drafted.shiny ? ', 0 0 22px rgba(255,200,80,0.55), inset 0 0 0 2px rgba(255,210,90,0.7)' : ''
  const signature = SIGNATURE_BY_ID[wizard.id]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      data-house={wizard.house}
      data-testid={testId}
      className={cn(
        'wizard-col relative flex w-full select-none flex-col rounded-2xl text-white',
        clickable && 'cursor-pointer', className,
      )}
      style={{
        border: `2px solid ${theme.color}`,
        boxShadow: selected
          ? `0 10px 30px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.85), 0 0 18px ${theme.glow}55${shinyGlow}`
          : `0 10px 30px rgba(0,0,0,0.5), 0 0 16px ${theme.glow}30${shinyGlow}`,
      }}
    >
      {/* Background layer, clipped to the rounded corners. Root stays un-clipped. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${theme.color}22 0%, #0c0a16 60%)` }} />
      </div>

      {/* PORTRAIT — full width, top. Image clipped; badges over it stay outside the clip. */}
      <div className="relative h-40 w-full shrink-0">
        <div className="absolute inset-0 overflow-hidden rounded-t-[14px]">
          <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, #0c0a16 96%)' }} />
        </div>
        <div className="absolute left-2 top-2">
          <TierBadge tier={wizard.tier} />
        </div>
        <Tooltip
          className="absolute bottom-2 left-2"
          triggerClassName="grid h-6 w-6 place-items-center rounded-full border border-white/25 bg-black/55 backdrop-blur-sm"
          content={roleTooltip(wizard.role)}
        >
          <RoleIcon role={wizard.role} size={13} className="text-white/90" />
        </Tooltip>
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-[17px] leading-none">
            {displayName(drafted)}
            {drafted.shiny && <span aria-hidden className="ml-1 text-amber-300">✨</span>}
          </h3>
        </div>
        {specialChips.length > 0 && (
          <div data-testid="affiliation-strip" className="flex flex-wrap items-center gap-1">
            {specialChips.map((c) => {
              const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
              return (
                <span
                  key={c.id}
                  data-synergy={c.synergyId}
                  data-hot={hot ? '' : undefined}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={
                    hot
                      ? { color: '#f3e6c4', borderColor: '#caa24a', background: 'rgba(120,90,40,0.65)', boxShadow: '0 0 8px rgba(202,162,74,0.6)' }
                      : { color: '#ead9b0', borderColor: 'rgba(176,141,87,0.55)', background: 'rgba(176,141,87,0.14)' }
                  }
                >
                  <span aria-hidden style={{ color: '#caa24a' }}>◆</span>
                  {c.label}
                </span>
              )
            })}
          </div>
        )}

        {signature && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-300/60">Abilità</span>
            <Tooltip content={signature.desc}>
              <span
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ color: '#f3e0b0', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(120,90,40,0.28)' }}
              >
                <span aria-hidden className="text-amber-300">★</span>
                {signature.name}
              </span>
            </Tooltip>
          </div>
        )}

        {shinyTrait && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-sky-300/55">Tratto</span>
            <Tooltip content={shinyTrait.desc}>
              <span
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ color: '#bcd9f5', borderColor: 'rgba(96,156,214,0.55)', background: 'rgba(40,92,162,0.22)' }}
              >
                <span aria-hidden className="text-sky-300">✦</span>
                {shinyTrait.name}
              </span>
            </Tooltip>
          </div>
        )}

        <div className="mt-1 grid grid-cols-1 content-center gap-y-1">
          {STAT_CELLS.map((c) => (
            <StatCell key={c.key} label={c.label} value={stats[c.key as Stat]} max={CARD_STAT_MAX[c.key]} color={c.color} />
          ))}
        </div>

        <div className="mt-auto flex min-w-0 flex-col rounded-xl border border-white/12 bg-black/35 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-sm leading-tight">{spell.name}</p>
            <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/70">
            {spellStats.map((s) => (
              <span key={s.label} className="tabular-nums">
                <span className="text-white/45">{s.label}</span> <span className="text-white/90">{s.value}</span>
              </span>
            ))}
          </div>
          {spell.type === 'Controllo' && effectDetails.length > 0 ? (
            <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] leading-snug text-white/80">
              {effectDetails.map((line) => (<span key={line}>{line}</span>))}
            </div>
          ) : effectChips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {effectChips.map((e) => (<Chip key={e.label} label={e.label} color={e.color} icon={e.icon} />))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/WizardCardColumn.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/cards/WizardCardColumn.tsx tests/components/WizardCardColumn.test.tsx
git commit -m "feat(cards): vertical WizardCardColumn for the draft"
```

---

### Task 3: Swap the draft candidate + screen layout to the vertical card

Point `DraftCandidateCard` at the vertical card and lay out 3 cards in a row.

**Files:**
- Modify: `components/draft/DraftCandidateCard.tsx`
- Modify: `components/screens/DraftScreen.tsx:78-97` (grid + candidate mapping)
- Test: `tests/ui/draftCandidateCard.test.tsx` (unchanged assertions must still pass), `tests/screens/DraftScreen.test.tsx` (updated in Task 5)

**Interfaces:**
- Consumes: `WizardCardColumn` (Task 2).
- Produces: same `DraftCandidateCard` props (`drafted`, `hotSynergyIds`, `onPick`, `onConsider`, `testId`).

- [ ] **Step 1: Rewire `DraftCandidateCard` to the vertical card**

```tsx
// components/draft/DraftCandidateCard.tsx
'use client'
import type { DraftedWizard } from '@/types'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider, testId,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
  testId?: string
}) {
  return (
    <div className="relative h-full w-full" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCardColumn drafted={drafted} onClick={onPick} hotSynergyIds={hotSynergyIds} testId={testId} />
    </div>
  )
}
```

- [ ] **Step 2: Verify the candidate-card test still passes**

Run: `npx vitest run tests/ui/draftCandidateCard.test.tsx`
Expected: PASS — affiliation strip, hot chip, `onConsider`/`onPick`, focus behaviors all preserved (the vertical card exposes the same testids and text).

- [ ] **Step 3: Update the DraftScreen candidate grid**

In `components/screens/DraftScreen.tsx`, change the two-column wrapper's rail width and the candidate grid to a 3-up row. Replace the grid container (line ~78) and the inner `Stagger` grid (line ~84):

```tsx
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 p-4 md:grid-cols-[1fr_320px]">
```

```tsx
          <Stagger key={picks.length} className="grid grid-cols-1 content-start gap-4 sm:grid-cols-3">
```

Leave everything else (header, `considered`/`hotByCandidate` wiring, aside/`SynergyTracker`, seed footer) unchanged.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/draft/DraftCandidateCard.tsx components/screens/DraftScreen.tsx
git commit -m "feat(draft): vertical candidate cards, 3-up row layout"
```

---

### Task 4: Balance constant — 3 candidates per screen

**Files:**
- Modify: `data/constants.ts:37` (`screenSize: 5 → 3`)
- Test: `tests/campaign/campaignBalanceB.test.ts` (existing — re-run, do not edit)

- [ ] **Step 1: Change the constant**

In `data/constants.ts`, `draft` block: `screenSize: 5,` → `screenSize: 3,`.

- [ ] **Step 2: Re-run the balance gate**

Run: `npx vitest run tests/campaign/campaignBalanceB.test.ts`
Expected: PASS (enemy win-rate assert unaffected — player draft width does not enter enemy-power computation). If it unexpectedly fails, STOP and report the measured win-rate; do not tune other levers.

- [ ] **Step 3: Sanity-check draft still fills a screen**

Run: `npx vitest run tests/screens/RunBRunner.test.tsx`
Expected: PASS — draft pool (larger than 3) still fills a 3-wide screen; `maxTier1PerScreen: 1` still satisfiable.

- [ ] **Step 4: Commit**

```bash
git add data/constants.ts
git commit -m "balance(draft): show 3 candidates per pick (screenSize 5->3)"
```

---

### Task 5: Update the DraftScreen candidate-count test

The screen now shows 3 candidates, not 5.

**Files:**
- Modify: `tests/screens/DraftScreen.test.tsx:9-15`

- [ ] **Step 1: Update the "shows a screen of N candidates" test**

Replace the first `it` block:

```tsx
  it('shows a screen of 3 candidates', () => {
    render(<DraftScreen seed="ds-seed" onComplete={() => {}} />)
    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`draft-pick-${i}`)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('draft-pick-3')).toBeNull()
    expect(screen.getByText(new RegExp(`Pesca 0/${STARTER_PICKS}`))).toBeInTheDocument()
  })
```

Leave the second `it` (`fires onComplete with STARTER_PICKS wizards`) unchanged — it only ever clicks `draft-pick-0`.

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/screens/DraftScreen.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/screens/DraftScreen.test.tsx
git commit -m "test(draft): screen now shows 3 candidates"
```

---

### Task 6: Rebuild `SynergyTracker` as a hybrid tier-track

Group rows by family, render one mini-card per family with tier nodes; keep the `data-*` contract on the nodes.

**Files:**
- Modify: `components/draft/SynergyTracker.tsx` (full body rewrite; props unchanged)
- Test: `tests/ui/synergyTracker.test.tsx` (rewrite assertions — Task 6 Step 1)

**Interfaces:**
- Consumes: `SynergyProgress` / `SynergyPreview` from `@/game/engine/synergy` (`synergy`, `count`, `threshold`, `active`, and preview extras `nextCount`, `advances`, `willActivate`); `synergyBonusText` from `@/lib/glossary`; `synergy.family`, `synergy.name`, `synergy.id`.
- Produces: `SynergyTracker({ rows, candidateName? })` — unchanged signature.
- DOM contract: for each tier, a node element carries `data-synergy={synergy.id}`, and (when applicable) `data-active`, `data-activates`, `data-superseded`. A family with no `family` key renders a single-node track keyed by its synergy id.

- [ ] **Step 1: Rewrite the tracker test to the node-based DOM**

Replace the whole `describe('SynergyTracker', …)` body:

```tsx
// tests/ui/synergyTracker.test.tsx  (keep the imports + dw() helper at the top)
describe('SynergyTracker', () => {
  it('groups a family into one track and marks reached tier nodes', () => {
    // 2 Grifondoro → tier-2 node reached (active), tier-3 and tier-4 nodes not reached.
    const team = [dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank')]
    const { container } = render(<SynergyTracker rows={synergyProgress(team)} />)
    // One family header (name-only, count stripped)
    expect(screen.getByText('Grifondoro')).toBeInTheDocument()
    expect(screen.queryByText('2 Grifondoro')).toBeNull()
    // tier-2 node is active; tier-3 node exists but is not active
    expect(container.querySelector('[data-synergy="gryffindor2"][data-active]')).toBeTruthy()
    expect(container.querySelector('[data-synergy="gryffindor3"]:not([data-active])')).toBeTruthy()
  })

  it('marks lower active tiers superseded when a higher tier of the same family is active', () => {
    const team = [
      dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank'),
      dw('c', 'Grifondoro', 'Supporto'), dw('d', 'Grifondoro', 'Controllo'),
    ]
    const { container } = render(<SynergyTracker rows={synergyProgress(team)} />)
    expect(container.querySelector('[data-synergy="gryffindor4"][data-active]:not([data-superseded])')).toBeTruthy()
    expect(container.querySelector('[data-synergy="gryffindor2"][data-superseded]')).toBeTruthy()
    expect(container.querySelector('[data-synergy="gryffindor3"][data-superseded]')).toBeTruthy()
  })

  it('in preview mode marks the node that would activate', () => {
    const team = [dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank')]
    const cand = dw('c', 'Grifondoro', 'Supporto')
    const { container } = render(<SynergyTracker rows={previewSynergies(team, cand)} candidateName="c" />)
    expect(screen.getByText(/Se peschi/)).toBeInTheDocument()
    // tier-3 is the node that willActivate (count 2 → nextCount 3, threshold 3)
    expect(container.querySelector('[data-synergy="gryffindor3"][data-activates]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/synergyTracker.test.tsx`
Expected: FAIL — current tracker renders flat rows, not tier nodes; `data-active`/`data-activates`/`data-superseded` are on the row, not per-tier nodes matching these queries (the multi-node grouping assertions fail).

- [ ] **Step 3: Rewrite the tracker body**

```tsx
// components/draft/SynergyTracker.tsx
'use client'
import type { SynergyProgress, SynergyPreview } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'

type Row = SynergyProgress | SynergyPreview
function isPreview(r: Row): r is SynergyPreview {
  return 'nextCount' in r
}

// A family's rendered tier node.
type Node = {
  row: Row
  threshold: number
  reached: boolean      // count (or nextCount in preview) has met this tier
  active: boolean       // active in the *current* (pre-pick) state
  activates: boolean    // preview: this pick pushes count over this threshold for the first time
  superseded: boolean   // active but a higher active tier in the same family supersedes it
}
type Group = {
  key: string           // family id, or synergy id for family-less rows
  name: string          // header label (count prefix stripped)
  bonus: string         // top reached/activating tier bonus text
  count: number         // current member count
  nextCount: number     // preview member count (== count outside preview)
  nextThreshold: number // smallest not-yet-reached threshold, or max threshold if all reached
  maxThreshold: number
  nodes: Node[]
}

export function SynergyTracker({
  rows, candidateName,
}: {
  rows: SynergyProgress[] | SynergyPreview[]
  candidateName?: string
}) {
  const relevant = (rows as Row[]).filter((r) => (isPreview(r) ? r.count > 0 || r.advances : r.count > 0))

  // Bucket rows by family (family-less rows are their own single-tier group).
  const buckets = new Map<string, Row[]>()
  for (const r of relevant) {
    const k = r.synergy.family ?? r.synergy.id
    const list = buckets.get(k)
    if (list) list.push(r); else buckets.set(k, [r])
  }

  const groups: Group[] = []
  for (const [key, list] of buckets) {
    const sortedTiers = [...list].sort((a, b) => a.threshold - b.threshold)
    const count = sortedTiers[0].count
    const nextCount = isPreview(sortedTiers[0]) ? sortedTiers[0].nextCount : count
    // highest active tier in this family (current state) — lower actives are superseded
    let topActive = 0
    for (const r of sortedTiers) if (r.active && r.threshold > topActive) topActive = r.threshold

    const nodes: Node[] = sortedTiers.map((r) => {
      const preview = isPreview(r)
      const reached = (preview ? r.nextCount : r.count) >= r.threshold
      return {
        row: r,
        threshold: r.threshold,
        reached,
        active: r.active,
        activates: preview ? r.willActivate : false,
        superseded: r.active && topActive > r.threshold,
      }
    })

    const notReached = sortedTiers.find((r) => count < r.threshold)
    const maxThreshold = sortedTiers[sortedTiers.length - 1].threshold
    // bonus: prefer the top active tier, else the first activating tier, else the first tier
    const topTier = [...sortedTiers].reverse().find((r) => r.active)
      ?? sortedTiers.find((r) => isPreview(r) && r.willActivate)
      ?? sortedTiers[0]

    groups.push({
      key,
      name: sortedTiers[0].synergy.name.replace(/^\d+\s+/, ''),
      bonus: synergyBonusText(topTier.synergy).join(' · '),
      count, nextCount,
      nextThreshold: notReached ? notReached.threshold : maxThreshold,
      maxThreshold,
      nodes,
    })
  }

  // Most built-up families first, then those with an active tier, then closest-to-next.
  groups.sort((a, b) =>
    b.count - a.count ||
    Number(b.nodes.some((n) => n.active)) - Number(a.nodes.some((n) => n.active)) ||
    a.nextThreshold - b.nextThreshold ||
    a.key.localeCompare(b.key))

  return (
    <div className="w-full">
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/50">
        {candidateName ? <>Se peschi <span className="text-[#7cdc7c]">{candidateName}</span>:</> : 'Sinergie · cosa sbloccano'}
      </p>
      {groups.length === 0 && <p className="text-xs text-white/40">Nessuna sinergia ancora. Pesca per costruirne una.</p>}
      <div className="space-y-2.5">
        {groups.map((g) => {
          const fillRatio = Math.min(1, g.maxThreshold <= 0 ? 0 : Math.min(g.nextCount, g.maxThreshold) / g.maxThreshold)
          return (
            <div
              key={g.key}
              data-family={g.key}
              className="rounded-xl border border-[#2a2440] bg-[rgba(255,255,255,0.02)] p-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white/90">{g.name}</span>
                <span className="text-[11px] font-bold text-[#b08d57]">
                  {g.nextCount !== g.count ? <>{g.count} → {g.nextCount}</> : <>{g.count} / {g.nextThreshold}</>}
                </span>
              </div>

              {/* Tier track: connecting fill line + one node per tier threshold. */}
              <div className="relative flex items-center justify-between">
                <div aria-hidden className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/10" />
                <div
                  aria-hidden
                  className="synergy-bar-fill absolute left-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                  style={{ width: `calc((100% - 1.5rem) * ${fillRatio})`, background: 'linear-gradient(90deg,#7c3aed,#b08d57)' }}
                />
                {g.nodes.map((n) => {
                  const green = n.activates
                  const gold = (n.active || n.reached) && !n.superseded
                  const bg = green ? '#7cdc7c' : gold ? '#b08d57' : '#241f38'
                  const ring = green
                    ? '0 0 10px rgba(124,220,124,0.8)'
                    : n.active && !n.superseded ? '0 0 8px rgba(176,141,87,0.7)' : 'none'
                  return (
                    <span
                      key={n.threshold}
                      data-synergy={n.row.synergy.id}
                      data-active={n.active ? '' : undefined}
                      data-activates={n.activates ? '' : undefined}
                      data-superseded={n.superseded ? '' : undefined}
                      className="relative z-10 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold tabular-nums"
                      style={{
                        background: bg,
                        borderColor: green ? '#7cdc7c' : gold ? '#caa24a' : '#3a3352',
                        color: gold || green ? '#0c0a16' : 'rgba(255,255,255,0.5)',
                        boxShadow: ring,
                        opacity: n.superseded ? 0.5 : 1,
                      }}
                    >
                      {n.threshold}
                      {n.activates && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold uppercase tracking-wide text-[#7cdc7c]">
                          si attiva
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>

              {g.bonus && <p className="mt-2 text-[10px] leading-snug text-[#c9bfa0]">{g.bonus}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tracker test to verify it passes**

Run: `npx vitest run tests/ui/synergyTracker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the related synergy/ribbon tests**

Run: `npx vitest run tests/ui/synergyRibbon.test.tsx tests/ui/draftCandidateCard.test.tsx`
Expected: PASS (these don't assert tracker-row internals; confirm no collateral breakage).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/draft/SynergyTracker.tsx tests/ui/synergyTracker.test.tsx
git commit -m "feat(draft): hybrid tier-track synergy box (per-family nodes + activation glow)"
```

---

### Task 7: Full suite + manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS. If any draft/synergy/recruit test fails, fix the assertion to match the new DOM (do NOT weaken the balance gate).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual drive (verify skill)**

Use the `verify` / `run` skill to launch the app, open the draft screen, and confirm:
- exactly 3 vertical cards render side by side;
- hovering a card advances the matching family's tier track and shows "si attiva" when a tier would activate;
- picking 3 wizards completes the draft into the next screen.

- [ ] **Step 4: Final commit (if manual pass required any tweak)**

```bash
git add -A
git commit -m "chore(draft): reshape verification pass"
```

---

## Self-Review

- **Spec coverage:** (1) 3 candidates → Task 4 + Task 5. (2) vertical cards → Task 2 + Task 3. (3) hybrid synergy box → Task 6. Shared `StatCell` extraction → Task 1. Row-untouched constraint honored (only import swap). Balance re-verify → Task 4 Step 2. All spec sections mapped.
- **Placeholder scan:** no TBD/TODO; every code step shows full code.
- **Type consistency:** `WizardCardColumn` props match `DraftCandidateCard` usage (`drafted`/`onClick`/`hotSynergyIds`/`testId`); `StatCell`/`STAT_CELLS` signatures identical across Tasks 1–2; tracker props unchanged; node `data-*` names match the rewritten test queries.
