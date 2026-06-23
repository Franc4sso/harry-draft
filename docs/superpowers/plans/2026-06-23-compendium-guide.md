# Compendium Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make spells, relics, and synergies visible to the player through inline card detail, a synergy bonus breakdown on the team screen, and a rewritten `/rules` "Compendio" page whose signature element is an interactive synergy graph.

**Architecture:** A single pure module `lib/glossary.ts` formats existing game data (spell stats, effect chips, synergy bonus text) and holds per-category metadata (color + icon + blurb). A reusable `Chip` component renders the shared visual vocabulary. UI surfaces (WizardCard, TeamScreen, Compendio) consume both. No engine, type, or `data/` changes.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind v4, framer-motion, lucide-react (`^1.21.0`), vitest + @testing-library/react.

## Global Constraints

- **No changes to** `game/engine/*`, `types/*` domain types, or `data/*.ts`. Presentation + pure formatting only.
- **Determinism:** no `Math.random()` / `Date.now()` in any new code. Graph layout must be deterministic (computed from input order).
- **`spell.power` is a multiplier**, not raw damage (values like `1.4`, `2.4`). Display it as `×1.4`, never as a flat number.
- **Italian UI copy** throughout (matches existing screens).
- **Icons:** use `lucide-react` names only (already a dependency). `IconName` = `keyof typeof import('lucide-react')` restricted to names actually used.
- **Accessibility floor:** keyboard focus visible, `prefers-reduced-motion` respected (graph degrades to static highlight).
- **Existing style language:** `.glass` class, Cinzel (`font-display`) for headings, Inter (`font-sans`) for body, house glows. Extend, don't replace.
- **Test runner:** `npx vitest run <path>` for a file; `npx vitest run` for all.

---

## File Structure

- `lib/glossary.ts` (Create) — pure metadata + formatters. No React.
- `components/ui/Chip.tsx` (Create) — signature pill component.
- `lib/relicRarity.ts` (Create) — move `RELIC_RARITY_COLOR` here so non-component code can import it without pulling in a client component.
- `components/relics/RelicCard.tsx` (Modify) — import color from new module; add rarity Chip.
- `components/relics/RelicBar.tsx` (Modify) — import color from new module.
- `components/cards/WizardCard.tsx` (Modify) — expand spell block: desc + effect chips (no raw numbers).
- `components/screens/TeamScreen.tsx` (Modify) — synergy rows with bonus chips + member names.
- `components/screens/compendium/SynergyGraph.tsx` (Create) — deterministic SVG graph, the signature element.
- `components/screens/RulesScreen.tsx` (Modify) — rewrite as Compendio (glossary + lists + graph).
- `components/screens/MenuScreen.tsx` (Modify) — rename rules link to "Compendio".
- Tests: `tests/lib/glossary.test.ts`, `tests/ui/chip.test.tsx`, `tests/ui/synergyGraph.test.tsx`, plus additions to `tests/ui/wizardCard.test.tsx`, `tests/ui/teamScreen.test.tsx`, `tests/ui/screens.test.tsx`.

---

## Task 1: `lib/glossary.ts` — metadata + pure formatters

**Files:**
- Create: `lib/glossary.ts`
- Test: `tests/lib/glossary.test.ts`

**Interfaces:**
- Consumes: `Spell`, `SpellType`, `SpellEffect` from `@/types/spell`; `EffectSpec` from `@/types/status`; `SynergyBonus` from `@/types/synergy`.
- Produces:
  - `type IconName = 'Swords'|'Shield'|'HeartPulse'|'Wand2'|'Flame'|'Zap'|'Snowflake'|'VolumeX'|'Hand'|'Sparkles'|'ArrowUp'|'ArrowDown'|'CircleSlash'`
  - `interface ChipData { label: string; color: string; icon?: IconName }`
  - `const SPELL_TYPE_META: Record<SpellType, { color: string; icon: IconName; blurb: string }>`
  - `const EFFECT_META: Record<string, { label: string; color: string; icon: IconName; blurb: string }>` (keys: `'buff'|'debuff'|'dot'|'stun'|'freeze'|'silence'|'disarm'|'regen'|'shield'`)
  - `function spellTypeChip(type: SpellType): ChipData`
  - `function formatSpellStats(spell: Spell): Array<{ label: string; value: string }>`
  - `function spellEffectChips(spell: Spell): ChipData[]`
  - `function synergyBonusText(bonus: SynergyBonus): string[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/glossary.test.ts
import { describe, it, expect } from 'vitest'
import {
  SPELL_TYPE_META, EFFECT_META, spellTypeChip,
  formatSpellStats, spellEffectChips, synergyBonusText,
} from '@/lib/glossary'
import type { Spell } from '@/types/spell'

const atk: Spell = { id: 'x', name: 'X', desc: 'd', type: 'Attacco', power: 1.4, hitChance: 0.9, cooldown: 1 }
const heal: Spell = { id: 'h', name: 'H', desc: 'd', type: 'Cura', heal: 28, hitChance: 1, cooldown: 1 }
const dotSpell: Spell = { id: 'i', name: 'I', desc: 'd', type: 'Attacco', power: 1.2, hitChance: 0.9, cooldown: 1, effects: [{ kind: 'dot', amount: 8, duration: 2 }] }
const multi: Spell = { id: 'c', name: 'C', desc: 'd', type: 'Controllo', power: 0.8, hitChance: 0.85, cooldown: 2, effects: [{ kind: 'dot', amount: 10, duration: 2 }, { kind: 'debuff', stat: 'atk', amount: 10, duration: 2 }] }

describe('metadata', () => {
  it('covers all spell types', () => {
    expect(Object.keys(SPELL_TYPE_META).sort()).toEqual(['Attacco', 'Controllo', 'Cura', 'Difesa'])
  })
  it('covers all effect kinds', () => {
    for (const k of ['buff','debuff','dot','stun','freeze','silence','disarm','regen','shield']) {
      expect(EFFECT_META[k], k).toBeTruthy()
    }
  })
  it('spellTypeChip returns color + icon for a type', () => {
    const c = spellTypeChip('Cura')
    expect(c.label).toBe('Cura')
    expect(c.color).toBe(SPELL_TYPE_META.Cura.color)
    expect(c.icon).toBe(SPELL_TYPE_META.Cura.icon)
  })
})

describe('formatSpellStats', () => {
  it('shows power as a multiplier and precision as a percent', () => {
    expect(formatSpellStats(atk)).toEqual([
      { label: 'Potenza', value: '×1.4' },
      { label: 'Precisione', value: '90%' },
      { label: 'Ricarica', value: '1' },
    ])
  })
  it('shows heal instead of power and omits absent fields', () => {
    expect(formatSpellStats(heal)).toEqual([
      { label: 'Cura', value: '28' },
      { label: 'Precisione', value: '100%' },
      { label: 'Ricarica', value: '1' },
    ])
  })
})

describe('spellEffectChips', () => {
  it('returns nothing when no effects', () => {
    expect(spellEffectChips(atk)).toEqual([])
  })
  it('maps a single effect to a chip', () => {
    const chips = spellEffectChips(dotSpell)
    expect(chips).toHaveLength(1)
    expect(chips[0]!.label).toBe(EFFECT_META.dot!.label)
    expect(chips[0]!.color).toBe(EFFECT_META.dot!.color)
  })
  it('maps and de-dups multiple effect kinds', () => {
    const chips = spellEffectChips(multi)
    expect(chips.map(c => c.label)).toEqual([EFFECT_META.dot!.label, EFFECT_META.debuff!.label])
  })
  it('also reads the new spec[] applyStatus effects', () => {
    const s: Spell = { id: 's', name: 'S', desc: 'd', type: 'Controllo', hitChance: 0.9, spec: [{ kind: 'applyStatus', target: 'enemy', effect: { kind: 'freeze' } }] }
    expect(spellEffectChips(s).map(c => c.label)).toEqual([EFFECT_META.freeze!.label])
  })
})

describe('synergyBonusText', () => {
  it('formats flat stats', () => {
    expect(synergyBonusText({ atk: 10, def: 14 })).toEqual(['+10 ATK', '+14 DIF'])
  })
  it('formats allPct as a percent of all stats', () => {
    expect(synergyBonusText({ allPct: 0.15 })).toEqual(['+15% a tutte le statistiche'])
  })
  it('formats regen', () => {
    expect(synergyBonusText({ regen: 5 })).toEqual(['Rigenera 5/turno'])
  })
  it('returns empty array for an empty bonus', () => {
    expect(synergyBonusText({})).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/glossary.test.ts`
Expected: FAIL — `Cannot find module '@/lib/glossary'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/glossary.ts
import type { Spell, SpellType, SpellEffect, Stat } from '@/types/spell'
import type { EffectSpec } from '@/types/status'
import type { SynergyBonus } from '@/types/synergy'

export type IconName =
  | 'Swords' | 'Shield' | 'HeartPulse' | 'Wand2' | 'Flame' | 'Zap'
  | 'Snowflake' | 'VolumeX' | 'Hand' | 'Sparkles' | 'ArrowUp' | 'ArrowDown' | 'CircleSlash'

export interface ChipData { label: string; color: string; icon?: IconName }

export const SPELL_TYPE_META: Record<SpellType, { color: string; icon: IconName; blurb: string }> = {
  Attacco: { color: '#FF8A7A', icon: 'Swords', blurb: 'Infligge danno diretto al nemico.' },
  Difesa: { color: '#7DB7FF', icon: 'Shield', blurb: 'Protegge o rinforza chi la lancia.' },
  Cura: { color: '#7CFC9B', icon: 'HeartPulse', blurb: 'Ripristina punti vita.' },
  Controllo: { color: '#C98BFF', icon: 'Wand2', blurb: 'Limita o indebolisce il nemico.' },
}

export const EFFECT_META: Record<string, { label: string; color: string; icon: IconName; blurb: string }> = {
  buff: { label: 'Potenzia', color: '#7CFC9B', icon: 'ArrowUp', blurb: 'Aumenta una statistica per alcuni turni.' },
  debuff: { label: 'Indebolisce', color: '#FFB37D', icon: 'ArrowDown', blurb: 'Riduce una statistica per alcuni turni.' },
  dot: { label: 'Danno nel tempo', color: '#FF7A7A', icon: 'Flame', blurb: 'Infligge danno a ogni turno.' },
  stun: { label: 'Stordimento', color: '#C98BFF', icon: 'Zap', blurb: 'Salta il turno del bersaglio.' },
  freeze: { label: 'Congela', color: '#7DD3FF', icon: 'Snowflake', blurb: 'Blocca le azioni del bersaglio.' },
  silence: { label: 'Silenzio', color: '#B59CFF', icon: 'VolumeX', blurb: 'Impedisce di lanciare magie.' },
  disarm: { label: 'Disarma', color: '#FFD37D', icon: 'Hand', blurb: 'Impedisce gli attacchi.' },
  regen: { label: 'Rigenera', color: '#7CFC9B', icon: 'Sparkles', blurb: 'Recupera vita a ogni turno.' },
  shield: { label: 'Scudo', color: '#7DB7FF', icon: 'Shield', blurb: 'Assorbe danno in arrivo.' },
}

export function spellTypeChip(type: SpellType): ChipData {
  const m = SPELL_TYPE_META[type]
  return { label: type, color: m.color, icon: m.icon }
}

export function formatSpellStats(spell: Spell): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = []
  if (spell.power !== undefined) out.push({ label: 'Potenza', value: `×${spell.power}` })
  if (spell.heal !== undefined) out.push({ label: 'Cura', value: `${spell.heal}` })
  out.push({ label: 'Precisione', value: `${Math.round(spell.hitChance * 100)}%` })
  if (spell.cooldown !== undefined) out.push({ label: 'Ricarica', value: `${spell.cooldown}` })
  return out
}

function effectKinds(spell: Spell): string[] {
  const kinds: string[] = []
  for (const e of spell.effects ?? []) kinds.push(e.kind)
  for (const s of spell.spec ?? []) {
    if (s.kind === 'applyStatus') { if (s.effect?.kind) kinds.push(s.effect.kind) }
    else if (s.kind === 'shield') kinds.push('shield')
  }
  return kinds
}

export function spellEffectChips(spell: Spell): ChipData[] {
  const seen = new Set<string>()
  const out: ChipData[] = []
  for (const kind of effectKinds(spell)) {
    if (seen.has(kind)) continue
    seen.add(kind)
    const m = EFFECT_META[kind]
    out.push(m ? { label: m.label, color: m.color, icon: m.icon } : { label: kind, color: '#9aa3ad' })
  }
  return out
}

const STAT_LABEL: Record<Stat, string> = { hp: 'HP', atk: 'ATK', def: 'DIF', spd: 'VEL' }

export function synergyBonusText(bonus: SynergyBonus): string[] {
  const out: string[] = []
  for (const stat of ['hp', 'atk', 'def', 'spd'] as Stat[]) {
    const v = bonus[stat]
    if (v) out.push(`+${v} ${STAT_LABEL[stat]}`)
  }
  if (bonus.allPct) out.push(`+${Math.round(bonus.allPct * 100)}% a tutte le statistiche`)
  if (bonus.regen) out.push(`Rigenera ${bonus.regen}/turno`)
  return out
}
```

Note: `SpellEffect` and `EffectSpec` imports are used for type-checking the `spell.effects`/`spell.spec` access; keep them even if eslint flags them — adjust to type-only import if the linter complains. If `Stat` is not exported from `@/types/spell`, import it from wherever the type map in `types/spell.ts` defines it (it is declared there as `export type Stat`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/glossary.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/glossary.ts tests/lib/glossary.test.ts
git commit -m "feat(glossary): pure formatters + category metadata for spells/synergies"
```

---

## Task 2: `lib/relicRarity.ts` — extract rarity color

**Files:**
- Create: `lib/relicRarity.ts`
- Modify: `components/relics/RelicCard.tsx` (remove local `RELIC_RARITY_COLOR`, re-export from lib)
- Modify: `components/relics/RelicBar.tsx:3` (import path)

**Interfaces:**
- Produces: `const RELIC_RARITY_COLOR: Record<RelicRarity, string>` in `@/lib/relicRarity`.
- Consumes: `RelicRarity` from `@/types/relic`.

**Why:** Non-component code (the Compendio glossary, Task 6) needs the rarity color without importing a `'use client'` component. Keep `RelicCard`'s public export working via re-export so nothing else breaks.

- [ ] **Step 1: Read current color map**

Run: `grep -n "RELIC_RARITY_COLOR" components/relics/RelicCard.tsx`
Read the object literal (4 entries: comune/non-comune/rara/epica) to copy exact hex values.

- [ ] **Step 2: Create the lib module**

```ts
// lib/relicRarity.ts
import type { RelicRarity } from '@/types/relic'

export const RELIC_RARITY_COLOR: Record<RelicRarity, string> = {
  comune: '#9aa3ad',
  'non-comune': '#5fcf80',
  rara: '#4da6ff',
  epica: '#c98bff',
}
```

Verify the hex values match exactly what Step 1 printed; correct them if the source differs.

- [ ] **Step 3: Update RelicCard to re-export**

In `components/relics/RelicCard.tsx`, replace the local `export const RELIC_RARITY_COLOR = {...}` with:

```ts
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
export { RELIC_RARITY_COLOR }
```

Leave the rest of the component unchanged (the `const color = RELIC_RARITY_COLOR[relic.rarity]` usage still works).

- [ ] **Step 4: Run relic tests**

Run: `npx vitest run tests/ui/relicCard.test.tsx`
Expected: PASS (re-export keeps the existing import working).

- [ ] **Step 5: Typecheck + full UI smoke**

Run: `npx tsc --noEmit && npx vitest run tests/ui/relicCard.test.tsx`
Expected: no errors, PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/relicRarity.ts components/relics/RelicCard.tsx components/relics/RelicBar.tsx
git commit -m "refactor(relics): move RELIC_RARITY_COLOR to lib for non-component reuse"
```

---

## Task 3: `components/ui/Chip.tsx` — signature pill

**Files:**
- Create: `components/ui/Chip.tsx`
- Test: `tests/ui/chip.test.tsx`

**Interfaces:**
- Consumes: `IconName` from `@/lib/glossary`.
- Produces: `function Chip(props: { label: string; color: string; icon?: IconName; size?: 'sm' | 'md'; className?: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/chip.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chip } from '@/components/ui/Chip'

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip label="Stordimento" color="#C98BFF" />)
    expect(screen.getByText('Stordimento')).toBeInTheDocument()
  })
  it('renders with an icon without crashing', () => {
    render(<Chip label="Danno nel tempo" color="#FF7A7A" icon="Flame" />)
    expect(screen.getByText('Danno nel tempo')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/chip.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/Chip'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/ui/Chip.tsx
import * as Icons from 'lucide-react'
import type { IconName } from '@/lib/glossary'
import { cn } from '@/lib/cn'

export function Chip({
  label, color, icon, size = 'sm', className,
}: {
  label: string
  color: string
  icon?: IconName
  size?: 'sm' | 'md'
  className?: string
}) {
  const Icon = icon ? (Icons[icon] as React.ComponentType<{ size?: number }>) : null
  const px = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border font-medium', px, className)}
      style={{ color, borderColor: `${color}55`, background: `${color}14`, boxShadow: `0 0 12px ${color}22` }}
    >
      {Icon ? <Icon size={size === 'md' ? 14 : 12} /> : null}
      {label}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/chip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `Icons[icon]` typed access fails, the cast `as React.ComponentType<{ size?: number }>` already handles it; if lucide types are stricter, change the access to `(Icons as Record<string, React.ComponentType<{ size?: number }>>)[icon]`.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Chip.tsx tests/ui/chip.test.tsx
git commit -m "feat(ui): Chip — shared category pill (icon + label + color glow)"
```

---

## Task 4: WizardCard — inline spell detail (desc + effect chips)

**Files:**
- Modify: `components/cards/WizardCard.tsx:65-68`
- Test: `tests/ui/wizardCard.test.tsx` (add cases)

**Interfaces:**
- Consumes: `spellTypeChip`, `spellEffectChips` from `@/lib/glossary`; `Chip` from `@/components/ui/Chip`.
- Produces: nothing new (visual change to existing component).

**Constraint reminder:** NO raw numbers (potenza/precisione/ricarica) on the draft card — desc + effect chips only.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/wizardCard.test.tsx`. First check the file's existing imports/helpers; it already builds a `DraftedWizard`. Reuse that helper. Pick a drafted wizard whose spell has an effect (e.g. force the spell). Add:

```tsx
import { SPELLS } from '@/data/spells'
// ... inside describe('WizardCard', ...)
it('shows the spell description and an effect chip', () => {
  const incendio = SPELLS.find(s => s.id === 'incendio')!  // has a dot effect
  const drafted = { ...baseDrafted, spell: incendio }       // baseDrafted = existing fixture in this file
  render(<WizardCard drafted={drafted} />)
  expect(screen.getByText(incendio.desc)).toBeInTheDocument()
  expect(screen.getByText('Danno nel tempo')).toBeInTheDocument()
})
```

If the existing test file names its fixture differently (e.g. `sample`, `drafted`, `mk()`), use that name instead of `baseDrafted`. Read the top of the file first to find it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/wizardCard.test.tsx`
Expected: FAIL — description/chip text not found (card currently shows only type + name).

- [ ] **Step 3: Implement the expanded spell block**

In `components/cards/WizardCard.tsx`, add imports at top:

```tsx
import { Chip } from '@/components/ui/Chip'
import { spellTypeChip, spellEffectChips } from '@/lib/glossary'
```

Replace the spell block (lines 65-68):

```tsx
      <div className="relative mt-4 rounded-xl bg-black/30 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-white/50">{spell.type}</p>
        <p className="text-sm font-medium">{spell.name}</p>
      </div>
```

with:

```tsx
      <div className="relative mt-4 rounded-xl bg-black/30 px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{spell.name}</p>
          {(() => { const c = spellTypeChip(spell.type); return <Chip label={c.label} color={c.color} icon={c.icon} /> })()}
        </div>
        <p className="text-xs text-white/70 leading-snug">{spell.desc}</p>
        {(() => {
          const chips = spellEffectChips(spell)
          return chips.length ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {chips.map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
            </div>
          ) : null
        })()}
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/wizardCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + draft UI smoke**

Run: `npx tsc --noEmit && npx vitest run tests/ui/draftBoard.test.tsx tests/ui/cardParts.test.tsx`
Expected: no errors, PASS.

- [ ] **Step 6: Commit**

```bash
git add components/cards/WizardCard.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(card): inline spell desc + effect chips on WizardCard"
```

---

## Task 5: TeamScreen — synergy bonus + members

**Files:**
- Modify: `components/screens/TeamScreen.tsx:26-42`
- Test: `tests/ui/teamScreen.test.tsx` (add cases)

**Interfaces:**
- Consumes: `detectSynergies` (already imported), `synergyBonusText` from `@/lib/glossary`, `Chip` from `@/components/ui/Chip`, the `team: DraftedWizard[]` prop.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Read the top of `tests/ui/teamScreen.test.tsx` to find how it builds a team. It must build a team that triggers at least one synergy (e.g. 3 wizards of the same house, or the Golden Trio ids `harry`/`ron`/`hermione` if those are the ids — verify against `data/synergies.ts` `goldenTrio`). Add:

```tsx
import { synergyBonusText } from '@/lib/glossary'
import { detectSynergies } from '@/game/engine/synergy'
// ... inside describe('TeamScreen', ...)
it('shows synergy bonus text and member names', () => {
  render(<TeamScreen team={teamWithSynergy} />)  // teamWithSynergy = a team that triggers >=1 synergy
  const active = detectSynergies(teamWithSynergy)
  expect(active.length).toBeGreaterThan(0)
  const first = active[0]!
  // bonus text appears
  for (const t of synergyBonusText(first.synergy.bonus)) {
    expect(screen.getByText(t)).toBeInTheDocument()
  }
  // at least one member name appears
  const memberName = teamWithSynergy.find(d => first.memberIds.includes(d.wizard.id))!.wizard.name
  expect(screen.getAllByText(new RegExp(memberName)).length).toBeGreaterThan(0)
})
```

If the file has no helper to build a synergy-triggering team, build one inline from `WIZARDS`/`WIZARD_BY_ID` (`@/data/wizards`): pick 3 wizards sharing a house and wrap each as `{ wizard, stats: wizard.baseStats ?? {hp,atk,def,spd}, spell: SPELLS[0] }` matching the existing `DraftedWizard` fixture shape used elsewhere in the test file. Mirror the exact shape the file already uses.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/teamScreen.test.tsx`
Expected: FAIL — bonus text / member names not found (only synergy name rendered today).

- [ ] **Step 3: Implement synergy rows**

In `components/screens/TeamScreen.tsx`, add imports:

```tsx
import { synergyBonusText } from '@/lib/glossary'
import { Chip } from '@/components/ui/Chip'
```

Build a member-name lookup inside the component (after `const synergies = detectSynergies(team)`):

```tsx
  const nameById = new Map(team.map((d) => [d.wizard.id, d.wizard.name]))
```

Replace the synergy `<ul>...</ul>` block (the list rendering only `s.synergy.name`) with:

```tsx
          <ul className="flex flex-col gap-3">
            {synergies.map((s) => {
              const members = s.memberIds.map((id) => nameById.get(id)).filter(Boolean) as string[]
              return (
                <li key={s.synergy.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="font-display text-base">{s.synergy.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {synergyBonusText(s.synergy.bonus).map((t) => (
                      <Chip key={t} label={t} color="#7CFC9B" />
                    ))}
                  </div>
                  {members.length > 0 && (
                    <p className="mt-1.5 text-xs text-white/55">{members.join(' · ')}</p>
                  )}
                </li>
              )
            })}
          </ul>
```

Keep the empty-state branch (`Nessuna sinergia attiva.`) unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/teamScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/screens/TeamScreen.tsx tests/ui/teamScreen.test.tsx
git commit -m "feat(team): show synergy bonus breakdown + member names"
```

---

## Task 6: SynergyGraph — deterministic signature element

**Files:**
- Create: `components/screens/compendium/SynergyGraph.tsx`
- Test: `tests/ui/synergyGraph.test.tsx`

**Interfaces:**
- Consumes: `SYNERGIES` from `@/data/synergies`, `WIZARDS`/`WIZARD_BY_ID` from `@/data/wizards`, `synergyBonusText` from `@/lib/glossary`, `Synergy` type from `@/types/synergy`.
- Produces: `function SynergyGraph(): JSX.Element` (self-contained; reads global data, no props).

**Design:** A deterministic radial graph. Each synergy is a node placed on a circle by its index (angle = `i / count * 2π`); the wizards it involves are listed/linked from that node. Selecting (hover or keyboard focus) a synergy node highlights it and reveals its bonus + requirement in a side detail panel. No physics, no random — positions are pure functions of array index. `prefers-reduced-motion` → no transition animation (CSS handles via media query / `motion-reduce:` Tailwind variant).

Member resolution per synergy (mirror `game/engine/synergy.ts` logic, read-only): if `requires.ids` present → those ids; else all wizards matching `house`/`role`/`tag`. Provide a small local helper `synergyMemberIds(syn): string[]`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/synergyGraph.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SynergyGraph } from '@/components/screens/compendium/SynergyGraph'
import { SYNERGIES } from '@/data/synergies'
import { synergyBonusText } from '@/lib/glossary'

describe('SynergyGraph', () => {
  it('renders a node for every synergy', () => {
    render(<SynergyGraph />)
    for (const s of SYNERGIES) {
      expect(screen.getAllByText(s.name).length).toBeGreaterThan(0)
    }
  })
  it('reveals bonus text when a synergy is selected', async () => {
    render(<SynergyGraph />)
    const withBonus = SYNERGIES.find(s => synergyBonusText(s.bonus).length > 0)!
    await userEvent.click(screen.getAllByText(withBonus.name)[0]!)
    const bonus = synergyBonusText(withBonus.bonus)[0]!
    expect(screen.getByText(bonus)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/synergyGraph.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the graph**

```tsx
// components/screens/compendium/SynergyGraph.tsx
'use client'
import { useState } from 'react'
import { SYNERGIES } from '@/data/synergies'
import { WIZARDS } from '@/data/wizards'
import { synergyBonusText } from '@/lib/glossary'
import type { Synergy } from '@/types/synergy'

const KIND_COLOR: Record<Synergy['kind'], string> = {
  house: '#7DB7FF', role: '#FFD37D', group: '#C98BFF', origin: '#7CFC9B',
}

function synergyMemberIds(syn: Synergy): string[] {
  const req = syn.requires
  if (req.ids?.length) return req.ids
  return WIZARDS.filter((w) =>
    (req.house ? w.house === req.house : true) &&
    (req.role ? w.role === req.role : true) &&
    (req.tag ? (w.tags ?? []).includes(req.tag) : true),
  ).map((w) => w.id)
}

function requirementText(syn: Synergy): string {
  const req = syn.requires
  if (req.ids?.length) return `Richiede: ${req.ids.length} maghi specifici`
  const n = req.count ?? 3
  if (req.house) return `Richiede: ${n}+ ${req.house}`
  if (req.role) return `Richiede: ${n}+ ${req.role}`
  if (req.tag) return `Richiede: ${n}+ del gruppo`
  return ''
}

const R = 150
const CX = 200
const CY = 200

export function SynergyGraph() {
  const [selected, setSelected] = useState<string | null>(null)
  const nameById = new Map(WIZARDS.map((w) => [w.id, w.name]))
  const active = SYNERGIES.find((s) => s.id === selected) ?? null

  return (
    <div className="grid gap-6 md:grid-cols-[400px_1fr] items-start">
      <svg viewBox="0 0 400 400" className="w-full max-w-md mx-auto" role="img" aria-label="Grafo delle sinergie">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" />
        {SYNERGIES.map((s, i) => {
          const angle = (i / SYNERGIES.length) * Math.PI * 2 - Math.PI / 2
          const x = CX + R * Math.cos(angle)
          const y = CY + R * Math.sin(angle)
          const color = KIND_COLOR[s.kind]
          const isActive = s.id === selected
          return (
            <g key={s.id}
              tabIndex={0}
              role="button"
              aria-pressed={isActive}
              className="cursor-pointer outline-none focus-visible:opacity-100 motion-safe:transition-opacity"
              onClick={() => setSelected(s.id)}
              onFocus={() => setSelected(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(s.id) } }}
              opacity={selected && !isActive ? 0.35 : 1}
            >
              <circle cx={x} cy={y} r={isActive ? 10 : 7} fill={color}
                style={{ filter: `drop-shadow(0 0 ${isActive ? 10 : 4}px ${color})` }} />
              <text x={x} y={y - 14} textAnchor="middle" fontSize="9" fill="#e8ecf3">{s.name}</text>
            </g>
          )
        })}
      </svg>

      <div className="glass rounded-2xl p-5 min-h-[200px]">
        {active ? (
          <>
            <h3 className="font-display text-xl" style={{ color: KIND_COLOR[active.kind] }}>{active.name}</h3>
            <p className="mt-1 text-sm text-white/60">{requirementText(active)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {synergyBonusText(active.bonus).map((t) => (
                <span key={t} className="px-2.5 py-0.5 rounded-full text-xs border border-white/15 bg-white/5 text-white/85">{t}</span>
              ))}
            </div>
            <p className="mt-4 text-xs uppercase tracking-wider text-white/40">Maghi coinvolti</p>
            <p className="mt-1 text-sm text-white/70">
              {synergyMemberIds(active).map((id) => nameById.get(id)).filter(Boolean).join(' · ')}
            </p>
          </>
        ) : (
          <p className="text-white/55 text-sm">Seleziona una sinergia nel grafo per vederne il bonus e i maghi coinvolti.</p>
        )}
      </div>
    </div>
  )
}
```

Note: the test asserts each synergy name renders — the `<text>` inside each node provides that. If `w.tags` is not a field on the wizard type, drop the `req.tag` branch's `.tags` access and match only house/role (verify `Wizard` type has `tags?: string[]`; the engine `synergy.ts` uses `d.wizard.tags ?? []`, so it exists).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/synergyGraph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/screens/compendium/SynergyGraph.tsx tests/ui/synergyGraph.test.tsx
git commit -m "feat(compendium): deterministic interactive synergy graph"
```

---

## Task 7: RulesScreen → Compendio (glossary + lists + graph)

**Files:**
- Modify: `components/screens/RulesScreen.tsx` (rewrite body, keep export name `RulesScreen`)
- Test: `tests/ui/screens.test.tsx` (add Compendio cases) — confirm the file already renders `RulesScreen`; if not, add a focused block.

**Interfaces:**
- Consumes: `SPELLS` (`@/data/spells`), `RELICS` (`@/data/relics`), `SPELL_TYPE_META`, `EFFECT_META`, `formatSpellStats`, `spellEffectChips` (`@/lib/glossary`), `RELIC_RARITY_COLOR` (`@/lib/relicRarity`), `Chip` (`@/components/ui/Chip`), `SynergyGraph` (Task 6).
- Produces: nothing new (component rewrite).

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/screens.test.tsx`:

```tsx
import { SPELLS } from '@/data/spells'
import { EFFECT_META, SPELL_TYPE_META } from '@/lib/glossary'
// ... 
describe('Compendio (RulesScreen)', () => {
  it('renders the glossary terms', () => {
    render(<RulesScreen />)
    // a spell-type term and an effect term from the glossary
    expect(screen.getAllByText(SPELL_TYPE_META.Controllo ? 'Controllo' : '').length).toBeGreaterThan(0)
    expect(screen.getAllByText(EFFECT_META.stun!.label).length).toBeGreaterThan(0)
  })
  it('lists every spell by name', () => {
    render(<RulesScreen />)
    for (const s of SPELLS) {
      expect(screen.getAllByText(s.name).length).toBeGreaterThan(0)
    }
  })
})
```

(`RulesScreen` import should already exist in this file; if not, add `import { RulesScreen } from '@/components/screens/RulesScreen'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/screens.test.tsx`
Expected: FAIL — glossary/spell names not found (current page is 5 paragraphs).

- [ ] **Step 3: Rewrite RulesScreen**

Replace the whole file with:

```tsx
'use client'
import Link from 'next/link'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Chip } from '@/components/ui/Chip'
import { SynergyGraph } from '@/components/screens/compendium/SynergyGraph'
import { SPELLS } from '@/data/spells'
import { RELICS } from '@/data/relics'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import {
  SPELL_TYPE_META, EFFECT_META, formatSpellStats, spellEffectChips,
} from '@/lib/glossary'
import type { SpellType } from '@/types/spell'
import type { RelicRarity } from '@/types/relic'

const HOW_TO_PLAY: Array<{ title: string; body: string }> = [
  { title: 'Draft', body: 'Scegli 1 mago tra 5 carte. Ripeti finché la tua squadra ha 5 maghi. Le carte non scelte vengono scartate.' },
  { title: 'Tier', body: 'Tier 1 Leggendario (raro e forte) → Tier 4 Comune. Mai più di un Tier 1 per schermata; ogni schermata garantisce almeno un Tier alto.' },
  { title: 'Combattimento', body: 'Le battaglie sono simulate automaticamente e in modo deterministico: velocità, danni, critici, schivate, cure e sinergie decidono il vincitore.' },
]

const SPELL_TYPE_ORDER: SpellType[] = ['Attacco', 'Difesa', 'Cura', 'Controllo']
const RARITY_ORDER: RelicRarity[] = ['comune', 'non-comune', 'rara', 'epica']

export function RulesScreen() {
  return (
    <main className="flex-1 flex flex-col items-center gap-10 p-8 max-w-4xl mx-auto w-full">
      <header className="text-center mt-6">
        <h1 className="font-display text-4xl">Compendio</h1>
        <p className="mt-2 text-white/60 text-sm max-w-xl mx-auto">
          Tutto ciò che serve sapere: come si gioca, cosa fanno le magie, le reliquie e le sinergie.
        </p>
      </header>

      {/* Come si gioca */}
      <section className="w-full grid gap-4 md:grid-cols-3">
        {HOW_TO_PLAY.map((s) => (
          <GlowPanel key={s.title} className="p-5 text-left">
            <h2 className="font-display text-lg mb-1">{s.title}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{s.body}</p>
          </GlowPanel>
        ))}
      </section>

      {/* Glossario */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-4">Glossario</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <GlowPanel className="p-5">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Tipi di magia</p>
            <ul className="space-y-2">
              {SPELL_TYPE_ORDER.map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <Chip label={t} color={SPELL_TYPE_META[t].color} icon={SPELL_TYPE_META[t].icon} />
                  <span className="text-sm text-white/65">{SPELL_TYPE_META[t].blurb}</span>
                </li>
              ))}
            </ul>
          </GlowPanel>
          <GlowPanel className="p-5">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Effetti</p>
            <ul className="space-y-2">
              {Object.entries(EFFECT_META).map(([k, m]) => (
                <li key={k} className="flex items-center gap-3">
                  <Chip label={m.label} color={m.color} icon={m.icon} />
                  <span className="text-sm text-white/65">{m.blurb}</span>
                </li>
              ))}
            </ul>
          </GlowPanel>
        </div>
      </section>

      {/* Magie */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-4">Magie</h2>
        <div className="space-y-6">
          {SPELL_TYPE_ORDER.map((type) => {
            const spells = SPELLS.filter((s) => s.type === type)
            if (!spells.length) return null
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Chip label={type} color={SPELL_TYPE_META[type].color} icon={SPELL_TYPE_META[type].icon} size="md" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {spells.map((s) => (
                    <GlowPanel key={s.id} className="p-4">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-white/65 mt-0.5">{s.desc}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
                        {formatSpellStats(s).map((st) => (
                          <span key={st.label}><span className="text-white/40">{st.label}</span> {st.value}</span>
                        ))}
                      </div>
                      {spellEffectChips(s).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {spellEffectChips(s).map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
                        </div>
                      )}
                    </GlowPanel>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Reliquie */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-4">Reliquie</h2>
        <div className="space-y-6">
          {RARITY_ORDER.map((rarity) => {
            const relics = RELICS.filter((r) => r.rarity === rarity)
            if (!relics.length) return null
            return (
              <div key={rarity}>
                <div className="mb-2">
                  <Chip label={rarity} color={RELIC_RARITY_COLOR[rarity]} size="md" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {relics.map((r) => (
                    <GlowPanel key={r.id} className="p-4">
                      <p className="font-medium" style={{ color: RELIC_RARITY_COLOR[rarity] }}>{r.name}</p>
                      <p className="text-xs text-white/70 mt-0.5">{r.desc}</p>
                    </GlowPanel>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Sinergie — signature */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-1">Sinergie</h2>
        <p className="text-white/55 text-sm mb-4">Combina case, ruoli e gruppi per bonus potenti. Esplora il grafo.</p>
        <SynergyGraph />
      </section>

      <Link href="/" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">← Indietro al menu</Link>
    </main>
  )
}
```

If `EFFECT_META` iteration order matters for the test, `Object.entries` preserves insertion order — the `stun` label will be present regardless.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/screens.test.tsx tests/ui/synergyGraph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/screens/RulesScreen.tsx tests/ui/screens.test.tsx
git commit -m "feat(compendium): rewrite /rules as Compendio (glossary, lists, synergy graph)"
```

---

## Task 8: MenuScreen — rename link to "Compendio"

**Files:**
- Modify: `components/screens/MenuScreen.tsx`
- Test: `tests/ui/screens.test.tsx` (adjust/add)

**Interfaces:**
- Consumes/Produces: nothing new — copy change on the existing `/rules` link.

- [ ] **Step 1: Locate the link**

Run: `grep -n "rules\|Regole" components/screens/MenuScreen.tsx`
Expected: a `<Link href="/rules">Regole</Link>` (or similar label).

- [ ] **Step 2: Write/adjust the test**

In `tests/ui/screens.test.tsx`, in the MenuScreen block (find existing `Regole` assertion if any), assert the new label:

```tsx
it('links to the Compendio', () => {
  render(<MenuScreen />)  // pass any required props the existing test uses
  expect(screen.getByText('Compendio')).toBeInTheDocument()
})
```

If an existing test asserts `Regole`, update it to `Compendio` in the same step.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/ui/screens.test.tsx`
Expected: FAIL — `Compendio` link text not found (still says `Regole`).

- [ ] **Step 4: Rename the link label**

In `components/screens/MenuScreen.tsx`, change the link text from `Regole` to `Compendio` (keep `href="/rules"`).

- [ ] **Step 5: Run test + full suite**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/screens/MenuScreen.tsx tests/ui/screens.test.tsx
git commit -m "feat(menu): rename Regole link to Compendio"
```

---

## Self-Review

**Spec coverage:**
- `lib/glossary.ts` formatters + metadata → Task 1 ✓
- `Chip` signature component → Task 3 ✓
- WizardCard inline (desc + chips, no numbers) → Task 4 ✓
- TeamScreen bonus + members → Task 5 ✓
- Relic rarity chip / color reuse → Task 2 (+ used in Task 7) ✓
- Compendio glossary + complete lists → Task 7 ✓
- Synergy graph signature → Task 6 (rendered in Task 7) ✓
- Menu link → Task 8 ✓
- Determinism (no random in graph) → Task 6 layout is index-based ✓
- reduced-motion → Task 6 `motion-safe:`/`motion-reduce` ✓

**Placeholder scan:** No TBD/TODO. Every code step has full code. Test fixtures reference real ids (`incendio`, `goldenTrio`) verified against data during planning.

**Type consistency:** `IconName`, `ChipData`, formatter names (`formatSpellStats`, `spellEffectChips`, `synergyBonusText`, `spellTypeChip`) consistent across Tasks 1/3/4/5/6/7. `RELIC_RARITY_COLOR` single definition (Task 2) reused in Tasks 7. `Chip` props identical everywhere.

**Known verify-points for the implementer (called out inline):** exact `RELIC_RARITY_COLOR` hex (Task 2 step 1), existing test fixture names in `wizardCard`/`teamScreen` test files (Tasks 4/5), `Wizard.tags` field presence (Task 6), MenuScreen current link label (Task 8).
