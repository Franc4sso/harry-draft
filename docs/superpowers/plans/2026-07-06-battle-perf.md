# Battle replay performance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Eliminate the per-tick render cost that makes combat replay feel heavy/laggy, WITHOUT changing any visual behavior or animation quality.

**Architecture:** The frame pointer (`index`) lives in `BattleScreen`; every replay tick re-renders the whole battle subtree because nothing is memoized, and per-tick work includes an O(n²) full-history rescan (`recapTotals`) run 2–4× and fresh `.slice()`/`.map()` allocations that defeat memo. Fix = stabilize prop identity (useMemo on derived arrays), add `React.memo` boundaries at the heavy leaves, and make `recapTotals` cheap per tick (memoize on index). No Pixi/GSAP/backdrop changes — those are already well-scoped.

**Tech Stack:** React, Next.js, framer-motion, Pixi (untouched), Vitest.

## Global Constraints

- **ZERO visual change.** Same animations, same quality, same layout. This is pure render-cost removal. Every existing battle UI test must stay green; do NOT alter animation targets, durations, or DOM structure except where required to stabilize identity (and even then the rendered output must be identical).
- `npm run test` does NOT run typecheck → run `npx tsc --noEmit` per task.
- Determinism/engine untouched — this is UI-render only. No change to `simulate`/replay DATA, only how the React tree consumes it.
- Verify with existing tests (`tests/ui/`, `tests/screens/`, `tests/ui/useBattleReplay.test.tsx`). Add micro-tests only where a pure helper's behavior is newly extracted (e.g. incremental recap).

---

### Task 1: Make `recapTotals` cheap per tick (memoize the growing scan)

**Files:**
- Modify: `components/screens/BattleScreen.tsx` (the two `BattleRecap` call sites + the two mobile-layout copies)
- Modify: `components/battle/BattleRecap.tsx` (wrap in React.memo; stop recomputing on identity-only changes)
- Possibly: `lib/battleRecap.ts` (only if an incremental form is cleaner than memoization)
- Test: `tests/ui/` existing BattleRecap/screen tests must stay green; add `tests/lib/battleRecapMemo.test.ts` if a pure helper is extracted.

**Problem (evidence):** `BattleScreen.tsx:152-153` passes `replay.frames.slice(0, r.index+1)` (fresh array every tick) to `BattleRecap`, whose `recapTotals` (`lib/battleRecap.ts:25`) loops over ALL frames 0..index every render — O(n²) across the replay, run for left+right AND both layout copies (2–4×/tick).

**Approach (pick the simpler that works):**
- **Preferred:** memoize the recap result in `BattleScreen` keyed on `r.index` (and side), so the O(n) scan runs once per frame advance instead of per render, and pass a STABLE reference to `BattleRecap` (then `React.memo(BattleRecap)` actually holds). Use `useMemo(() => recapTotals(replay.frames.slice(0, r.index+1), replay.units, side), [replay, r.index, side])` for each side — computed once, shared by both layout copies.
- If the recap is purely additive per frame, an incremental accumulator (fold only the newest frame) is even better, but only do this if it doesn't complicate the code — the memo-on-index already removes the per-render waste.

- [ ] **Step 1: Characterize current behavior with a test**

Add `tests/lib/battleRecap.test.ts` (if not already covered) asserting `recapTotals(frames, units, side)` returns the same totals it does today for a small hand-built frame list (lock in behavior so the optimization can't change output). Run it green FIRST (characterization, not TDD-red).

- [ ] **Step 2: Memoize in BattleScreen**

Compute `leftRecap`/`rightRecap` via `useMemo` keyed on `[replay, r.index]`, pass the same reference to both the desktop and mobile `BattleRecap` instances. Wrap `BattleRecap` export in `React.memo`.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/ui tests/screens` — Expected: all green (no visual/DOM change).
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add components/screens/BattleScreen.tsx components/battle/BattleRecap.tsx lib/battleRecap.ts tests/lib/battleRecap.test.ts
git commit -m "perf(battle): memoize recap totals per frame — kill O(n²) per-tick rescan"
```

---

### Task 2: Stabilize BattleArena derived arrays + memoize UnitBust

**Files:**
- Modify: `components/battle/BattleArena.tsx` (useMemo `left`/`right`/`telegraph`/`appliedControl`; stable empty-array fallback for effects)
- Modify: `components/battle/UnitBust.tsx` (wrap export in React.memo)
- Test: `tests/ui/` battle/unitBust tests stay green.

**Problem (evidence):** `BattleArena.tsx:67-68` allocates `replay.units.filter(...)` per render; `renderSide` builds fresh prop objects + `effects={statusEffects[u.key] ?? []}` creates a new `[]` per unit per render, defeating memo. None of `left/right/telegraph/appliedControl` are memoized. `UnitBust` is not `React.memo`.

**Approach:**
- `useMemo` for `left` and `right` keyed on `[replay.units]` (units are stable across ticks — the per-frame data comes via `statusEffects`/`hp`/`spd` props, not the unit list).
- Hoist a module-const `EMPTY: ActiveEffect[] = []` and use it as the fallback so units with no effects get a STABLE reference.
- `useMemo` `telegraph`/`appliedControl` on the frame-relevant deps (`frameKey`, relevant maps).
- Wrap `UnitBust` in `React.memo`. Its props must now be identity-stable frame-to-frame when the unit didn't change: `effects` (stable via EMPTY or the frame's array — the frame array IS new each tick only when effects change, acceptable), `hp`/`spd` primitives, callbacks (ensure any passed handler is stable — useCallback if needed).

- [ ] **Step 1: Memoize derived arrays in BattleArena**

`const left = useMemo(() => replay.units.filter(u => u.side==='left'), [replay.units])` (same right). Module-const `EMPTY`. Memoize telegraph/appliedControl on their real deps.

- [ ] **Step 2: React.memo on UnitBust**

Wrap export. Verify no prop is an inline-created object/array/function that changes every render (fix the ones that are — stable EMPTY, useCallback handlers).

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/ui tests/screens` — all green.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add components/battle/BattleArena.tsx components/battle/UnitBust.tsx
git commit -m "perf(battle): memoize BattleArena derivations + React.memo UnitBust"
```

---

### Task 3: Stabilize BattleLog + InitiativeBar per-tick allocations

**Files:**
- Modify: `components/screens/BattleScreen.tsx` (memoize the `entries` slice passed to BattleLog)
- Modify: `components/battle/BattleLog.tsx` (React.memo)
- Modify: `components/battle/InitiativeBar.tsx` (useMemo the sort/rebuild; React.memo)
- Test: existing tests stay green.

**Problem (evidence):** `BattleScreen.tsx:169` `.slice(1,index+1).map(...)` fresh per tick. `InitiativeBar.tsx:32-36` filter/sort/`Object.fromEntries` rebuilt every render (+ `layout` FLIP animation on each slot). `BattleLog`/`InitiativeBar` not memoized.

**Approach:**
- Memoize `entries` in BattleScreen on `[replay, r.index]`.
- `useMemo` the InitiativeBar ordering on its real deps; keep the `layout` animation (visual — do NOT remove), just stop rebuilding the array identity every render so memo holds.
- `React.memo` both components.
- Do NOT touch the `layout` prop or any animation — quality unchanged.

- [ ] **Step 1: Memoize entries + InitiativeBar ordering**

- [ ] **Step 2: React.memo BattleLog + InitiativeBar**

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/ui tests/screens` — all green.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add components/screens/BattleScreen.tsx components/battle/BattleLog.tsx components/battle/InitiativeBar.tsx
git commit -m "perf(battle): memoize BattleLog entries + InitiativeBar ordering"
```

---

### Task 4: Memoize prop-less ambient components + full regression

**Files:**
- Modify: `components/battle/ArenaBackdrop.tsx` (React.memo — it takes no props, so it should NEVER re-render after mount)
- Test: full suite + typecheck + build.

**Problem:** `ArenaBackdrop` takes no props but re-renders every tick purely from parent re-render (#1). Wrapping in `React.memo` makes it render once. Its infinite CSS/compositor animations are unaffected (they live in the DOM/compositor, not React).

- [ ] **Step 1: React.memo ArenaBackdrop**

- [ ] **Step 2: Full regression**

Run: `npm run test` — all green (expect the same count + any new micro-tests).
Run: `npm run typecheck` — clean.
Run: `npm run build` — succeeds.

- [ ] **Step 3: Commit + push**

```bash
git add components/battle/ArenaBackdrop.tsx
git commit -m "perf(battle): React.memo ArenaBackdrop (prop-less, was re-rendering per tick)"
git push origin master
```

---

## Self-Review notes
- Every task is memoization / identity-stabilization only — NO animation target, duration, or DOM change. The "zero visual change" constraint is the review's primary lens: a finding that any task altered rendered output or animation is a defect.
- Pixi/GSAP/`effects.ts`/`ArenaBackdrop` infinite loops deliberately NOT touched (diagnosis says already well-scoped) — only `React.memo` on ArenaBackdrop to stop wasted re-renders.
- Risk: a `React.memo` that silently breaks because a prop is still identity-unstable → the component still works (just doesn't skip render), no correctness bug. Reviewer should spot-check that the memo boundaries actually hold (props are stable), else the perf win is partial.
- Ordering: Task 1 (biggest lever, O(n²)) first; each task independently shippable and green.
