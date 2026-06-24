# Resa Leggibilità (Plan 3.5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the draft and battle readable — compact name-only affiliation chips, smaller cards, an intentional portrait fallback, and a battle that shows active synergies/relics for both teams at a calm, followable pace.

**Architecture:** All presentational. A new pure lib `lib/affiliationChips.ts` classifies a wizard's affiliations into house/role/special chips (name-only, deduped); a new pure component `SynergyRibbon` renders a team's active synergies (+ relics for the player). Existing draft components (`DraftCandidateCard`, `WizardCard`) and battle components (`BattleArena`/`BattleScreen`, `useBattleReplay`, `PortraitImage`) are refined to consume them. No engine/types/data changes.

**Tech Stack:** Next.js 16 + React 19, TypeScript strict, Tailwind v4, framer-motion v12 (`useReducedMotion`), Vitest + React Testing Library, lucide-react.

## Global Constraints

- **Mobile-first**, readable at 390px; then desktop.
- **Presentational only**: NO changes to `game/`, `types/`, `data/`. Replay/seed regression tests stay the gate.
- **TypeScript strict** — no `any`.
- **prefers-reduced-motion**: static fallback via framer `useReducedMotion`.
- **Italian UI copy**.
- **Chip labels are NAME-ONLY and never show a count.** A house chip says "Grifondoro" (from `wizard.house`), never "3 Grifondoro" (which is the raw `synergy.name`). The count/threshold lives ONLY in `SynergyTracker`.
- **Relics apply to the player (left) team only** — the enemy never has relics (engine invariant). The ribbon reflects this: player ribbon = synergies + relics; enemy ribbon = synergies only.
- **Reuse Plan-1/Plan-3 primitives**: `RarityFrame`, `PortraitImage`, `HouseCrest`, `RoleIcon`, `Chip`, `houseTheme`/`cn`, `synergyBonusText` (`lib/glossary`), `wizardAffiliations` (`lib/affiliations`).
- **Suite floor**: starts at 399 passing (branch `feat/resa-battle`). Every task ends green.

### Reference: existing shapes (do not redefine)

```ts
// types/synergy.ts
interface Synergy { id: string; name: string; kind: 'house'|'role'|'group'|'origin'; requires: SynergyRequirement; bonus: SynergyBonus }
interface SynergyRequirement { house?: House; role?: Role; count?: number; ids?: string[]; tag?: string }
interface ActiveSynergy { synergy: Synergy; memberIds: string[] }
// types/relic.ts
interface ActiveRelic { relic: Relic; stageObtained: number }   // Relic has .name (string) and .icon? — verify in relic.ts
// types/wizard.ts
type House = 'Grifondoro'|'Serpeverde'|'Corvonero'|'Tassorosso'
type Role  = 'Attaccante'|'Tank'|'Supporto'|'Controllo'

// lib/affiliations.ts
interface Affiliation { synergyId: string; label: string; kind: Synergy['kind'] }
function wizardAffiliations(wizard: Wizard): Affiliation[]   // label is synergy.name (e.g. "3 Grifondoro") — DO NOT show raw

// lib/glossary.ts
function synergyBonusText(bonus: SynergyBonus): string[]     // e.g. ["+20 DIF"]

// components/ui/Chip.tsx
function Chip({ label, color, icon?, size?, className? })    // icon is a lucide IconName string
// components/ui/HouseCrest.tsx
function HouseCrest({ house, size? })
// components/cards/RoleIcon.tsx
function RoleIcon({ role, size?, className? })
// components/ui/PortraitImage.tsx
function PortraitImage({ id, house, alt, variant }: { id; house; alt; variant?: 'card'|'bust' })  // has a `failed` fallback branch
```

`DraftCandidateCard` currently renders `wizardAffiliations(...).map(a => <span>{a.label}</span>)` stacked vertically over the portrait — this is what we replace. `BattleScreen` already receives `playerSyn: ActiveSynergy[]`, `enemySyn: ActiveSynergy[]`, `playerRelics?: ActiveRelic[]` as props (today unused in the battle view).

---

## Task 1: Intentional portrait fallback (silhouette + crest)

Replace the abstract gradient orb in `PortraitImage`'s `failed` branch with a stylised house-coloured bust silhouette plus the house crest, so a missing portrait reads as a deliberate design, not a broken placeholder. API unchanged.

**Files:**
- Modify: `components/ui/PortraitImage.tsx` (the `if (failed)` branch only)
- Test: `tests/ui/portraitImage.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `houseTheme` (`@/lib/theme`), `HouseCrest` (`@/components/ui/HouseCrest`).
- Produces: same `PortraitImage` API. The fallback root keeps `data-fallback={house}` and `data-variant={variant}` and gains a crest with `data-testid="fallback-crest"`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/portraitImage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortraitImage } from '@/components/ui/PortraitImage'

describe('PortraitImage fallback', () => {
  it('renders a house-coloured silhouette with a crest when the image fails', () => {
    render(<PortraitImage id="nonexistent-xyz" house="Grifondoro" alt="Test Mago" variant="card" />)
    const img = screen.getByAltText('Test Mago') as HTMLImageElement
    img.dispatchEvent(new Event('error'))
    const fallback = document.querySelector('[data-fallback="Grifondoro"]')
    expect(fallback).not.toBeNull()
    expect(fallback!.querySelector('[data-testid="fallback-crest"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/portraitImage.test.tsx`
Expected: FAIL — no element with `data-testid="fallback-crest"`.

- [ ] **Step 3: Rewrite the fallback branch**

In `components/ui/PortraitImage.tsx`, add `import { HouseCrest } from './HouseCrest'` at the top. Replace the `if (failed) { ... }` block with:

```tsx
  if (failed) {
    const theme = houseTheme(house)
    return (
      <div
        data-fallback={house}
        data-variant={variant}
        aria-label={alt}
        className="relative h-full w-full overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${theme.color}40 0%, #0c0a16 78%)` }}
      >
        {/* Stylised shoulders-up bust silhouette in the house colour. */}
        <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[88%] w-full">
          <defs>
            <linearGradient id={`sil-${house}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.glow} stopOpacity="0.55" />
              <stop offset="100%" stopColor={theme.color} stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="7.5" r="3.6" fill={`url(#sil-${house})`} />
          <path d="M4.5 24c0-5.2 3.4-8.2 7.5-8.2s7.5 3 7.5 8.2z" fill={`url(#sil-${house})`} />
        </svg>
        {/* House crest watermark, top-centre. */}
        <div data-testid="fallback-crest" className="absolute left-1/2 top-2 -translate-x-1/2 opacity-80">
          <HouseCrest house={house} size={variant === 'bust' ? 20 : 26} />
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/portraitImage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/PortraitImage.tsx tests/ui/portraitImage.test.tsx
git commit -m "feat(resa): intentional portrait fallback — house silhouette + crest"
```

---

## Task 2: Affiliation chip classification (pure, name-only, no dup)

A pure lib that turns a wizard into the chips its card should show: one house chip (name = the house), one role chip (name = the role), and a gold chip per **special** (group/origin) synergy it belongs to — never the raw "3 Grifondoro" synergy name, never a count, no house/role duplicates.

**Files:**
- Create: `lib/affiliationChips.ts`
- Test: `tests/lib/affiliationChips.test.ts`

**Interfaces:**
- Consumes: `Wizard` (`@/types`), `wizardAffiliations` + `Affiliation` (`@/lib/affiliations`).
- Produces:
  - `type AffiliationChipKind = 'house' | 'role' | 'special'`
  - `interface AffiliationChip { id: string; label: string; kind: AffiliationChipKind; synergyId?: string }`
  - `function affiliationChips(wizard: Wizard): AffiliationChip[]` — order: house, role, then specials. `label` for house/role is `wizard.house`/`wizard.role` (name-only). Specials come from affiliations whose `kind` is `'group'` or `'origin'`; their `label` is the synergy name (e.g. "Golden Trio") and they carry `synergyId` (for hot-glow matching). House/role affiliations (kind `'house'`/`'role'`) do NOT produce a separate special chip (already represented).
  - consumed by `DraftCandidateCard` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/affiliationChips.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { affiliationChips } from '@/lib/affiliationChips'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('affiliationChips', () => {
  it('puts a name-only house chip first, never the raw synergy name with a count', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    expect(chips[0]!.kind).toBe('house')
    expect(chips[0]!.label).toBe('Grifondoro')
    // No chip label may start with a digit ("3 Grifondoro" etc.)
    for (const c of chips) expect(/^\d/.test(c.label)).toBe(false)
  })
  it('includes a role chip with the role name', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    const role = chips.find(c => c.kind === 'role')
    expect(role).toBeTruthy()
    expect(role!.label).toBe(WIZARD_BY_ID['harry']!.role)
  })
  it('adds a special chip for group synergies (Golden Trio) carrying its synergyId', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    const trio = chips.find(c => c.kind === 'special' && c.synergyId === 'goldenTrio')
    expect(trio).toBeTruthy()
    expect(trio!.label).toBe('Golden Trio')
  })
  it('does not emit a special chip for house/role-kind synergies', () => {
    const chips = affiliationChips(WIZARD_BY_ID['harry']!)
    const specials = chips.filter(c => c.kind === 'special')
    // every special must be a group/origin synergy, never "3 Grifondoro"/"3 Attaccanti"
    for (const s of specials) expect(/^\d/.test(s.label)).toBe(false)
  })
  it('has no duplicate chip ids', () => {
    const chips = affiliationChips(WIZARD_BY_ID['hermione']!)
    expect(new Set(chips.map(c => c.id)).size).toBe(chips.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/affiliationChips.test.ts`
Expected: FAIL — `Cannot find module '@/lib/affiliationChips'`.

- [ ] **Step 3: Implement**

Create `lib/affiliationChips.ts`:

```ts
import type { Wizard } from '@/types'
import { wizardAffiliations } from '@/lib/affiliations'

export type AffiliationChipKind = 'house' | 'role' | 'special'

export interface AffiliationChip {
  id: string
  label: string
  kind: AffiliationChipKind
  /** Set for special chips — the synergy id, for hot-glow matching. */
  synergyId?: string
}

/**
 * The chips a wizard's draft card shows: always a name-only house chip and a
 * role chip (derived from the wizard itself, so they read "Grifondoro" /
 * "Tank" — never the raw synergy name "3 Grifondoro" and never a count), then
 * one gold "special" chip per group/origin synergy the wizard belongs to.
 * House/role-kind synergies do not add a separate chip — the house/role chips
 * already represent them — which is what removes the clutter and duplication.
 */
export function affiliationChips(wizard: Wizard): AffiliationChip[] {
  const chips: AffiliationChip[] = [
    { id: `house:${wizard.house}`, label: wizard.house, kind: 'house' },
    { id: `role:${wizard.role}`, label: wizard.role, kind: 'role' },
  ]
  for (const aff of wizardAffiliations(wizard)) {
    if (aff.kind === 'group' || aff.kind === 'origin') {
      chips.push({ id: `syn:${aff.synergyId}`, label: aff.label, kind: 'special', synergyId: aff.synergyId })
    }
  }
  return chips
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/affiliationChips.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/affiliationChips.ts tests/lib/affiliationChips.test.ts
git commit -m "feat(resa): name-only affiliation chip classification"
```

---

## Task 3: Compact affiliation strip on the draft card

Replace the stacked vertical chip block in `DraftCandidateCard` with a single horizontal row of small icon-first chips (house crest, role icon, gold gem for specials), name-only, "hot" chips get a gold glow ring. The strip sits below the card body, not floating over the portrait.

**Files:**
- Modify: `components/draft/DraftCandidateCard.tsx`
- Test: `tests/ui/draftCandidateCard.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `affiliationChips` (Task 2), `HouseCrest`, `RoleIcon`, `houseTheme`/`cn`.
- Produces: `DraftCandidateCard` keeps its current props (`drafted`, `hotSynergyIds?`, `onPick?`, `onConsider?`). Each chip keeps `data-synergy={synergyId}` (specials only) and `data-hot` when hot. The strip wrapper has `data-testid="affiliation-strip"`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/draftCandidateCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('DraftCandidateCard affiliation strip', () => {
  it('shows a single name-only strip: house + role + specials, no counts', () => {
    render(<DraftCandidateCard drafted={harry()} />)
    const strip = screen.getByTestId('affiliation-strip')
    expect(within(strip).getByText('Grifondoro')).toBeInTheDocument()
    expect(within(strip).getByText('Attaccante')).toBeInTheDocument()
    // never a count-prefixed label
    expect(within(strip).queryByText(/^\d/)).toBeNull()
  })
  it('marks a hot chip when its synergy id is in hotSynergyIds', () => {
    render(<DraftCandidateCard drafted={harry()} hotSynergyIds={new Set(['goldenTrio'])} />)
    const strip = screen.getByTestId('affiliation-strip')
    expect(strip.querySelector('[data-synergy="goldenTrio"][data-hot]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/draftCandidateCard.test.tsx`
Expected: FAIL — no `affiliation-strip` testid (old code uses an unlabeled stacked block).

- [ ] **Step 3: Rewrite DraftCandidateCard**

Replace `components/draft/DraftCandidateCard.tsx` with:

```tsx
'use client'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { affiliationChips } from '@/lib/affiliationChips'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { RoleIcon } from '@/components/cards/RoleIcon'
import { houseTheme, cn } from '@/lib/theme'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  const chips = affiliationChips(drafted.wizard)
  const theme = houseTheme(drafted.wizard.house)

  return (
    <div className="relative w-44" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCard drafted={drafted} onClick={onPick} />
      <div
        data-testid="affiliation-strip"
        className="mt-1.5 flex flex-wrap items-center gap-1"
      >
        {chips.map((c) => {
          const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
          const isSpecial = c.kind === 'special'
          return (
            <span
              key={c.id}
              data-synergy={c.synergyId}
              data-hot={hot ? '' : undefined}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                hot && 'resa-animated',
              )}
              style={
                hot
                  ? { color: '#f3e6c4', borderColor: '#caa24a', background: 'rgba(120,90,40,0.6)', boxShadow: '0 0 8px rgba(202,162,74,0.6)' }
                  : isSpecial
                    ? { color: '#ead9b0', borderColor: 'rgba(176,141,87,0.55)', background: 'rgba(176,141,87,0.12)' }
                    : { color: 'rgba(255,255,255,0.82)', borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)' }
              }
            >
              {c.kind === 'house' && <HouseCrest house={drafted.wizard.house} size={11} />}
              {c.kind === 'role' && <RoleIcon role={drafted.wizard.role} size={11} />}
              {isSpecial && <span aria-hidden style={{ color: '#caa24a' }}>◆</span>}
              {c.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
```

(`theme` is computed for parity with other cards; if the implementer finds it unused after writing, drop the line — do not leave an unused binding.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/draftCandidateCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the existing draft/screen suite for regressions**

Run: `npx vitest run tests/ui/`
Expected: PASS — no test relied on the old stacked `a.label` block. If one asserted the old "3 Grifondoro" overlay, update it to the new name-only strip (the spec mandates name-only).

- [ ] **Step 6: Commit**

```bash
git add components/draft/DraftCandidateCard.tsx tests/ui/draftCandidateCard.test.tsx
git commit -m "feat(resa): compact name-only affiliation strip on draft card"
```

---

## Task 4: Compact WizardCard

Shrink the card: width `w-44`, portrait band `h-28`, stats as a dense 2×2 grid instead of four full-width bars. Keep all four stats, the spell name + type chip + effect chips. Must not break other consumers (`DraftSlot`, `TeamScreen`, `MenuScreen`).

**Files:**
- Modify: `components/cards/WizardCard.tsx`
- Test: `tests/ui/wizardCard.test.tsx` (create if absent)

**Interfaces:**
- Consumes: existing (`RarityFrame`, `PortraitImage`, `HouseCrest`, `RoleIcon`, `Chip`, `StatBar` or a local compact stat cell, `spellTypeChip`/`spellEffectChips`).
- Produces: `WizardCard` keeps its props (`drafted`, `selected?`, `onClick?`, `className?`) and the exported `CARD_STAT_MAX`. Root width becomes `w-44`. All four stat labels (HP/ATK/DIF/VEL) remain present in the DOM.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/wizardCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCard compact', () => {
  it('is the compact width and shows the name, house, and all four stat labels', () => {
    const { container } = render(<WizardCard drafted={harry()} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    for (const stat of ['HP', 'ATK', 'DIF', 'VEL']) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
    expect(container.querySelector('.w-44')).not.toBeNull()
  })
})
```

(Note: the current card labels DEF as "DEF"; the spec/UI standard is the Italian "DIF" — switch the label to "DIF" in this task so it matches the stat label used elsewhere. If `StatBar` hardcodes the label from its `label` prop, just pass "DIF".)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/wizardCard.test.tsx`
Expected: FAIL — either `.w-44` is absent (card is `w-60`) or "DIF" not found (current label is "DEF").

- [ ] **Step 3: Rewrite WizardCard compactly**

Replace `components/cards/WizardCard.tsx` with (keep imports that are still used; add a small local `StatCell`):

```tsx
'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { Chip } from '@/components/ui/Chip'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { spellTypeChip, spellEffectChips } from '@/lib/glossary'

export const CARD_STAT_MAX = { hp: 150, atk: 120, def: 120, spd: 120 } as const

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

export function WizardCard({
  drafted, selected, onClick, className,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)
  const typeChip = spellTypeChip(spell.type)
  const effectChips = spellEffectChips(spell)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={clickable ? { y: -6, scale: 1.03 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      className={cn('w-44 select-none text-white', clickable && 'cursor-pointer', className)}
    >
      <RarityFrame tier={wizard.tier} selected={selected}>
        <div className="relative h-28 overflow-hidden">
          <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(12,10,22,0.94))' }} />
          <div className="absolute right-2 top-2"><TierBadge tier={wizard.tier} /></div>
        </div>

        <div className="p-2.5 pt-1.5">
          <h3 className="font-display text-sm leading-tight truncate">{wizard.name}</h3>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-white/65">
            <span className="flex items-center gap-1"><HouseCrest house={wizard.house} size={12} />{wizard.house}</span>
            <span className="flex items-center gap-1"><RoleIcon role={wizard.role} size={12} />{wizard.role}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
            {STAT_CELLS.map((c) => (
              <StatCell key={c.key} label={c.label} value={stats[c.key as Stat]} max={CARD_STAT_MAX[c.key]} color={c.color} />
            ))}
          </div>

          <div className="mt-2 rounded-lg bg-black/30 px-2 py-1.5">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-xs font-medium">{spell.name}</p>
              <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />
            </div>
            {effectChips.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {effectChips.map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
              </div>
            )}
          </div>
        </div>
      </RarityFrame>
    </motion.div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/wizardCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full UI suite for consumer regressions**

Run: `npx vitest run tests/ui/`
Expected: PASS. `DraftCandidateCard` already overrides width to `w-44` on its own wrapper (Task 3) — confirm it still wraps cleanly. If `TeamScreen`/`DraftSlot`/`MenuScreen` tests assert the old `w-60` or "DEF", update them to the compact values (the spec mandates the smaller card and "DIF").

- [ ] **Step 6: Commit**

```bash
git add components/cards/WizardCard.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(resa): compact WizardCard — w-44, 2x2 stat grid, DIF label"
```

---

## Task 5: `SynergyRibbon` — active synergies (+ player relics)

A pure presentational component listing a team's active synergies as gold pills (icon + name + short bonus), plus the player's active relics. Reused on both sides of the arena.

**Files:**
- Create: `components/battle/SynergyRibbon.tsx`
- Test: `tests/ui/synergyRibbon.test.tsx`

**Interfaces:**
- Consumes: `ActiveSynergy` (`@/types`), `ActiveRelic` (`@/types`), `synergyBonusText` (`@/lib/glossary`), `cn` (`@/lib/theme`).
- Produces: `function SynergyRibbon({ synergies, relics, align }: { synergies: ActiveSynergy[]; relics?: ActiveRelic[]; align?: 'left'|'right' }): JSX.Element | null` — renders `data-testid="synergy-ribbon"`; each synergy pill has `data-synergy={id}`, each relic pill `data-relic`. Returns null when there's nothing to show. `align` controls justification (player left, enemy right).

- [ ] **Step 1: Write the failing test**

Create `tests/ui/synergyRibbon.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SynergyRibbon } from '@/components/battle/SynergyRibbon'
import type { ActiveSynergy } from '@/types'

const syn = (id: string, name: string, bonus: ActiveSynergy['synergy']['bonus']): ActiveSynergy => ({
  synergy: { id, name, kind: 'house', requires: {}, bonus }, memberIds: ['a', 'b', 'c'],
})

describe('SynergyRibbon', () => {
  it('shows each active synergy name and its bonus text', () => {
    render(<SynergyRibbon synergies={[syn('gryffindor3', 'Grifondoro', { def: 20 })]} />)
    const ribbon = screen.getByTestId('synergy-ribbon')
    expect(ribbon.querySelector('[data-synergy="gryffindor3"]')).not.toBeNull()
    expect(ribbon).toHaveTextContent('Grifondoro')
    expect(ribbon).toHaveTextContent(/\+20 DIF/)
  })
  it('shows player relics when provided', () => {
    const relics = [{ relic: { id: 'r1', name: 'Pietra', icon: 'Gem' } as never, stageObtained: 1 }]
    render(<SynergyRibbon synergies={[]} relics={relics} />)
    const ribbon = screen.getByTestId('synergy-ribbon')
    expect(ribbon.querySelector('[data-relic]')).not.toBeNull()
    expect(ribbon).toHaveTextContent('Pietra')
  })
  it('renders nothing when there are no synergies and no relics', () => {
    const { container } = render(<SynergyRibbon synergies={[]} />)
    expect(container.querySelector('[data-testid="synergy-ribbon"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/synergyRibbon.test.tsx`
Expected: FAIL — `Cannot find module '@/components/battle/SynergyRibbon'`.

- [ ] **Step 3: Implement**

First read `types/relic.ts` to confirm the `Relic` field used for the display name (assume `relic.name: string`; if it's different, use the real field). Create `components/battle/SynergyRibbon.tsx`:

```tsx
'use client'
import type { ActiveSynergy, ActiveRelic } from '@/types'
import { synergyBonusText } from '@/lib/glossary'
import { cn } from '@/lib/theme'

/**
 * The active-buffs ribbon shown above a team in battle: each active synergy as
 * a gold pill (name + short bonus), plus the player's relics. Enemy teams pass
 * no relics (engine invariant: only the player carries relics). Purely
 * presentational — reads what the engine already applied.
 */
export function SynergyRibbon({
  synergies, relics = [], align = 'left',
}: {
  synergies: ActiveSynergy[]
  relics?: ActiveRelic[]
  align?: 'left' | 'right'
}) {
  if (synergies.length === 0 && relics.length === 0) return null
  return (
    <div
      data-testid="synergy-ribbon"
      className={cn('flex flex-wrap items-center gap-1', align === 'right' ? 'justify-end' : 'justify-start')}
    >
      {synergies.map((s) => (
        <span
          key={s.synergy.id}
          data-synergy={s.synergy.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}
        >
          <span aria-hidden style={{ color: '#caa24a' }}>✦</span>
          {s.synergy.name}
          <span className="text-[#c9bfa0]">{synergyBonusText(s.synergy.bonus).join(' · ')}</span>
        </span>
      ))}
      {relics.map((r) => (
        <span
          key={r.relic.id}
          data-relic=""
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: '#d6c8ff', borderColor: 'rgba(124,58,237,0.5)', background: 'rgba(124,58,237,0.16)' }}
        >
          <span aria-hidden style={{ color: '#a855f7' }}>◈</span>
          {r.relic.name}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/synergyRibbon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/battle/SynergyRibbon.tsx tests/ui/synergyRibbon.test.tsx
git commit -m "feat(resa): SynergyRibbon — active synergies + player relics"
```

---

## Task 6: Mount ribbons in battle, show VEL, slow the pace

Wire `SynergyRibbon` above each team in the battle view (player synergies + relics on the left, enemy synergies on the right), surface the acting unit's VEL near the initiative bar, and raise the default replay `stepMs` so the fight is followable.

**Files:**
- Modify: `components/screens/BattleScreen.tsx` (mount ribbons + pass VEL/pace)
- Modify: `hooks/useBattleReplay.ts` (raise default `stepMs`)
- Test: `tests/ui/battle.test.tsx` (extend the existing `BattleScreen` describe)

**Interfaces:**
- Consumes: `SynergyRibbon` (Task 5); `BattleScreen` already has `playerSyn`, `enemySyn`, `playerRelics` props.
- Produces: `BattleScreen` renders two `data-testid="synergy-ribbon"` regions (player + enemy) when buffs exist. Public props unchanged (CampaignRunner keeps working).

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('BattleScreen')` in `tests/ui/battle.test.tsx`:

```ts
it('shows the active-synergy ribbons for both teams in battle', () => {
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
  // Both teams (Gryffindor-heavy left, Slytherin-heavy right) have at least one active synergy here.
  expect(screen.getAllByTestId('synergy-ribbon').length).toBeGreaterThanOrEqual(1)
})
```

(If for this seed a side has no active synergy, the ribbon for that side correctly renders nothing; the assertion uses `getAllByTestId(...).length >= 1` to stay robust. `detectSynergies` is already imported at the top of this file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battle.test.tsx -t "ribbons"`
Expected: FAIL — no `synergy-ribbon` in the battle DOM.

- [ ] **Step 3: Raise the default pace**

In `hooks/useBattleReplay.ts`, change the default step interval so the fight is calm and followable:

```ts
  const stepMs = opts.stepMs ?? 1100
```

(Was `600`. The speed multiplier and skip still work, so players can speed up; the default is now "understand everything".)

- [ ] **Step 4: Mount the ribbons + VEL in BattleScreen**

In `components/screens/BattleScreen.tsx`, add the import:

```tsx
import { SynergyRibbon } from '@/components/battle/SynergyRibbon'
```

Wrap the arena with the two ribbons. Replace the `<BattleArena .../>` line with:

```tsx
      <div className="flex w-full max-w-3xl items-start justify-between gap-4 px-1">
        <SynergyRibbon synergies={playerSyn} relics={playerRelics ?? []} align="left" />
        <SynergyRibbon synergies={enemySyn} align="right" />
      </div>

      <BattleArena replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle} />
```

And surface VEL: in the turn line under the title, append the acting unit's speed. Find the actor's buffed VEL from the replay units is not available (ReplayUnit has no spd); instead show the current actor's name + a "VEL" hint from the entry is not possible without the stat. So keep this minimal and honest: show whose turn it is. Replace the `<p>` turn line with:

```tsx
        <p className="text-[11px] uppercase tracking-widest text-white/35">
          Turno {r.entry?.turn ?? 0} · azione {r.index}/{r.total - 1}
          {r.entry?.actorId ? <> · agisce <span className="text-white/60">{replay.units.find(u => u.id === r.entry!.actorId && u.side === r.entry!.actorSide)?.name ?? r.entry!.actorId}</span></> : null}
        </p>
```

(Spec asked to make "why the fast one acts first" explicit. The initiative bar already orders by the replay action sequence — which IS speed-derived — so the readable signal is the highlighted current actor in the bar plus this "agisce X" line. Per-unit VEL is not on `ReplayUnit` and adding it is an engine/type touch that's out of scope here; the ordering itself conveys speed. Do not add a spd field.)

- [ ] **Step 5: Run the battle suite**

Run: `npx vitest run tests/ui/battle.test.tsx`
Expected: PASS — new ribbon test, existing skip/onFinish + step-control tests, all arena tests. (The raised `stepMs` doesn't affect tests that use `skip`/explicit frames.)

- [ ] **Step 6: Run the hook suite**

Run: `npx vitest run tests/ui/useBattleReplay.test.tsx`
Expected: PASS — the step/stepBack/skip tests don't assert the old 600ms default.

- [ ] **Step 7: Commit**

```bash
git add components/screens/BattleScreen.tsx hooks/useBattleReplay.ts tests/ui/battle.test.tsx
git commit -m "feat(resa): battle synergy/relic ribbons, actor line, calmer pace"
```

---

## Task 7: Full suite, build, manual smoke

Prove the whole suite and production build are green, then eyeball the draft + battle at mobile and desktop.

**Files:** none (verification task).

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS — all tests green; record the final count (≥ prior 399 plus the new tests).

- [ ] **Step 2: Production build + typecheck**

Run: `npm run build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Manual smoke (controller does this, not a subagent)**

This step is performed by the controller with the dev server + a headless browser, NOT by an implementer subagent. Verify at 390px and 1280px: draft cards are compact with a single name-only chip strip (house + role + specials, no "3 Grifondoro", no counts); the portrait fallback shows a house silhouette + crest (not an orb); in battle the two synergy ribbons appear above each team (player left with relics, enemy right), the pace is calm and followable, the action line names who acts. Note any visual issue as a Minor in the ledger.

- [ ] **Step 4: Commit (if any verification-driven fixes were needed)**

Only if Steps 1–3 surfaced fixes. Otherwise no commit — the feature is already committed task-by-task.

---

## Self-Review (against spec)

- **§4 chips: too many / ugly / name-only / no dup** → Task 2 (`affiliationChips`: house+role name-only, specials only for group/origin, no count) + Task 3 (single horizontal strip, icon-first, hot glow). The "3 Grifondoro" bug is killed at the source (label from `wizard.house`, not `synergy.name`). ✓
- **§4 hot glow** → Task 3 (`data-hot` + gold ring, driven by existing `hotSynergyIds`). ✓
- **§5 card too big** → Task 4 (`w-44`, `h-28` portrait, 2×2 stat grid, all four stats kept, "DIF" label). Consumer regressions handled in Task 4 Step 5. ✓
- **§6 battle ribbons above each team, player+relics / enemy synergies only** → Task 5 (`SynergyRibbon`) + Task 6 (mounted left/right; relics player-only per engine invariant). ✓
- **§6 calm followable pace (auto-play lento)** → Task 6 (default `stepMs` 600→1100, still speed/skippable). ✓
- **§6 "why fast acts first" / initiative + actor line** → Task 6 (actor line; initiative bar already speed-ordered). VEL field deliberately NOT added (engine/type touch, out of scope) — noted inline. ✓
- **§7 intentional fallback** → Task 1 (house silhouette + crest). ✓
- **§2 answer made visible** → ribbons surface the synergies/relics the engine already applies. ✓
- **Determinism / no engine-data-types change** → every task is presentational; no `game/`/`types/`/`data/` edits. Full suite (incl. replay/seed) is the gate (Task 7). ✓
- **prefers-reduced-motion, Italian copy, mobile-first** → carried in components (hot chip uses `.resa-animated`; copy Italian; widths/wrap mobile-first). ✓

**Deferred / out of scope (correct):** portrait art (user supplies files into `public/portraits/`); screen-shake/particles; balance tuning (Plan 4).
