# House-Synergy Tag: Effect Text + House Colors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every house-synergy tag informative — show its actual combat effect as text (derived from the real `houseEffects` values) and tint house tags with their house color — across all UI surfaces, from a single source.

**Architecture:** `synergyBonusText` takes the full `Synergy` (not just `bonus`) and, for `kind:'house'` synergies, appends an effect line derived from a new pure `houseEffectText(house, tier)` in `houseEffects.ts`. For color, a new `synergyTagColors(synergy)` helper (in `lib/glossary.ts`) returns per-tag border/bg/ink/mark, using the EXISTING canonical house palette `HOUSES` in `data/houses.ts` for house synergies and the current gold for everything else. Six render sites switch to the full `Synergy` and (where they show pills) the color helper.

**Tech Stack:** TypeScript, React 19 / Next.js (custom fork), Vitest. Presentation-only — no engine/balance changes.

## Global Constraints

- **Single source.** Effect text derives from the real values in `game/engine/houseEffects.ts` (so text tracks balance, never diverges). House colors come from the existing `HOUSES` map in `data/houses.ts` (Grifondoro `#ae0001`/glow `#ffc500`, Serpeverde `#1a472a`/`#aaaaaa`, Corvonero `#222f5b`/`#946b2d`, Tassorosso `#ecb939`/`#372e29`) — DO NOT invent colors or duplicate the palette.
- **Honest text** (per the synergy audit): the text must describe what actually happens. House effects per tier (tier index 0/1/2 = 2/3/4 members), exact values from `houseEffects.ts`: Grifondoro `GRYFF_DODGE=[0.04,0.08,0.14]`; Corvonero `RAVEN_CRIT=[{0.18,0.70},{0.26,1.00},{0.36,1.30}]` (chance, extra-mult); Tassorosso `HUFF_REDUCE=[0.10,0.16,0.24]`; Serpeverde `SLYTH_CUNNING=[{0.5,0.10},{0.5,0.18},{0.5,0.28}]` (threshold, bonus-vs-wounded).
- **Approved phrasing:** `Schivata +8%` / `Critico 26% (×2.0)` / `Riduzione danno 16%` / `+18% danno a feriti`. (Corvonero multiplier shown as `×(1+mult)`: mult 0.70/1.00/1.30 → ×1.7/×2.0/×2.3.)
- **Only house tags get house color;** role/group/origin tags stay exactly the current gold (`border rgba(202,162,74,0.6)`, `bg rgba(176,141,87,0.16)`, `ink #f3e6c4`, `mark #caa24a`) — zero visual regression for non-house tags.
- **Text stays light** on all houses (Tassorosso's color `#ecb939` is light but its glow `#372e29` is dark — use the house `color` for border/tint, never for the text ink).
- **Color is additive** to the tag's name+text (accessibility: never the sole information carrier).
- **Vitest does NOT typecheck.** Run `npx tsc --noEmit` separately after any `.ts`/`.tsx` change. (memory: harry-draft-vitest-no-typecheck)
- **No import cycle:** `lib/glossary.ts` will import from `game/engine/houseEffects.ts` and `data/houses.ts`. Both are leaf-ish (houseEffects imports only types + data; houses imports only types) and neither imports glossary → no cycle. Confirm with `npx tsc --noEmit`.
- **One vitest invocation at a time** (CPU saturation → phantom timeouts; re-run a timeout alone). (memory)

## Deviation from spec (noted)
The spec proposed extracting `CREST` from `HouseCrest.tsx` into a new `lib/houseTheme.ts`. During grounding I found a **pre-existing canonical house palette** at `data/houses.ts` (`HOUSES`, used by `lib/theme.ts:houseTheme`). Using it is DRYer than introducing a new module or extracting CREST. This plan uses `HOUSES`/`houseTheme` and does NOT create `lib/houseTheme.ts` or touch `HouseCrest.tsx`. Same outcome (single source), less surface.

## File Structure
- `game/engine/houseEffects.ts` — **modify.** Export `houseEffectText(house, tier)` (pure formatter reading the existing private constants). No mechanic change.
- `lib/glossary.ts` — **modify.** `synergyBonusText(synergy: Synergy)` (signature change; append house line). Add `synergyTagColors(synergy)` returning `{border,bg,ink,mark}`.
- `components/run/TeamSynergyBar.tsx`, `components/battle/SynergyRibbon.tsx` — **modify.** Pills: pass `Synergy`; apply `synergyTagColors`.
- `components/draft/SynergyTracker.tsx`, `components/screens/RecruitScreen.tsx`, `components/screens/TeamScreen.tsx`, `components/screens/compendium/SynergyGraph.tsx` — **modify.** Pass `Synergy` to `synergyBonusText`; tint house tags where they show a tag (Part B applies the helper or the house color to the house-tag's accent).
- Tests: `tests/engine/houseEffectText.test.ts`, `tests/lib/synergyText.test.ts`, `tests/lib/synergyTagColors.test.ts`.

---

## Task 1: `houseEffectText(house, tier)` in houseEffects.ts

**Files:**
- Modify: `game/engine/houseEffects.ts` (add export; read existing constants)
- Test: `tests/engine/houseEffectText.test.ts` (new)

**Interfaces:**
- Consumes: existing private `GRYFF_DODGE`, `RAVEN_CRIT`, `HUFF_REDUCE`, `SLYTH_CUNNING` (lines 20-23), `House` type.
- Produces: `export function houseEffectText(house: House, tier: 0 | 1 | 2): string`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/houseEffectText.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { houseEffectText } from '@/game/engine/houseEffects'

describe('houseEffectText', () => {
  it('Grifondoro: dodge % per tier', () => {
    expect(houseEffectText('Grifondoro', 0)).toBe('Schivata +4%')
    expect(houseEffectText('Grifondoro', 1)).toBe('Schivata +8%')
    expect(houseEffectText('Grifondoro', 2)).toBe('Schivata +14%')
  })
  it('Corvonero: crit chance + total multiplier per tier', () => {
    expect(houseEffectText('Corvonero', 0)).toBe('Critico 18% (×1.7)')
    expect(houseEffectText('Corvonero', 1)).toBe('Critico 26% (×2.0)')
    expect(houseEffectText('Corvonero', 2)).toBe('Critico 36% (×2.3)')
  })
  it('Tassorosso: damage reduction % per tier', () => {
    expect(houseEffectText('Tassorosso', 0)).toBe('Riduzione danno 10%')
    expect(houseEffectText('Tassorosso', 1)).toBe('Riduzione danno 16%')
    expect(houseEffectText('Tassorosso', 2)).toBe('Riduzione danno 24%')
  })
  it('Serpeverde: bonus damage vs wounded per tier', () => {
    expect(houseEffectText('Serpeverde', 0)).toBe('+10% danno a feriti')
    expect(houseEffectText('Serpeverde', 1)).toBe('+18% danno a feriti')
    expect(houseEffectText('Serpeverde', 2)).toBe('+28% danno a feriti')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/houseEffectText.test.ts`
Expected: FAIL — `houseEffectText is not exported`.

- [ ] **Step 3: Add the export**

In `game/engine/houseEffects.ts`, after the constants (line ~23) add (it needs `House` — already imported on line 1):

```ts
/** Human-readable effect text for a house synergy at a tier (0/1/2 = 2/3/4 members).
 *  Derived from the real mechanic constants above, so UI copy tracks balance. */
export function houseEffectText(house: House, tier: 0 | 1 | 2): string {
  switch (house) {
    case 'Grifondoro': return `Schivata +${Math.round(GRYFF_DODGE[tier]! * 100)}%`
    case 'Corvonero': {
      const c = RAVEN_CRIT[tier]!
      return `Critico ${Math.round(c.chance * 100)}% (×${(1 + c.mult).toFixed(1)})`
    }
    case 'Tassorosso': return `Riduzione danno ${Math.round(HUFF_REDUCE[tier]! * 100)}%`
    case 'Serpeverde': return `+${Math.round(SLYTH_CUNNING[tier]!.bonus * 100)}% danno a feriti`
  }
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/engine/houseEffectText.test.ts`
Expected: tsc clean, 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine/houseEffects.ts tests/engine/houseEffectText.test.ts
git commit -m "feat(house-tag): houseEffectText — derive effect copy from real values"
```

---

## Task 2: `synergyBonusText(synergy)` appends the house line

**Files:**
- Modify: `lib/glossary.ts:86-95` (signature change + house branch)
- Test: `tests/lib/synergyText.test.ts` (new)

**Interfaces:**
- Consumes: `houseEffectText` (Task 1), `Synergy`/`House` types, existing `STAT_LABEL`.
- Produces: `export function synergyBonusText(synergy: Synergy): string[]` (was `(bonus: SynergyBonus)`).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/synergyText.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { synergyBonusText } from '@/lib/glossary'
import { SYNERGIES } from '@/data/synergies'

const byId = (id: string) => SYNERGIES.find(s => s.id === id)!

describe('synergyBonusText with full Synergy', () => {
  it('role synergy: stat bonus unchanged', () => {
    expect(synergyBonusText(byId('attackers3'))).toEqual(['+15 ATK'])
  })
  it('house synergy (empty bonus): shows the derived house effect', () => {
    expect(synergyBonusText(byId('gryffindor3'))).toEqual(['Schivata +8%'])
    expect(synergyBonusText(byId('ravenclaw3'))).toEqual(['Critico 26% (×2.0)'])
  })
  it('Tassorosso: shows BOTH regen (bonus) and damage reduction (house effect)', () => {
    expect(synergyBonusText(byId('hufflepuff3'))).toEqual(['Rigenera 12/turno', 'Riduzione danno 16%'])
  })
  it('group synergy with allPct: unchanged', () => {
    expect(synergyBonusText(byId('goldenTrio'))).toEqual(['+15% a tutte le statistiche'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/synergyText.test.ts`
Expected: FAIL — current signature takes `bonus`; passing a `Synergy` is a type error and house cases return `[]`.

- [ ] **Step 3: Change the signature + add the house branch**

In `lib/glossary.ts`: update the import line 3 to also import `Synergy` and `House`, and import `houseEffectText`:

```ts
import type { SynergyBonus, Synergy } from '@/types/synergy'
import type { House } from '@/types/wizard'
import { houseEffectText } from '@/game/engine/houseEffects'
```

Replace `synergyBonusText` (lines 86-95):

```ts
export function synergyBonusText(synergy: Synergy): string[] {
  const out: string[] = []
  const bonus: SynergyBonus = synergy.bonus
  for (const stat of ['hp', 'atk', 'def', 'spd'] as Stat[]) {
    const v = bonus[stat]
    if (v) out.push(`+${v} ${STAT_LABEL[stat]}`)
  }
  if (bonus.allPct) out.push(`+${Math.round(bonus.allPct * 100)}% a tutte le statistiche`)
  if (bonus.regen) out.push(`Rigenera ${bonus.regen}/turno`)
  // House synergies carry their effect in houseEffects (empty stat bonus) — derive its text.
  if (synergy.kind === 'house' && synergy.requires.house) {
    const tier = (synergy.requires.count ?? 2) - 2
    if (tier >= 0 && tier <= 2) out.push(houseEffectText(synergy.requires.house as House, tier as 0 | 1 | 2))
  }
  return out
}
```

- [ ] **Step 4: Run test + typecheck (expect call-site type errors — that's the signal for Task 3)**

Run: `npx vitest run tests/lib/synergyText.test.ts`
Expected: 4 tests PASS.
Run: `npx tsc --noEmit`
Expected: ERRORS at the 6 call-sites still passing `.bonus` (a `SynergyBonus` where `Synergy` is now required). This is expected — Task 3 fixes them. (Do NOT fix call-sites here; this task's deliverable is the function + its unit test. Note the tsc errors are all "argument of type SynergyBonus is not assignable to Synergy" at the call sites.)

- [ ] **Step 5: Commit**

```bash
git add lib/glossary.ts tests/lib/synergyText.test.ts
git commit -m "feat(house-tag): synergyBonusText takes full Synergy, appends house effect line"
```

---

## Task 3: Update the 6 call-sites to pass the full Synergy

**Files:**
- Modify: `components/run/TeamSynergyBar.tsx:10`, `components/battle/SynergyRibbon.tsx:40`, `components/draft/SynergyTracker.tsx:50`, `components/screens/RecruitScreen.tsx:58`, `components/screens/TeamScreen.tsx:49`, `components/screens/compendium/SynergyGraph.tsx:84`
- Test: existing screen tests (run them).

**Interfaces:**
- Consumes: `synergyBonusText(synergy)` (Task 2).

- [ ] **Step 1: Update each call-site (text argument only — color is Task 4/5)**

Each currently passes a `bonus`; change to the `Synergy` it already has:

- `TeamSynergyBar.tsx:10` — change `const bonus = s.synergy.bonus ? synergyBonusText(s.synergy.bonus).join(' · ') : ''` to:
  ```tsx
  const bonus = synergyBonusText(s.synergy).join(' · ')
  ```
  (the `s.synergy.bonus ?` guard is obsolete — the function always returns an array.)
- `SynergyRibbon.tsx:40` — change `synergyBonusText(s.synergy.bonus)` to `synergyBonusText(s.synergy)`.
- `SynergyTracker.tsx:50` — change `synergyBonusText(r.synergy.bonus)` to `synergyBonusText(r.synergy)`.
- `RecruitScreen.tsx:58` — change `synergyBonusText(p.synergy.bonus)` to `synergyBonusText(p.synergy)`.
- `TeamScreen.tsx:49` — change `synergyBonusText(s.synergy.bonus)` to `synergyBonusText(s.synergy)`.
- `SynergyGraph.tsx:84` — change `synergyBonusText(active.bonus)` to `synergyBonusText(active)`. (Verify `active` is the full `Synergy` object — it is the selected synergy node; if it's a derived shape, pass the underlying synergy.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: CLEAN (all 6 call-sites now pass `Synergy`).

- [ ] **Step 3: Run the touched screen/UI tests**

Run: `npx vitest run tests/screens/RecruitScreen.test.tsx tests/screens/teamScreen.test.tsx tests/draft tests/ui`
Expected: PASS. If any test asserted the ABSENCE of effect text on a house tag, it now appears — update that assertion to expect the derived text (e.g. a Grifondoro tag now shows `Schivata +X%`). Regenerate such assertions to match the new (correct) behavior; do not weaken.

- [ ] **Step 4: Commit**

```bash
git add components/ tests/
git commit -m "feat(house-tag): pass full Synergy to synergyBonusText at all call-sites"
```

---

## Task 4: `synergyTagColors(synergy)` helper

**Files:**
- Modify: `lib/glossary.ts` (add helper)
- Test: `tests/lib/synergyTagColors.test.ts` (new)

**Interfaces:**
- Consumes: `HOUSES` (`data/houses.ts`), `Synergy`/`House` types.
- Produces: `export function synergyTagColors(synergy: Synergy): { border: string; bg: string; ink: string; mark: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/synergyTagColors.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { synergyTagColors } from '@/lib/glossary'
import { SYNERGIES } from '@/data/synergies'
import { HOUSES } from '@/data/houses'

const byId = (id: string) => SYNERGIES.find(s => s.id === id)!
const GOLD = { border: 'rgba(202,162,74,0.6)', bg: 'rgba(176,141,87,0.16)', ink: '#f3e6c4', mark: '#caa24a' }

describe('synergyTagColors', () => {
  it('house synergy uses its house color for border, light ink', () => {
    const c = synergyTagColors(byId('slytherin3'))
    expect(c.border).toBe(HOUSES.Serpeverde.color) // #1a472a
    expect(c.ink).toBe('#f3e6c4')                   // text stays light
    expect(c.bg).toBe(`${HOUSES.Serpeverde.color}28`)
  })
  it('each house maps to its own color', () => {
    expect(synergyTagColors(byId('gryffindor4')).border).toBe(HOUSES.Grifondoro.color)
    expect(synergyTagColors(byId('ravenclaw2')).border).toBe(HOUSES.Corvonero.color)
    expect(synergyTagColors(byId('hufflepuff3')).border).toBe(HOUSES.Tassorosso.color)
  })
  it('non-house synergies stay gold (no regression)', () => {
    expect(synergyTagColors(byId('attackers3'))).toEqual(GOLD)
    expect(synergyTagColors(byId('goldenTrio'))).toEqual(GOLD)
    expect(synergyTagColors(byId('tossicita'))).toEqual(GOLD)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/synergyTagColors.test.ts`
Expected: FAIL — `synergyTagColors is not exported`.

- [ ] **Step 3: Add the helper**

In `lib/glossary.ts`, add the import and the helper (reuse the existing `House`/`Synergy` imports from Task 2):

```ts
import { HOUSES } from '@/data/houses'
```

```ts
const SYNERGY_GOLD = { border: 'rgba(202,162,74,0.6)', bg: 'rgba(176,141,87,0.16)', ink: '#f3e6c4', mark: '#caa24a' }

/** Tag pill colors for a synergy: house synergies tint with their house color
 *  (border + low-opacity bg + house-glow accent mark), keeping light ink; every
 *  other kind keeps the standard gold. */
export function synergyTagColors(synergy: Synergy): { border: string; bg: string; ink: string; mark: string } {
  if (synergy.kind === 'house' && synergy.requires.house) {
    const h = HOUSES[synergy.requires.house as House]
    return { border: h.color, bg: `${h.color}28`, ink: '#f3e6c4', mark: h.glow }
  }
  return SYNERGY_GOLD
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/lib/synergyTagColors.test.ts`
Expected: tsc clean, 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/glossary.ts tests/lib/synergyTagColors.test.ts
git commit -m "feat(house-tag): synergyTagColors — house palette for house tags, gold otherwise"
```

---

## Task 5: Apply house colors at the pill render-sites

**Files:**
- Modify: `components/run/TeamSynergyBar.tsx`, `components/battle/SynergyRibbon.tsx`, `components/draft/SynergyTracker.tsx`
- Test: existing UI/draft tests.

**Interfaces:**
- Consumes: `synergyTagColors` (Task 4).

**Note:** The three sites have different tag shapes. TeamSynergyBar + SynergyRibbon render gold PILLS (replace inline gold with the helper). SynergyTracker renders a CARD whose border/bg is the active-gold — tint the house ones. RecruitScreen/TeamScreen/SynergyGraph use their own green/emerald/neutral theming for the surrounding item and are OUT of scope for color (Part B targets the gold pills; leave those three as-is for color — they already got the text in Task 3). This keeps the change focused on the gold-pill surfaces where house tint reads clearly.

- [ ] **Step 1: TeamSynergyBar pill → helper colors**

In `components/run/TeamSynergyBar.tsx`, import and apply. Add `import { synergyBonusText, synergyTagColors } from '@/lib/glossary'` (extend existing import). In `SynergyChip`, compute `const c = synergyTagColors(s.synergy)` and replace the pill style + mark:

```tsx
      style={{ color: c.ink, borderColor: c.border, background: c.bg }}
    >
      <span aria-hidden style={{ color: c.mark }}>✦</span>
```

- [ ] **Step 2: SynergyRibbon pill → helper colors**

In `components/battle/SynergyRibbon.tsx`, import `synergyTagColors` (extend the `synergyBonusText` import). For each synergy pill (around line 33-41), compute `const c = synergyTagColors(s.synergy)` and replace the hardcoded `style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}` with `style={{ color: c.ink, borderColor: c.border, background: c.bg }}`, and the `✦` mark color `style={{ color: '#caa24a' }}` → `style={{ color: c.mark }}`. (Relic pills are unchanged.)

- [ ] **Step 3: SynergyTracker card → tint house cards**

In `components/draft/SynergyTracker.tsx`, import `synergyTagColors`. The card style (lines 60-61) currently uses gold when `r.active || activates`. For a house synergy that is active/activating, use its house border/bg instead. Compute before the return: `const c = synergyTagColors(r.synergy)` and, in the `style`, when active/activates and not superseded, use the house color:

```tsx
                borderColor: isSuperseded ? '#241f38' : r.active || activates ? c.border : '#241f38',
                background: isSuperseded ? 'rgba(255,255,255,0.02)' : r.active || activates ? c.bg : 'rgba(255,255,255,0.02)',
```
(For non-house synergies `c.border`/`c.bg` are the gold values, so non-house cards are visually unchanged.)

- [ ] **Step 4: Typecheck + touched tests**

Run: `npx tsc --noEmit`
Expected: clean.
Run: `npx vitest run tests/draft tests/ui tests/screens/teamScreen.test.tsx`
Expected: PASS. If a test pinned a tag's exact gold border/bg on a HOUSE synergy, update it to the house color (correct new behavior); non-house assertions must remain unchanged (verifies no regression).

- [ ] **Step 5: Commit**

```bash
git add components/
git commit -m "feat(house-tag): tint house-synergy pills/cards with house colors"
```

---

## Task 6: Full-suite verify + backlog doc

**Files:**
- Modify: `docs/superpowers/specs/2026-06-30-house-synergy-effect-text-design.md` (closing note).

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run` (ONE invocation, let it finish).
Expected: tsc clean; full suite green. Re-run any timeout failure in isolation to confirm it's a load flake. Report the real pass count.

- [ ] **Step 2: Close the spec**

Append a "## Stato finale (implementato)" section: Part A shipped (house effect text derived from houseEffects values, shown at all 6 call-sites; Tassorosso shows regen + reduction), Part B shipped (house pills/cards tinted via `HOUSES` palette at the 3 gold-pill sites: TeamSynergyBar/SynergyRibbon/SynergyTracker; Recruit/Team/SynergyGraph kept their own theming and received only the text). Note the deviation: reused `data/houses.ts` `HOUSES` instead of extracting CREST. Note the synergy audit (separate) confirmed 34/34 synergies are wired, so the displayed effects are honest.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-30-house-synergy-effect-text-design.md
git commit -m "docs(house-tag): close slice — effect text + house colors shipped"
```

---

## Self-Review Notes (spec coverage)

- Part A §"testo effetto derivato" → Task 1 (`houseEffectText`) + Task 2 (`synergyBonusText(synergy)`) + Task 3 (call-sites). ✅
- Part A "Tassorosso mostra regen + riduzione" → Task 2 test asserts both. ✅
- Part B §"colori casa, bordo+tinta, testo chiaro, palette esistente" → Task 4 (`synergyTagColors` using `HOUSES`) + Task 5 (apply). ✅
- Part B "solo tag-casa, ruolo/gruppo invariati" → Task 4 test asserts gold for non-house; Task 5 uses helper (gold passthrough). ✅
- §"fonte unica" → houseEffectText (text), HOUSES (color) both single-source. ✅
- §"no import cycle" → Global Constraints + Task 2/4 tsc gates. ✅
- §"presentation only, no balance" → no engine/data value change; audit confirmed effects already wired. ✅
- Deviation (HOUSES vs CREST extraction) documented in plan header + Task 6 doc. ✅
- Type consistency: `synergyBonusText(synergy)` (Task 2) used in Task 3; `houseEffectText(house,tier)` (Task 1) used in Task 2; `synergyTagColors(synergy)→{border,bg,ink,mark}` (Task 4) used in Task 5. Names/shapes consistent. ✅
- Scope note: Part B color applied to the 3 gold-pill sites only; the 3 themed sites (Recruit green / Team emerald / SynergyGraph neutral) get text but keep their color theming — documented in Task 5 note + Task 6 doc (a conscious YAGNI: tinting those would mean reworking each bespoke theme; the gold pills are where house tint reads cleanly).
