# Draft Poster Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the draft wizard card as a "poster" — full-bleed portrait, clean role gem, a hero spell-move block, a distinct gold personal-ability plate, and a synergy nudge — so the player can read a wizard's value at a glance, not just its damage.

**Architecture:** New player-facing data lives in small `lib/` modules (`ROLE_VERB`/`ROLE_ACCENT` in the updated `roleInfo.ts`; `wizardAbilities.ts` + `wizardEpithet.ts` with hand-written text for all 60 wizards). `WizardCard.tsx` is rewritten to the poster layout (same props, so DraftBoard/TeamScreen/RecruitScreen are untouched), extracting `RoleBadge` and `AbilityPlate` sub-components. Card-engine first (verified on screen with a few wizards), then the 60 texts, then wiring.

**Tech Stack:** Next.js, React, TypeScript, Tailwind, Vitest + Testing Library. Design tokens: Notturno palette (`lib/notturno.ts`), Cinzel/Inter. Portraits: `public/portraits/<id>.webp` (60/60 present).

## Global Constraints

- Copy in italiano. Commit + push to master without asking when work is done.
- Reuse the existing visual system: Notturno palette (ink #0a0813, gold #b08d57→#f3e6a0, violet #7c3aed), Cinzel (display) + Inter (body), `HouseFrame`/`RarityFrame`.
- Role accent colors (new tokens): Tank #3aa0f2, Attaccante #ff5140, Supporto #20d894, Controllo #b355ff. Role verbs: Tank "Provoca", Attaccante "Colpisce", Supporto "Cura", Controllo "Disabilita" (verbs used in tooltips/data, NOT shown next to the role name on the card per the approved mockup — only the role word shows).
- `WizardCard` props signature stays EXACTLY: `{ drafted: DraftedWizard; selected?; onClick?; className?; hotSynergyIds?: ReadonlySet<string>; showLevel? }`. Do not change it — DraftBoard/TeamScreen/RecruitScreen depend on it.
- ONLY UI + textual data. NO combat-engine change. Combat unit restyle is a SEPARATE future slice — do not touch `components/battle/*`.
- Quality floor: responsive to mobile, visible keyboard focus, `prefers-reduced-motion` respected (hover-lift is motion-safe). Draft is inside a static GameShell (perf) — no infinite animations.
- Approved mockup: `docs/superpowers/mockups/2026-07-07-draft-poster.html` — match it.
- `npm run test` does NOT run typecheck → run `npm run typecheck` separately.

## Card anatomy (from the approved mockup)

Full-bleed portrait (`background-size:cover`) + role-color wash (soft-light) + bottom gradient + vignette. Top-left: **role gem** (icon only, role-accent tint). Top-right: rarity/tier badge. Over the portrait bottom: role word pill ("Tank"/"Controllo") + monumental name (Cinzel) + epithet kick. Body: **spell block** (Cinzel spell name — NO type chip — effect sentence, meta row: precisione/ricarica/etc, role-accent left bar) → **gold ability plate** ("ABILITÀ PERSONALE" label + name + blurb) → **stat row** (HP/ATT/DIF/VEL, colored) → **synergy nudge** ("Aggiunge <Synergy>") when `hotSynergyIds` non-empty.

---

### Task 1: Role data — verbs, accents, updated descriptions

**Files:**
- Modify: `lib/roleInfo.ts`
- Test: `tests/lib/roleInfo.test.ts` (exists — extend)

**Interfaces:**
- Produces: `export const ROLE_VERB: Record<Role,string>`, `export const ROLE_ACCENT: Record<Role,string>`; `ROLE_INFO` updated to current combat behaviour.

- [ ] **Step 1: Write failing tests**

```ts
// add to tests/lib/roleInfo.test.ts
import { ROLE_VERB, ROLE_ACCENT, ROLE_INFO } from '@/lib/roleInfo'
import type { Role } from '@/types'
const ROLES: Role[] = ['Tank', 'Attaccante', 'Supporto', 'Controllo']

it('every role has a verb and an accent hex', () => {
  for (const r of ROLES) {
    expect(ROLE_VERB[r], r).toMatch(/\w/)
    expect(ROLE_ACCENT[r], r).toMatch(/^#[0-9a-fA-F]{6}$/)
  }
})
it('the Controllo description no longer claims it plainly bypasses the Tank', () => {
  // Combat changed: Controllo bypasses the taunt ONLY with a hard-control. The old
  // "scavalca il Tank" (unqualified) is now misleading and must be gone.
  expect(ROLE_INFO.Controllo).not.toMatch(/scavalca il Tank/i)
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/lib/roleInfo.test.ts`
Expected: FAIL — `ROLE_VERB`/`ROLE_ACCENT` undefined; `ROLE_INFO.Controllo` still says "scavalca il Tank".

- [ ] **Step 3: Update `lib/roleInfo.ts`**

Add after `ROLE_INFO` and update the two stale blurbs:

```ts
export const ROLE_INFO: Record<Role, string> = {
  Tank: 'Muro della squadra: i nemici lo attaccano per primo. Tanta vita e difesa, poco danno.',
  Attaccante: 'Cannone di vetro: ignora parte della difesa nemica e si tuffa sui bersagli fragili. Tanto attacco, poca vita.',
  Controllo: 'Disturbatore: stordisce e rallenta. Scavalca il Tank solo quando può stordirlo. Molto veloce.',
  Supporto: 'Sostegno: cura, scuda e pulisce i controlli dalla squadra. La tiene in piedi.',
}

/** One-word action verb per role, player-facing. */
export const ROLE_VERB: Record<Role, string> = {
  Tank: 'Provoca', Attaccante: 'Colpisce', Supporto: 'Cura', Controllo: 'Disabilita',
}

/** Role accent color (poster cards / role gem). */
export const ROLE_ACCENT: Record<Role, string> = {
  Tank: '#3aa0f2', Attaccante: '#ff5140', Supporto: '#20d894', Controllo: '#b355ff',
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/lib/roleInfo.test.ts` → PASS. Then `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/roleInfo.ts tests/lib/roleInfo.test.ts
git commit -m "feat(ui): role verbs + accent colors; correct stale role descriptions"
```

---

### Task 2: The poster card engine (layout) — verified on screen

**CORRECTION (2026-07-07):** the LIVE draft renders `WizardCardColumn` (via
`DraftScreen → DraftCandidateCard → WizardCardColumn`), NOT `WizardCard` (which is dead — its
only consumer `DraftBoard`/`DraftSlot` is not wired into any route). So the poster layout must be
applied to **`components/cards/WizardCardColumn.tsx`**, not `WizardCard.tsx`. `WizardCardColumn`
has the same props as `WizardCard` plus `testId?`. Scope for THIS slice = DRAFT only (user
decision) → `WizardCardRow` (team/recruit, horizontal) is NOT touched here. `RoleBadge`/
`AbilityPlate` sub-components are still built and used (by Column).

**Files:**
- Create: `components/cards/RoleBadge.tsx`, `components/cards/AbilityPlate.tsx`
- Modify: `components/cards/WizardCardColumn.tsx`
- Test: `tests/ui/wizardCard.test.tsx` (extend) — but assert against `WizardCardColumn` (the live draft card), not `WizardCard`.

**Interfaces:**
- Consumes: `ROLE_VERB`, `ROLE_ACCENT`, `ROLE_INFO` (Task 1); `abilityFor`, `epithetFor` (Task 3 — until Task 3 lands, use a temporary inline stub that returns the wizard's spell name + role blurb, replaced in Task 4). Existing glossary helpers `spellEffectLines`, `formatSpellStats` for the spell block.
- Produces: the rewritten `WizardCard` (same props) rendering the poster layout; `RoleBadge({ role, size? })` and `AbilityPlate({ name, blurb })`.

- [ ] **Step 1: Write failing render tests**

```ts
// add to tests/ui/wizardCard.test.tsx — assert poster structure, using the file's
// existing DraftedWizard fixture builder (grep the file for how it makes `drafted`).
it('renders name, role word, spell name and the four stats (poster layout)', () => {
  render(<WizardCard drafted={draftedTank()} />)  // a Tank fixture
  expect(screen.getByRole('heading', { name: /./ })).toBeInTheDocument()
  expect(screen.getByTestId('role-badge')).toBeInTheDocument()
  expect(screen.getByTestId('spell-block')).toHaveTextContent(/./)
  for (const k of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(k)).toBeInTheDocument()
})
it('shows the synergy nudge only when hotSynergyIds is non-empty', () => {
  const { rerender } = render(<WizardCard drafted={draftedTank()} />)
  expect(screen.queryByTestId('synergy-nudge')).toBeNull()
  rerender(<WizardCard drafted={draftedTank()} hotSynergyIds={new Set(['gryffindor'])} />)
  expect(screen.getByTestId('synergy-nudge')).toBeInTheDocument()
})
it('falls back to an initial when the portrait is missing', () => {
  // PortraitImage already handles missing files; assert the card still renders the name.
  render(<WizardCard drafted={draftedNoPortrait()} />)
  expect(screen.getByRole('heading')).toBeInTheDocument()
})
```

If the existing test file has no `draftedTank()` helper, add small builders next to the existing fixture (reuse its wizard-construction pattern; a Tank = a wizard whose `role === 'Tank'`).

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/ui/wizardCard.test.tsx`
Expected: FAIL — no `role-badge`/`spell-block`/`synergy-nudge` testids yet.

- [ ] **Step 3: Build `RoleBadge.tsx` + `AbilityPlate.tsx`**

`RoleBadge`: a rounded gem with the role icon (reuse `RoleIcon`) tinted by `ROLE_ACCENT[role]`, `data-testid="role-badge"`, `aria-label={role}`.
`AbilityPlate`: gold plate — label "Abilità personale", `name` (gold), `blurb` (dim). `data-testid="ability-plate"`.
Both are small, presentational, prop-driven (see the mockup `.abil`/`.rgem` styles for the exact look). Keep them under ~40 lines each.

- [ ] **Step 4: Rewrite `WizardCard.tsx` to the poster layout**

Follow `docs/superpowers/mockups/2026-07-07-draft-poster.html` (the `poster5` layout). Structure: full-bleed `PortraitImage variant="card"` inside a full-width portrait container (PortraitImage is already `object-cover h-full w-full`, so it fills the container — just give the container the portrait height, e.g. ~248px, and `overflow-hidden`) + role-accent wash + gradient + vignette; `RoleBadge` top-left; `TierBadge` top-right; over-portrait role word + name (Cinzel) + epithet; body: spell block (`data-testid="spell-block"`: spell name via Cinzel, `spellEffectLines` for the effect, `formatSpellStats` for the meta row — NO `spellTypeChip`), `AbilityPlate` (from `abilityFor` stub for now), stat row (HP/ATT/DIF/VEL with the STAT_CELLS colors already in the file), and the synergy nudge (`data-testid="synergy-nudge"`, shown only when `hotSynergyIds?.size`). Preserve `onClick`, keyboard handlers, `selected`, `showLevel`, the shiny treatment, and `hotSynergyIds` highlight. Respect `prefers-reduced-motion` on the hover-lift.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/ui/wizardCard.test.tsx tests/ui/wizardCardRow.test.tsx tests/ui/draftCandidateCard.test.tsx` → PASS (adjust the sibling tests ONLY if they asserted the old chip layout AND the assertion intent is preserved; flag any change). `npm run typecheck` → clean.

- [ ] **Step 6: Visual check on the real app (GPU headed)**

Per the HANDOFF playwright recipe, drive to the draft, screenshot the three candidate cards, compare against the mockup. Verify text legibility over a LIGHT portrait (e.g. Cedric) AND a DARK one (e.g. Bellatrix) — the gradient+vignette must keep the white text readable on both. Save the screenshot.

- [ ] **Step 7: Commit**

```bash
git add components/cards/WizardCard.tsx components/cards/RoleBadge.tsx components/cards/AbilityPlate.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(ui): draft card poster layout — role gem, spell block, ability plate, synergy nudge"
```

---

### PLAN CHANGE (2026-07-08): the personal ability IS the existing Signature

Discovery: all 60 wizards already have a `Signature` (`data/signatures.ts`, `SIGNATURE_BY_ID[id]
→ { id, name, desc, triggers }`) — a unique personal ability with a written name + description
(e.g. draco "Tocco Velenoso: i suoi colpi possono avvelenare"). USER DECISION: the gold ability
plate shows the wizard's SIGNATURE (name + desc), reusing existing text. Consequences:
- **Task 3** becomes: `abilityFor(id)` reads `SIGNATURE_BY_ID[id]` → `{ name, blurb: desc }`, with a
  fallback (role-derived) for any id without a signature (none today, but keep it total).
- **Task 4 (write 60 abilities) is CANCELLED** — no hand-written text; the signatures already exist.
  The epithet (`epithetFor`) is still small/optional — derive it from the role (e.g. Tank→"Muro
  della squadra") rather than hand-writing 60; a `wizardEpithet.ts` with a role-based map is enough.
- **Task 5** additionally REMOVES the residual signature pill still shown at the top of the card
  (the "Tocco Velenoso" gold pill) — its content now lives in the gold ability plate, so showing it
  twice is duplication. And it replaces the Task 2 stub with `abilityFor` (the signature).

### Task 3: Ability + epithet data modules (with fallbacks)

**Files:**
- Create: `lib/wizardAbilities.ts`, `lib/wizardEpithet.ts`
- Test: `tests/lib/wizardAbilities.test.ts`

**Interfaces:**
- Consumes: `WIZARDS`, `SPELL_BY_ID`, `ROLE_INFO`.
- Produces: `export function abilityFor(id: string): { name: string; blurb: string }`, `export function epithetFor(id: string): string`. Both total (never throw; fallback derives from the wizard's role/spell).

- [ ] **Step 1: Write failing coverage tests**

```ts
// tests/lib/wizardAbilities.test.ts
import { WIZARDS } from '@/data/wizards'
import { abilityFor } from '@/lib/wizardAbilities'
import { epithetFor } from '@/lib/wizardEpithet'

it('every wizard has a hand-written ability (name + blurb within length limits)', () => {
  const bad: string[] = []
  for (const w of WIZARDS) {
    const a = abilityFor(w.id)
    if (!a.name || a.name.length > 28) bad.push(`${w.id} name`)
    if (!a.blurb || a.blurb.length > 96) bad.push(`${w.id} blurb`)
  }
  expect(bad, bad.join(', ')).toEqual([])
})
it('every wizard has an epithet within length limit', () => {
  const bad = WIZARDS.filter(w => { const e = epithetFor(w.id); return !e || e.length > 26 }).map(w => w.id)
  expect(bad, bad.join(', ')).toEqual([])
})
it('abilityFor never throws for an unknown id (fallback)', () => {
  expect(() => abilityFor('__nope__')).not.toThrow()
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/lib/wizardAbilities.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Create the two modules with the fallback + a FEW real entries**

Create `lib/wizardAbilities.ts`: a `Record<string,{name,blurb}>` (start with cedric/bellatrix/harry/ron/hermione from the mockup + a handful) and `abilityFor(id)` that returns the map entry or a fallback derived from the wizard's role (`ROLE_INFO` short) + spell name. Same shape for `lib/wizardEpithet.ts` (`epithetFor` fallback = the role's one-word noun, e.g. Tank→"Muro"). This makes the module + fallback correct; the FULL 60-entry fill is Task 4 (which is what makes the coverage test — length limits on real entries — meaningful).

- [ ] **Step 4: Run — fallback tests pass; note coverage is partial until Task 4**

Run: `npx vitest run tests/lib/wizardAbilities.test.ts`
Expected: the "never throws" test PASSES; the two coverage tests PASS ONLY once Task 4 fills all 60 (the fallback satisfies length limits too, so they may already pass — that's fine; Task 4 replaces fallbacks with real text). `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/wizardAbilities.ts lib/wizardEpithet.ts tests/lib/wizardAbilities.test.ts
git commit -m "feat(data): wizard ability + epithet modules with role/spell fallback"
```

---

### Task 4: Write all 60 abilities + epithets (author + USER APPROVAL GATE)

**Files:**
- Modify: `lib/wizardAbilities.ts`, `lib/wizardEpithet.ts`

- [ ] **Step 1: Author all 60 entries**

For EACH of the 60 wizards, write a hand-crafted `{ name, blurb }` ability and an `epithet`, in Italian, derived from role + typical spell + house + character lore. Constraints (enforced by the Task 3 tests): ability `name` ≤ 28 chars, `blurb` ≤ 96 chars, epithet ≤ 26 chars. The `name` is the personal trait (e.g. "Gioco Leale", "Crudeltà"), NOT the spell name. Keep voice consistent and characterful; avoid repetition across wizards.

- [ ] **Step 2: USER APPROVAL GATE**

Write the full 60-entry list to `docs/superpowers/mockups/2026-07-07-abilities.md` (a readable table: id · role · epithet · ability name · blurb) and present it to the user for review. The user corrects the wizards they care about; apply their edits. Do NOT proceed until the user approves.

- [ ] **Step 3: Run coverage + typecheck**

Run: `npx vitest run tests/lib/wizardAbilities.test.ts` → PASS (all 60 real, within limits). `npm run typecheck` → clean.

- [ ] **Step 4: Commit**

```bash
git add lib/wizardAbilities.ts lib/wizardEpithet.ts docs/superpowers/mockups/2026-07-07-abilities.md
git commit -m "content(cards): 60 hand-written wizard abilities + epithets (user-approved)"
```

---

### Task 5: Wire the real ability/epithet into the card + full visual pass

**Files:**
- Modify: `components/cards/WizardCard.tsx` (replace the Task 2 stub with `abilityFor`/`epithetFor`)
- Test: `tests/ui/wizardCard.test.tsx`

- [ ] **Step 1: Replace the stub**

In `WizardCard`, import `abilityFor` from `@/lib/wizardAbilities` and `epithetFor` from `@/lib/wizardEpithet`; feed `abilityFor(wizard.id)` into `AbilityPlate` and `epithetFor(wizard.id)` into the epithet kick. Remove the temporary inline stub from Task 2.

- [ ] **Step 2: Add a wiring test**

```ts
it('shows the wizard\'s real personal ability name on the plate', () => {
  const w = draftedTank() // a real wizard id
  render(<WizardCard drafted={w} />)
  expect(screen.getByTestId('ability-plate')).toHaveTextContent(abilityFor(w.wizard.id).name)
})
```

- [ ] **Step 3: Run + typecheck**

Run: `npx vitest run tests/ui/wizardCard.test.tsx` → PASS. `npm run typecheck` → clean.

- [ ] **Step 4: Visual pass across all 3 contexts (GPU headed)**

Screenshot the card in DRAFT (`DraftBoard`), TEAM (`TeamScreen`), and RECRUIT (`RecruitScreen`) — the card appears in different sizes/grids (`WizardCardColumn` vs `Row`). Confirm the poster layout holds in each (no clipped text, readable stats, synergy nudge placement). Save screenshots.

- [ ] **Step 5: Commit**

```bash
git add components/cards/WizardCard.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(ui): wire real wizard abilities + epithets into the poster card"
```

---

### Task 6: Full regression + handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Full suite + typecheck**

Run: `npm run test` → all green (report count). `npm run typecheck` → clean. Fix any sibling card test that asserted the OLD chip layout — only if the assertion intent is preserved; flag each.

- [ ] **Step 2: Update HANDOFF + commit + push**

Add a section to `docs/superpowers/HANDOFF.md` (draft poster cards: role gem + spell block + gold ability plate + synergy nudge; 60 hand-written abilities; corrected role tooltips; combat restyle deferred). Update its "Ultimo commit" header. Then:

```bash
git add -A
git commit -m "docs(handoff): draft poster cards"
git push origin master
```

---

## Self-review notes

- Spec coverage: role verbs/accents + corrected tooltips (Task 1), poster layout + RoleBadge/AbilityPlate + synergy nudge + portrait fallback (Task 2), ability/epithet modules with fallback (Task 3), 60 hand-written texts + approval gate (Task 4), wiring + 3-context visual pass (Task 5), regression + handoff (Task 6). All covered.
- Props signature unchanged (Global Constraints) — consumers untouched; Task 5's 3-context visual pass is the guard.
- Combat explicitly out of scope (Global Constraints) — no `components/battle/*` in any task.
- Type consistency: `abilityFor(id) → {name,blurb}` and `epithetFor(id) → string` used identically in Tasks 2/3/5; `ROLE_VERB`/`ROLE_ACCENT` keyed by `Role`.
- The Task 2 stub → Task 5 real-wiring split is deliberate: it verifies the card ENGINE on screen (Task 2 Step 6) before the 60 texts exist, so a layout problem is caught on the component, not after authoring 60 entries. No wasted work.
