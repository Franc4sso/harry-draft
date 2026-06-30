# Lacrime di Fenice (resurrection consumable) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development. Steps use
> checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-06-30-resurrection-consumable-design.md`.

**Goal:** A one-shot consumable relic ("Lacrime di Fenice") the player activates on the map (before any
node) to revive all dead wizards; it is then removed from inventory. New active-use/consumable mechanism
(relics are passive today). Doubles as the mid-area recovery lever.

**Architecture:** one new `Relic.active?: 'revive'` discriminator (passive combat scan ignores it → zero
engine-combat change); one pure out-of-node mutation `useConsumableRelic(state, relicId)` in
`runEngine.ts` (modeled on `setWizardSpell`, NO rng); one relic data entry; one controller callback +
one "Usa" button in the map sidebar. Validation = engine unit tests + a UI test.

**Tech Stack:** TypeScript, Vitest, React (the RunB roguelite loop), `@/`-aliased imports.

## Global Constraints
- **Determinism:** `useConsumableRelic` takes NO `Rng` (like `setWizardSpell`). Revive is deterministic;
  pulling from the rng stream out-of-band would desync seeded node generation. The full suite stays green.
- **"Consumed" = removed from `state.relics`**, NOT a mutable boolean on `ActiveRelic`. Persists free via
  `saveRun`. (`state.relics.filter(a => a.relic.id !== relicId)` is the first relic-removal in the codebase.)
- **Revive-only, not heal:** dead → `currentHp = maxHp`; living wounded are left untouched (that's the
  Infermeria's job). Reuse the gated revive `isDead(dw) ? { ...dw, currentHp: dw.maxHp } : dw`.
- **Recompute synergies after revive** (revived wizards re-enter the living set). Mirror
  `resolvers/recruit.ts:37` (`detectSynergies(livingOf(team))`). Do NOT copy the Infermeria's omission.
- **No-op guards (no waste):** unowned id, non-`active:'revive'` relic, or zero dead wizards → return
  `state` UNCHANGED (relic NOT consumed).
- **Live loop = RunB only.** Ignore the legacy test-only `game/engine/run.ts`.
- **Italian copy** for the relic `name`/`desc` and the "Usa" button.
- Run tests with `npx vitest run <path>`. Typecheck with `npx tsc --noEmit` (vitest does NOT typecheck).

---

### Task 1: Engine + data — `active` field, `useConsumableRelic`, the relic

**Files:**
- Modify: `types/relic.ts` (add `active?: 'revive'` to `Relic`)
- Modify: `game/engine/runEngine.ts` (add `useConsumableRelic`, near `setWizardSpell`)
- Modify: `data/relics.ts` (add `lacrime-fenice`)
- Modify/Test: `tests/data/relics.test.ts` (widen invariant to accept `active`)
- Test: `tests/engine/useConsumableRelic.test.ts`

- [ ] **Step 1 — Type.** In `types/relic.ts`, add to `Relic`:
  ```ts
  /** Consumable active-use relic (not a passive combat descriptor). 'revive' = Lacrime di Fenice. */
  active?: 'revive'
  ```
  `npx tsc --noEmit` → PASS (optional, no consumer yet).

- [ ] **Step 2 — TDD: write `tests/engine/useConsumableRelic.test.ts` FIRST.** Confirm the real
  `RunState` shape and how synergies are stored on it (read `types/run.ts` + `resolvers/recruit.ts` +
  how `setWizardSpell` builds its return) so the test asserts the actual fields. Build a minimal
  `RunState` fixture (mirror existing runEngine/resolver tests). Cover:
  - revive: a state with a dead wizard (`currentHp: 0`) + a `lacrime-fenice` in `relics` → after
    `useConsumableRelic(state, 'lacrime-fenice')`, that wizard's `currentHp === maxHp`, AND the relic is
    GONE from `relics`;
  - living-untouched: a wounded-but-alive wizard (`currentHp` between 0 and maxHp) is NOT topped up;
  - synergies recomputed: if reviving changes the living set enough to (de)activate a synergy, the
    state's synergy field reflects the new living roster (assert against `detectSynergies(livingOf(team))`);
  - no-op guards (each returns the SAME state, relic still present): unowned id; a relic without
    `active:'revive'`; a team with zero dead wizards.
  Run → RED (fn missing).

- [ ] **Step 3 — Implement `useConsumableRelic` in `runEngine.ts`** per the spec's Section 2 logic.
  Place it beside `setWizardSpell`. No `Rng` param. Run the test → GREEN. `npx tsc --noEmit` → PASS.

- [ ] **Step 4 — Relic data.** In `data/relics.ts`, append
  `{ id: 'lacrime-fenice', name: 'Lacrime di Fenice', desc: '<IT, una sola volta>', rarity: 'epica', active: 'revive' }`.
  Match the exact `Relic` object shape of neighbors.

- [ ] **Step 5 — Widen relics invariant.** In `tests/data/relics.test.ts`, add `active` to the
  "relic does something" disjunction (mirror how `grantsExecute`/`grantsAlwaysHit` were accepted). It
  must still reject an empty relic. Run `npx vitest run tests/data/relics.test.ts` → PASS.

- [ ] **Step 6 — Full suite + typecheck.** `npm test` green (no combat change → no snapshot churn).
  `npx tsc --noEmit` → PASS.

- [ ] **Step 7 — Commit.**
  ```bash
  git add types/relic.ts game/engine/runEngine.ts data/relics.ts tests/data/relics.test.ts tests/engine/useConsumableRelic.test.ts
  git commit -m "feat(consumable): Relic.active + useConsumableRelic revive engine + Lacrime di Fenice"
  ```

---

### Task 2: Controller + UI — `useConsumableRelic` callback + "Usa" button

**Files:**
- Modify: `hooks/useRunB.ts` (add `useConsumableRelic` to the controller)
- Modify: `components/relics/RelicBar.tsx` (or a sibling) — the "Usa" button on consumables
- Modify: `components/screens/RunBRunner.tsx` (wire the callback to the sidebar)
- Test: `tests/ui/consumableRelic.test.tsx` (mirror `tests/ui/loadoutPanel.test.tsx`)

- [ ] **Step 1 — Controller.** In `hooks/useRunB.ts`, add `useConsumableRelic(relicId: string)` to
  `RunBController`, modeled 1:1 on `setWizardSpell` (`useRunB.ts:119-121`): call the pure
  `useConsumableRelic(state, relicId)`, then `commit(next)` (no view change). Confirm the real import +
  commit shape by reading the existing `setWizardSpell` controller.

- [ ] **Step 2 — UI button.** In the map sidebar relic list (`RelicBar.tsx` rendered via
  `RunBRunner.tsx`), for each owned relic with `active === 'revive'` render an Italian **"Usa"** button.
  Enabled only when `team.some(isDead)` (import `isDead` from `game/engine/roster`); otherwise
  `disabled` with a hint (e.g. title "Nessun mago caduto"). On click → the wired `onUse(relicId)`
  callback. Keep `RelicBar`'s existing read-only pills intact; add the button without breaking current
  usages (it's also rendered in battle — guard so the button only shows where an `onUse` is provided,
  e.g. make `onUse` an optional prop and render the button only when present).

- [ ] **Step 3 — Wire.** In `RunBRunner.tsx`, pass `controller.useConsumableRelic` as `onUse` to the
  sidebar `RelicBar` on the map view (NOT in the battle render path). Pass the current `team` so the
  button can compute `isDead`.

- [ ] **Step 4 — UI test.** `tests/ui/consumableRelic.test.tsx` (mirror `loadoutPanel.test.tsx`):
  render the relic bar with a `lacrime-fenice` owned + a dead wizard → "Usa" present & enabled → click
  calls `onUse('lacrime-fenice')`. With no dead wizard → button disabled (and clicking does not fire).

- [ ] **Step 5 — Verify.** `npx vitest run tests/ui/consumableRelic.test.tsx` → PASS. Full `npm test`
  green. `npx tsc --noEmit` → PASS (run tsc — new tsx files).

- [ ] **Step 6 — Commit.**
  ```bash
  git add hooks/useRunB.ts components/relics/RelicBar.tsx components/screens/RunBRunner.tsx tests/ui/consumableRelic.test.tsx
  git commit -m "feat(consumable): Usa button + useConsumableRelic controller wired on the map"
  ```

---

### Task 3: Docs

- [ ] Update `docs/superpowers/remaining-work.md`: mark the resurrection-consumable item DONE (note it
  also serves as the mid-area recovery lever that unblocks the strong-final-boss item). Commit.
