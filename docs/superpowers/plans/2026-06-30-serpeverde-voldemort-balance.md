# Serpeverde / Voldemort balance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use
> checkbox (`- [ ]`). Spec: `docs/superpowers/specs/2026-06-30-serpeverde-voldemort-balance-design.md`.

**Goal:** Bring competent-Serpeverde winRate (live **0.925**, gate-disabled) under the intended **0.60**
band by lowering `sectumsempra.power` (root cause; user-preferred lever; not gutting Voldemort), with
`deatheater` synergy atk as a secondary lever if needed. Re-enable the band gate. Hold all guardrails.

**Architecture:** pure data/number tune — `data/spells.ts` (`sectumsempra.power`), optionally
`data/synergies.ts` (`deatheater.bonus.atk`), and re-enabling one commented assertion in
`tests/engine/serpeverdeBalance.test.ts`. No engine logic changes. It's an iterative measurement loop
against an objective gate, plus snapshot re-baselining.

**Tech Stack:** TypeScript, Vitest. Balance via the existing seeded sweep harness.

## Global Constraints (the gate + guardrails — ALL must hold at the end)
- **GATE:** `serpeverdeBalance.test.ts` with its real assertion `winRate < 0.60` RE-ENABLED must pass.
- **Guardrail 1:** `campaignBalanceB.test.ts` Grifondoro stays in **[0.15, 0.45]** (we touch no global
  scaling → expected unchanged; verify).
- **Guardrail 2:** `magieOscureCounters.test.ts` still passes (directional matchups; a flip = over-nerf
  → raise the power slightly).
- **Guardrail 3:** `magieOscureSweep.test.ts` passes (its band may move down — refresh the comment, do
  NOT push it under its own draftability floor).
- **Determinism / snapshots:** `combat/snapshots.test.ts`, `replay.test.ts`, `replayRelics.test.ts`
  pin exact damage → regen is expected. Regenerate ONLY after eyeballing the diff to confirm it's the
  intended damage drop (winner/turns coherent), not a structural regression.
- **User constraint:** do NOT change Voldemort's stat ranges. Lean on `sectumsempra.power` first.
- Run a focused sweep with `npx vitest run tests/engine/serpeverdeBalance.test.ts` (it prints winRate).
  Full suite `npm test`. Typecheck `npx tsc --noEmit`.

---

### Task 1: The tune — sectumsempra power (+ deatheater if needed), re-enable the gate

**Files:**
- Modify: `data/spells.ts` (`sectumsempra.power`)
- Modify (only if needed): `data/synergies.ts` (`deatheater` `bonus.atk` 25 → ~12)
- Modify: `tests/engine/serpeverdeBalance.test.ts` (re-enable `winRate < 0.60`; refresh stale comment)
- Refresh comments: `tests/engine/{velenoSweep,esecuzioneSweep,magieOscureSweep}.test.ts` (win-rate
  comments only, if their printed numbers moved)
- Regen as needed: `tests/engine/combat/__snapshots__/*`, `replay.test.ts`/`replayRelics.test.ts` fixtures

- [ ] **Step 1 — Baseline.** Run `npx vitest run tests/engine/serpeverdeBalance.test.ts` and record the
  printed winRate (expect ~0.925). Confirm the `winRate < 0.60` assertion is currently commented out.

- [ ] **Step 2 — Re-enable the gate FIRST (RED).** Uncomment the `expect(winRate).toBeLessThan(0.60)`
  assertion in `serpeverdeBalance.test.ts`. Run it → it FAILS at ~0.925. This is the gate you're tuning
  to satisfy (TDD-style: the failing band assertion is the spec).

- [ ] **Step 3 — Lower `sectumsempra.power`.** In `data/spells.ts`, drop `power: 2.4` toward ~1.8.
  Re-run the sweep. Iterate the value (e.g. 1.8 → 1.7 → 1.6) until `winRate < 0.60`. Keep a small
  margin under 0.60 (aim ~0.50-0.55) so noise doesn't reflake it — but do NOT crater it (a competent
  house should still be viable; if you find yourself below ~0.40 you've over-nerfed — back off).

- [ ] **Step 4 — Secondary lever ONLY if needed.** If a *reasonable* `sectumsempra.power` (≥ ~1.5)
  can't pull winRate under 0.60 alone, ALSO lower `deatheater` synergy `bonus.atk` (`data/synergies.ts`)
  from 25 toward ~12, and re-tune. Prefer the smallest combined change that clears the gate. Record the
  final pair of numbers.

- [ ] **Step 5 — Guardrails.** Run, and confirm all pass / hold:
  - `npx vitest run tests/engine/campaignBalanceB.test.ts` (Grifondoro still in [0.15,0.45]).
  - `npx vitest run tests/engine/magieOscureCounters.test.ts` (directional — still passes). If a
    matchup flipped, you over-nerfed sectumsempra → raise it a notch and re-tune Serpeverde via the
    deatheater lever instead.
  - `npx vitest run tests/engine/magieOscureSweep.test.ts` (passes; refresh its win-rate comment if the
    printed number moved; do not push under its draftability floor).

- [ ] **Step 6 — Full suite + snapshots.** Run `npm test`. For each FAILING snapshot/replay test, READ
  the diff: confirm it's the intended damage reduction (fewer/lower-damage hits, but coherent
  winner/turns), NOT a structural break. Then regenerate with `npx vitest run -u <path>`. Re-run
  `npm test` → all green. `npx tsc --noEmit` → PASS. In your report, list exactly which snapshots were
  regenerated and the one-line justification for each.

- [ ] **Step 7 — Refresh stale comments.** Update the win-rate diagnostic comments in
  `serpeverdeBalance.test.ts` (0.925/0.742 → the new number) and any sweep whose printed number moved.

- [ ] **Step 8 — Commit.**
  ```bash
  git add data/spells.ts data/synergies.ts tests/
  git commit -m "balance(serpeverde): lower sectumsempra power to clear the 0.60 gate (+deatheater if used)"
  ```

---

### Task 2: Docs

- [ ] Update `docs/superpowers/remaining-work.md`: mark item #4 (Serpeverde/Voldemort balance) DONE
  with the final lever + number (e.g. "sectumsempra.power 2.4→X [+ deatheater 25→Y]; serpeverdeBalance
  winRate 0.925→Z, gate `< 0.60` re-enabled; Magie Oscure also cooled from 0.950→W"). Commit.
