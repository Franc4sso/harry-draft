# Shiny Draft Traits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert generic traits from fixed wizard attributes into a rare (~1.5%/card) "shiny nature" rolled during the player's draft, granting one random trait, a gender-agreed name epithet, and a CSS-only special look.

**Architecture:** A new optional `DraftedWizard.shiny = { traitId }` is rolled deterministically inside `draftWizard`. Combat reads the trait from `dw.shiny` instead of `wizard.traits`. A `displayName(dw)` helper appends a per-trait, gender-agreed epithet (`"Harry Potter, il Velenoso"`). Fixed traits are removed from wizard data; the shiny is the only source of traits. Player-only; enemies never roll shiny.

**Tech Stack:** TypeScript, Vitest, Next.js (App Router) client components, framer-motion. Draft is the deterministic seeded pipeline in `game/engine/` (`draftSession.ts` → `draft.ts` → `statRoll.ts`).

## Global Constraints

- **This is NOT the Next.js you know** (AGENTS.md): before writing any UI/framework code, read the relevant guide in `node_modules/next/dist/docs/`. The UI task here edits existing client components and uses no new Next APIs — but heed deprecation notices.
- **Determinism is sacred:** the draft is replayed from seed. The shiny roll MUST use the draft `rng` already threaded through `draftWizard(rng, wizard)` — never `Math.random`/`Date.now`. Adding the roll deliberately shifts the draft RNG stream (candidates may show different spells than before); that is expected and deterministic.
- **Shiny is player-draft only.** Enemy teams are generated elsewhere and must never carry `shiny`. After the combat switch, enemies have zero traits.
- **Probability:** `BALANCE.draft.shinyChance = 0.015`, uniform per shown card; the granted trait is uniform across the 17 trait ids.
- **Name format:** comma + space + epithet, e.g. `"Harry Potter, il Velenoso"`. Epithets agree with `wizard.gender` (`'m' | 'f'`).
- **Spec:** `docs/superpowers/specs/2026-06-26-shiny-draft-traits-design.md` (epithet table = §2; consumption sites = §6).
- **Run tests from repo root** (`C:/Users/Francesco/Desktop/wa/harry-draft`): `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`. Shell is Git Bash on Windows; forward slashes.

---

## File Structure

- Modify `types/trait.ts` — add `epithet: { m: string; f: string }` to `Trait`.
- Modify `types/wizard.ts` — add `gender: 'm' | 'f'`; (later) remove `traits?: string[]`.
- Modify `types/combat.ts` — add `shiny?: { traitId: string }` to `DraftedWizard`.
- Modify `data/traits.ts` — add epithets to all 17 traits; export `SHINY_TRAIT_IDS`.
- Modify `data/wizards.ts` — add `gender` to all 60 (Task 1); remove `traits` from all 60 (Task 3).
- Modify `data/constants.ts` — add `draft.shinyChance`.
- Create `lib/displayName.ts` — `displayName(dw)` helper.
- Modify `game/engine/statRoll.ts` — roll shiny in `draftWizard`.
- Modify `game/engine/traits.ts` — read `u.shiny?.traitId` instead of `u.wizard.traits`.
- Modify `components/cards/WizardCardRow.tsx`, `components/cards/WizardCard.tsx` — shiny chip + epithet name + CSS look.
- Modify `components/draft/SquadPanel.tsx`, `components/screens/TeamScreen.tsx`, `components/screens/DraftScreen.tsx`, `components/screens/CampaignRunner.tsx`, `game/engine/combat/replay.ts` — use `displayName`.
- Tests: `tests/lib/displayName.test.ts`, `tests/engine/shinyRoll.test.ts`, `tests/data/shinyData.test.ts`, updates to `tests/data/traitAssignment.test.ts` & `tests/engine/traitsPhase3.test.ts`, a card component test.

---

## Reference data (used across tasks)

**Wizard gender map** (canon). `m` unless listed here as `f`:
Female (`f`): `bellatrix, mcgonagall, fleur, hermione, ginny, luna, molly, tonks, narcissa, cho, sprout, parvati, lavender, pansy, padma, marietta, hannah, susan, leanne, eloise, astoria, penelope, megan`.
All other 37 wizard ids are `m`: `dumbledore, voldemort, harry, snape, sirius, lupin, moody, lucius, kingsley, viktor, ron, draco, neville, fred, george, arthur, dolohov, greyback, cedric, slughorn, hagrid, flitwick, seamus, dean, goyle, crabbe, marcus, pettigrew, terry, michael, roger, anthony, ernie, justin, zacharias, theodore, blaise`.

**Trait epithets** (17), `{ m, f }`:
```
esecuzione      { m: 'il Carnefice',     f: 'la Carnefice' }
furia           { m: 'il Furioso',       f: 'la Furiosa' }
roccia          { m: "l'Incrollabile",   f: "l'Incrollabile" }
sifone          { m: 'il Sanguisuga',    f: 'la Sanguisuga' }
benedizione     { m: 'il Benedetto',     f: 'la Benedetta' }
pietrificazione { m: 'il Pietrificante', f: 'la Pietrificante' }
bavaglio        { m: 'il Silenziatore',  f: 'la Silenziatrice' }
disarmo         { m: 'il Disarmante',    f: 'la Disarmante' }
veleno          { m: 'il Velenoso',      f: 'la Velenosa' }
logoramento     { m: 'lo Sfiancante',    f: 'la Sfiancante' }
ferocia         { m: 'il Feroce',        f: 'la Feroce' }
rigenerazione   { m: 'il Rigenerante',   f: 'la Rigenerante' }
anticipo        { m: 'il Fulmineo',      f: 'la Fulminea' }
crescendo       { m: "l'Inarrestabile",  f: "l'Inarrestabile" }
vendetta        { m: 'il Vendicatore',   f: 'la Vendicatrice' }
frantumazione   { m: 'il Devastatore',   f: 'la Devastatrice' }
gelo            { m: 'il Glaciale',      f: 'la Glaciale' }
```

---

## Task 1: Data & type foundations + displayName

**Files:**
- Modify: `types/trait.ts`, `types/wizard.ts`, `types/combat.ts`, `data/traits.ts`, `data/wizards.ts`, `data/constants.ts`
- Create: `lib/displayName.ts`
- Test: `tests/lib/displayName.test.ts`, `tests/data/shinyData.test.ts`

**Interfaces:**
- Consumes: `Trait`, `Wizard`, `DraftedWizard`, `TRAIT_BY_ID` (`@/data/traits`).
- Produces:
  - `Trait.epithet: { m: string; f: string }`
  - `Wizard.gender: 'm' | 'f'`
  - `DraftedWizard.shiny?: { traitId: string }`
  - `SHINY_TRAIT_IDS: string[]` (the 17 ids) from `@/data/traits`
  - `BALANCE.draft.shinyChance: number`
  - `displayName(dw: DraftedWizard): string` from `@/lib/displayName`

- [ ] **Step 1: Add type fields**

In `types/trait.ts`, add to the `Trait` interface:
```ts
  epithet: { m: string; f: string }
```
In `types/wizard.ts`, add to the `Wizard` interface (keep `traits?: string[]` for now — removed in Task 4):
```ts
  gender: 'm' | 'f'
```
In `types/combat.ts`, add to the `DraftedWizard` interface:
```ts
  /** Rare draft "shiny" nature: grants one trait + a name epithet. Player-only. */
  shiny?: { traitId: string }
```
Run `npx tsc --noEmit` — expect errors (every `Trait` and `Wizard` literal now misses a required field). That guides Steps 2-3.

- [ ] **Step 2: Add epithets + SHINY_TRAIT_IDS in `data/traits.ts`**

Add an `epithet: { m, f }` to each of the 17 trait objects using the **Trait epithets** table above (exact strings — mind the apostrophe forms `"l'Incrollabile"`, `"l'Inarrestabile"`, which must use double-quoted JS strings).
At the bottom, after `TRAIT_BY_ID`, add:
```ts
/** The trait ids eligible for a shiny draft roll (all of them). */
export const SHINY_TRAIT_IDS: string[] = TRAITS.map(t => t.id)
```

- [ ] **Step 3: Add `gender` to all 60 wizards in `data/wizards.ts`**

For every wizard object, add `gender: 'm',` or `gender: 'f',` (place it right after the `tier:` field) per the **Wizard gender map** above. Leave the existing `traits` arrays untouched (removed in Task 3).

- [ ] **Step 4: Add the balance constant**

In `data/constants.ts`, inside the `draft: { ... }` block (after `maxTier1PerScreen: 1,`), add:
```ts
    shinyChance: 0.015,
```

- [ ] **Step 5: Write the failing displayName test**

Create `tests/lib/displayName.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { displayName } from '@/lib/displayName'
import { WIZARD_BY_ID } from '@/data/wizards'
import { fixedStats } from '@/game/engine/statRoll'
import { SPELL_BY_ID } from '@/data/spells'

function dw(id: string, shiny?: { traitId: string }) {
  const wizard = WIZARD_BY_ID[id]!
  const stats = fixedStats(wizard)
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID[wizard.spellPool[0]!]!, shiny }
}

describe('displayName', () => {
  it('returns the plain name when not shiny', () => {
    expect(displayName(dw('harry'))).toBe('Harry Potter')
  })
  it('appends the masculine epithet for a male wizard', () => {
    expect(displayName(dw('harry', { traitId: 'veleno' }))).toBe('Harry Potter, il Velenoso')
  })
  it('appends the feminine epithet for a female wizard', () => {
    expect(displayName(dw('hermione', { traitId: 'veleno' }))).toBe('Hermione Granger, la Velenosa')
  })
})
```

- [ ] **Step 6: Run it — expect FAIL**

Run: `npx vitest run tests/lib/displayName.test.ts`
Expected: FAIL — `Cannot find module '@/lib/displayName'`.

- [ ] **Step 7: Implement `lib/displayName.ts`**

```ts
import type { DraftedWizard } from '@/types'
import { TRAIT_BY_ID } from '@/data/traits'

/** Full display name, with a gender-agreed epithet when the wizard is shiny. */
export function displayName(dw: DraftedWizard): string {
  if (!dw.shiny) return dw.wizard.name
  const trait = TRAIT_BY_ID[dw.shiny.traitId]
  if (!trait) return dw.wizard.name
  return `${dw.wizard.name}, ${trait.epithet[dw.wizard.gender]}`
}
```

- [ ] **Step 8: Write the data-integrity test**

Create `tests/data/shinyData.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { TRAITS, SHINY_TRAIT_IDS } from '@/data/traits'
import { WIZARDS } from '@/data/wizards'

describe('shiny data integrity', () => {
  it('every trait has masculine and feminine epithets', () => {
    for (const t of TRAITS) {
      expect(t.epithet?.m, `${t.id} epithet.m`).toBeTruthy()
      expect(t.epithet?.f, `${t.id} epithet.f`).toBeTruthy()
    }
  })
  it('SHINY_TRAIT_IDS lists all 17 trait ids', () => {
    expect(SHINY_TRAIT_IDS).toHaveLength(17)
    expect(new Set(SHINY_TRAIT_IDS).size).toBe(17)
  })
  it('every wizard has a gender', () => {
    for (const w of WIZARDS) expect(w.gender, `${w.id} gender`).toMatch(/^[mf]$/)
  })
})
```

- [ ] **Step 9: Run tests + typecheck**

Run: `npx vitest run tests/lib/displayName.test.ts tests/data/shinyData.test.ts` → expect PASS (6).
Run: `npx tsc --noEmit` → expect PASS (all literals now complete).

- [ ] **Step 10: Commit**

```bash
git add types/trait.ts types/wizard.ts types/combat.ts data/traits.ts data/wizards.ts data/constants.ts lib/displayName.ts tests/lib/displayName.test.ts tests/data/shinyData.test.ts
git commit -m "feat(shiny): data foundations — epithets, wizard gender, shiny field, displayName"
```

---

## Task 2: Roll the shiny in the draft

**Files:**
- Modify: `game/engine/statRoll.ts`
- Test: `tests/engine/shinyRoll.test.ts`

**Interfaces:**
- Consumes: `SHINY_TRAIT_IDS` (`@/data/traits`), `BALANCE.draft.shinyChance` (`@/data/constants`), `Rng.chance`/`Rng.pick`.
- Produces: `draftWizard(rng, wizard)` now may set `shiny: { traitId }`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/shinyRoll.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SHINY_TRAIT_IDS } from '@/data/traits'

const harry = WIZARD_BY_ID['harry']!

describe('draftWizard shiny roll', () => {
  it('is deterministic for a given seed', () => {
    const a = draftWizard(createRng('seed-x'), harry)
    const b = draftWizard(createRng('seed-x'), harry)
    expect(a.shiny).toEqual(b.shiny)
  })

  it('rolls shiny at roughly the configured rate, always a valid trait', () => {
    let shinies = 0
    const N = 20000
    for (let i = 0; i < N; i++) {
      const d = draftWizard(createRng(`seed-${i}`), harry)
      if (d.shiny) {
        shinies++
        expect(SHINY_TRAIT_IDS).toContain(d.shiny.traitId)
      }
    }
    const rate = shinies / N
    // configured 0.015; allow a generous band for sampling noise
    expect(rate).toBeGreaterThan(0.008)
    expect(rate).toBeLessThan(0.025)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/engine/shinyRoll.test.ts`
Expected: FAIL — `a.shiny` is `undefined` for all (not yet implemented), so the rate test gets 0 and fails the lower bound.

- [ ] **Step 3: Implement the roll**

In `game/engine/statRoll.ts`, add imports at top:
```ts
import { BALANCE } from '@/data/constants'
import { SHINY_TRAIT_IDS } from '@/data/traits'
```
Replace `draftWizard` with:
```ts
export function draftWizard(rng: Rng, wizard: Wizard): DraftedWizard {
  const stats = fixedStats(wizard)
  const spell = pickSpell(rng, wizard)
  // Shiny roll AFTER the spell pick (fixed order; shifts the draft stream by design).
  const shiny = rng.chance(BALANCE.draft.shinyChance)
    ? { traitId: rng.pick(SHINY_TRAIT_IDS) }
    : undefined
  return { wizard, stats, maxHp: stats.hp, spell, ...(shiny ? { shiny } : {}) }
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/engine/shinyRoll.test.ts`
Expected: PASS (2).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` → expect PASS.

- [ ] **Step 6: Commit**

```bash
git add game/engine/statRoll.ts tests/engine/shinyRoll.test.ts
git commit -m "feat(shiny): roll a rare shiny trait deterministically in draftWizard"
```

---

## Task 3: Combat reads shiny; remove fixed traits

**Files:**
- Modify: `game/engine/traits.ts`
- Modify: `data/wizards.ts` (remove `traits` from all 60)
- Modify/replace: `tests/data/traitAssignment.test.ts`, `tests/engine/traitsPhase3.test.ts`
- Test: `tests/engine/shinyCombat.test.ts` (create)

**Interfaces:**
- Consumes: `DraftedWizard.shiny`, `TRAIT_BY_ID`.
- Produces: `registerTraitTriggers` now sources the (0-or-1) trait from `u.shiny?.traitId`.

- [ ] **Step 1: Write the failing combat test**

Create `tests/engine/shinyCombat.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { BattleUnit, Wizard } from '@/types'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerTraitTriggers } from '@/game/engine/traits'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = { id: 'a', name: 'A', house: 'Grifondoro', role: 'Attaccante', tier: 3, gender: 'm', ranges: { hp: [1,1], atk: [1,1], def: [1,1], spd: [1,1] }, spellPool: [] } as Wizard
  const stats = { hp: 100, atk: 20, def: 10, spd: 20 }
  return { wizard, stats, maxHp: 100, spell: { id: 's', name: 's', desc: '', type: 'Attacco', hitChance: 1 }, side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('registerTraitTriggers sources from shiny', () => {
  it('registers the shiny trait (roccia → -20% incoming)', () => {
    const bus = createEventBus()
    const u = unit({ shiny: { traitId: 'roccia' } })
    registerTraitTriggers(bus, [u])
    // roccia owner is 'target'; emit with this unit as the damage target.
    const out = bus.emitModifier('modifyIncomingDamage', 100, { turn: 1, actor: unit(), target: u, side: 'left', flags: [] })
    expect(out).toBeCloseTo(80)
  })

  it('registers nothing when not shiny', () => {
    const bus = createEventBus()
    const u = unit()
    registerTraitTriggers(bus, [u])
    const out = bus.emitModifier('modifyIncomingDamage', 100, { turn: 1, actor: unit(), target: u, side: 'left', flags: [] })
    expect(out).toBe(100)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/engine/shinyCombat.test.ts`
Expected: FAIL — current code reads `u.wizard.traits` (undefined here) so `roccia` is never registered; first assertion gets 100, not 80.

- [ ] **Step 3: Switch the registrar to read shiny**

In `game/engine/traits.ts`, replace the inner loop source. Change:
```ts
    for (const id of u.wizard.traits ?? []) {
```
to:
```ts
    for (const id of (u.shiny ? [u.shiny.traitId] : [])) {
```
(Leave the rest of the function unchanged.)

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/engine/shinyCombat.test.ts`
Expected: PASS (2).

- [ ] **Step 5: Remove fixed traits from wizard data**

In `data/wizards.ts`, delete the `traits: [...]` property line from every one of the 60 wizard objects. (Keep `tags`.) Do not touch `types/wizard.ts` yet — the optional `traits?` field stays until Task 4.

- [ ] **Step 6: Update the fixed-trait tests**

`tests/data/traitAssignment.test.ts` asserts every wizard has traits — that contract is gone. Replace its body so it asserts the NEW contract:
```ts
import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'

describe('wizard trait data', () => {
  it('no wizard carries fixed traits any more (traits come from shiny rolls)', () => {
    for (const w of WIZARDS) expect(w.traits ?? []).toHaveLength(0)
  })
})
```
Open `tests/engine/traitsPhase3.test.ts`. For any test that builds a wizard/unit relying on a FIXED `wizard.traits` to drive combat, convert it to set `shiny: { traitId }` on the `DraftedWizard`/`BattleUnit` instead (the trait engine now reads `shiny`). Keep tests that exercise the trait *effects* themselves; only change how the trait gets attached. Run the file to confirm after editing.

- [ ] **Step 7: Run the affected suites**

Run: `npx vitest run tests/engine/shinyCombat.test.ts tests/data/traitAssignment.test.ts tests/engine/traitsPhase3.test.ts`
Expected: PASS. Then `npx tsc --noEmit` → PASS.

- [ ] **Step 8: Commit**

```bash
git add game/engine/traits.ts data/wizards.ts tests/engine/shinyCombat.test.ts tests/data/traitAssignment.test.ts tests/engine/traitsPhase3.test.ts
git commit -m "feat(shiny): combat sources traits from shiny; remove fixed wizard traits"
```

---

## Task 4: UI — epithet names + shiny card look

**Files:**
- Modify: `components/cards/WizardCardRow.tsx`, `components/cards/WizardCard.tsx`
- Modify: `components/draft/SquadPanel.tsx`, `components/screens/TeamScreen.tsx`, `components/screens/DraftScreen.tsx`, `components/screens/CampaignRunner.tsx`, `game/engine/combat/replay.ts`
- Modify: `types/wizard.ts` (remove now-unused `traits?: string[]`)
- Test: `tests/ui/shinyCard.test.tsx` (create)

**Interfaces:**
- Consumes: `displayName` (`@/lib/displayName`), `TRAIT_BY_ID` (`@/data/traits`), `DraftedWizard.shiny`.

- [ ] **Step 1: Write the failing component test**

Create `tests/ui/shinyCard.test.tsx` (mirror the existing UI test setup under `tests/ui/`, which uses jsdom + `@testing-library/react` + jest-dom via `tests/setup.ts`):
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { WIZARD_BY_ID } from '@/data/wizards'
import { fixedStats } from '@/game/engine/statRoll'
import { SPELL_BY_ID } from '@/data/spells'
import { TRAIT_BY_ID } from '@/data/traits'

function dw(id: string, shiny?: { traitId: string }) {
  const wizard = WIZARD_BY_ID[id]!
  const stats = fixedStats(wizard)
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID[wizard.spellPool[0]!]!, shiny }
}

describe('WizardCardRow shiny', () => {
  it('shows the epithet name and the trait chip when shiny', () => {
    render(<WizardCardRow drafted={dw('harry', { traitId: 'veleno' })} />)
    expect(screen.getByText('Harry Potter, il Velenoso')).toBeInTheDocument()
    expect(screen.getByText(TRAIT_BY_ID['veleno']!.name)).toBeInTheDocument()
  })
  it('shows the plain name and no trait chip when not shiny', () => {
    render(<WizardCardRow drafted={dw('harry')} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    expect(screen.queryByText(TRAIT_BY_ID['veleno']!.name)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/ui/shinyCard.test.tsx`
Expected: FAIL — the row renders `wizard.name` ("Harry Potter"), not the epithet; first test fails on the epithet lookup.

- [ ] **Step 3: Update `WizardCardRow.tsx`**

1. Replace the trait import line `import { TRAIT_BY_ID } from '@/data/traits'` — keep it (still needed). Add:
```tsx
import { displayName } from '@/lib/displayName'
```
2. Replace the `traitChips` computation (currently from `wizard.traits`) with a shiny-sourced one:
```tsx
const shinyTrait = drafted.shiny ? TRAIT_BY_ID[drafted.shiny.traitId] : undefined
```
3. Change the name heading from `{wizard.name}` to `{displayName(drafted)}` and mark shiny:
```tsx
<h3 className="font-display text-[17px] leading-none">
  {displayName(drafted)}
  {drafted.shiny && <span aria-hidden className="ml-1 text-amber-300">✨</span>}
</h3>
```
4. Replace the old Traits block (the `{traitChips.length > 0 && (...)}` section) with a shiny-trait block:
```tsx
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
```
5. Add a CSS shiny aura on the card root. On the outer `motion.div`, when `drafted.shiny`, extend the `boxShadow` with a gold ring. Change the `boxShadow` expression in the `style` prop so the shiny case adds `, 0 0 22px rgba(255,200,80,0.55), inset 0 0 0 2px rgba(255,210,90,0.7)`. Concretely, compute before the return:
```tsx
const shinyGlow = drafted.shiny ? ', 0 0 22px rgba(255,200,80,0.55), inset 0 0 0 2px rgba(255,210,90,0.7)' : ''
```
and append `${shinyGlow}` to both `boxShadow` template strings (selected and unselected).

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/ui/shinyCard.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Apply the same to `WizardCard.tsx`**

In `components/cards/WizardCard.tsx`:
1. Add `import { displayName } from '@/lib/displayName'`.
2. Change `<h3 ...>{wizard.name}</h3>` (line ~87) to `<h3 ...>{displayName(drafted)}{drafted.shiny && <span aria-hidden className="ml-1 text-amber-300">✨</span>}</h3>`.
3. Replace the `wizard.traits`-based trait block (the `{wizard.traits && wizard.traits.length > 0 && (() => { ... })()}` block, lines ~115-133) with a shiny-sourced chip:
```tsx
{drafted.shiny && (() => {
  const trait = TRAIT_BY_ID[drafted.shiny.traitId]
  return trait ? (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <Tooltip content={trait.desc}>
        <span
          className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ color: '#c4dff3', borderColor: 'rgba(100,160,220,0.5)', background: 'rgba(60,110,180,0.18)' }}
        >
          {trait.name}
        </span>
      </Tooltip>
    </div>
  ) : null
})()}
```
4. Add a gold ring when shiny: on the portrait container `<div className="relative h-36 ...">` add `{drafted.shiny && <div aria-hidden className="pointer-events-none absolute inset-0 rounded-t-xl" style={{ boxShadow: 'inset 0 0 0 2px rgba(255,210,90,0.8), 0 0 18px rgba(255,200,80,0.5)' }} />}` as the last child.

- [ ] **Step 6: Apply `displayName` to the remaining name sites**

In each file, find where a `DraftedWizard`'s `.wizard.name` is rendered and swap to `displayName(<the DraftedWizard>)`. Add `import { displayName } from '@/lib/displayName'` to each.
- `components/draft/SquadPanel.tsx`: line ~25, `{p.wizard.name}` → `{displayName(p)}`. (Leave the avatar initial `p.wizard.name.charAt(0)` as the base name.)
- `components/screens/TeamScreen.tsx`: the `nameById` map `team.map((d) => [d.wizard.id, d.wizard.name])` → `team.map((d) => [d.wizard.id, displayName(d)])`.
- `components/screens/DraftScreen.tsx`: `candidateName={considered?.wizard.name}` → `candidateName={considered ? displayName(considered) : undefined}`.
- `components/screens/CampaignRunner.tsx`: the loops `map[dw.wizard.id] = dw.wizard.name` (both the team loop and the enemy loop) → `map[dw.wizard.id] = displayName(dw)`. (Enemies are never shiny, so this is a no-op for them but keeps one code path.)
- `game/engine/combat/replay.ts`: line ~74 `name: u.wizard.name` → `name: displayName(u)` (add the import; `u` is a `BattleUnit`, which extends `DraftedWizard`).

- [ ] **Step 7: Remove the now-unused `traits?` field**

Grep to confirm no remaining readers: `npx tsc --noEmit` will fail if any remain. In `types/wizard.ts`, delete the `traits?: string[]` line. Re-run `npx tsc --noEmit`.
If tsc reports a remaining reference to `.traits`, that file was missed — convert it to `shiny` semantics or `displayName` and re-run. (Note: `tests/data/traitAssignment.test.ts` references `w.traits ?? []` — that's fine with the field removed only if you keep the `?? []`; since the field is gone, change that test line to assert via a cast-free check, e.g. delete that test file entirely as the "no fixed traits" contract is now structural, OR keep the field. DECISION: delete `tests/data/traitAssignment.test.ts` — the contract is enforced by the type system once the field is gone.)

- [ ] **Step 8: Run UI + typecheck + the touched suites**

Run: `npx vitest run tests/ui/shinyCard.test.tsx` → PASS.
Run: `npx tsc --noEmit` → PASS.
Run: `npx vitest run tests/ui` → PASS (no regressions in other card/name tests; if an existing test asserted a fixed trait chip, update it to the shiny model).

- [ ] **Step 9: Commit**

```bash
git add components/cards/WizardCardRow.tsx components/cards/WizardCard.tsx components/draft/SquadPanel.tsx components/screens/TeamScreen.tsx components/screens/DraftScreen.tsx components/screens/CampaignRunner.tsx game/engine/combat/replay.ts types/wizard.ts tests/ui/shinyCard.test.tsx
git rm tests/data/traitAssignment.test.ts
git commit -m "feat(shiny): epithet names + shiny card treatment; drop fixed-trait field"
```

---

## Task 5: Rebalance + refresh fixtures

Removing fixed traits (previously active on BOTH teams) changes combat, and the shiny roll shifts the draft RNG stream. This task restores the difficulty band and regenerates broken deterministic fixtures.

**Files:**
- Modify (if needed): `data/constants.ts` (menace/relic) and/or `data/signatures.ts` (budgets).
- Modify: any seed-dependent fixture/snapshot tests that now fail.
- Test: `tests/engine/campaignBalance.test.ts`, `tests/engine/balance.test.ts`, full suite.

**Interfaces:**
- Targets (`tests/engine/campaignBalance.test.ts`): `clearRate` ∈ (0.08, 0.18), `firstStageWinRate` > 0.65, `bossWinRate` ∈ (0, 0.30), `cappedRate` < 0.05.

- [ ] **Step 1: Establish the new baseline**

Run: `npx vitest run tests/engine/campaignBalance.test.ts tests/engine/balance.test.ts`
If they fail, temporarily add `console.log(stats)` in the campaign harness `describe` block to read the four rates, record them, then REVERT the console.log before committing.

- [ ] **Step 2: Inventory broken fixtures**

Run: `npx vitest run`
Expected: shiny/displayName/UI tests PASS; some battle-log/replay/snapshot fixtures may FAIL from the combat change (no fixed traits) and the draft-stream shift. This is the same class of refresh as commit `e4aa093`.

- [ ] **Step 3: Recalibrate to band (only if Step 1 failed)**

Make the SMALLEST change that lands in-band, re-running `npx vitest run tests/engine/campaignBalance.test.ts` after each:
1. First adjust menace/relic knobs in `data/constants.ts` (the brutal-difficulty levers).
2. Only if still out of band, adjust signature budget constants in `data/signatures.ts`.
Note the final values in the commit message.

- [ ] **Step 4: Regenerate fixtures**

For each failing deterministic fixture, spot-read one battle log to confirm the new output is sane (no NaN/throw/duplicate-key; combat works without fixed traits), then update. If snapshots: `npx vitest run -u`. Otherwise hand-update expected literals.
Run: `npx vitest run` → ALL PASS.

- [ ] **Step 5: Determinism + final run**

Run: `npx tsc --noEmit` → PASS.
Run: `npx vitest run` twice → identical, ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "balance: recalibrate band and refresh fixtures after fixed-trait removal"
```

---

## Manual verification (after all tasks)

- [ ] `npx next dev` (heed AGENTS.md), play the draft across several runs/seeds; confirm shiny cards occasionally appear with a gold aura + ✨, the epithet in the name (`"…, il/la <Epiteto>"`, gender-correct), and the blue trait chip with tooltip. Confirm a shiny pick keeps its epithet on the Team screen and in the battle log, and that its trait actually fires in combat.
- [ ] Confirm non-shiny wizards show no trait chip and the plain name.

## Self-review notes (author)

- **Spec coverage:** data model (§2) → Task 1 + Task 3 (data removal); roll (§3) → Task 2; name/epithet (§4) → Task 1 (helper) + Task 4 (wiring); UI (§5) → Task 4; consumption removal (§6) → Task 3 + Task 4; balance (§7) → Task 5; tests (§8) spread across tasks.
- **Compile-safety:** `Wizard.traits?` stays optional until Task 4 so card consumers compile through Tasks 1-3; the engine switches off it in Task 3; the field is deleted only once all readers are gone (Task 4 Step 7).
- **Determinism:** shiny uses the threaded draft `rng` (Task 2); no `Math.random`. Stream shift is acknowledged and handled by fixture refresh in Task 5.
- **Type consistency:** `shiny?: { traitId: string }`, `displayName(dw)`, `epithet: { m, f }`, `gender: 'm' | 'f'`, `SHINY_TRAIT_IDS`, `BALANCE.draft.shinyChance` — names identical across all tasks.
