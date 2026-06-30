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

### Task 1: The tune — modest Voldemort + Bellatrix base-atk trim, re-enable the gate

> ⚠️ REVISED LEVER (post-diagnosis, user decision): the root cause is the **win-based leveling
> snowball** amplifying Serpeverde's strong starters' BASE atk into one-shots — NOT spell power
> (zeroing sectumsempra+deatheater+spietatezza only reached 0.825). Spell-power levers are OFF the
> table. The lever is a modest **base-atk trim of Voldemort (40→~34) + Bellatrix (~38→~32)** in
> `data/wizards.ts`, sparing global leveling and enemy budget so Grifondoro stays put.

**Files:**
- Modify: `data/wizards.ts` (Voldemort `ranges.atk` and Bellatrix `ranges.atk`; + other top Serpeverde
  attackers ONLY if the gate won't close with these two)
- Modify: `tests/engine/serpeverdeBalance.test.ts` (re-enable `winRate < 0.60` — ALREADY done in the
  working tree by the prior attempt; fix its stale comment that says "tuning sectumsempra.power" → the
  real lever is the base-atk trim)
- Refresh comments: `tests/engine/{velenoSweep,esecuzioneSweep,magieOscureSweep}.test.ts` (win-rate
  comments only, if their printed numbers moved) + `houseEffects.ts` stale 0.742 comment
- Regen as needed: `tests/engine/combat/__snapshots__/*`, `replay.test.ts`/`replayRelics.test.ts` fixtures

- [ ] **Step 1 — Baseline & confirm gate.** Run `npx vitest run tests/engine/serpeverdeBalance.test.ts`;
  record the printed winRate (~0.925). The `winRate < 0.60` assertion is ALREADY re-enabled in the
  working tree (RED). Read the current Voldemort + Bellatrix `ranges.atk` in `data/wizards.ts` and
  record them. (Voldemort is documented ~[35,45] midpoint 40; find Bellatrix's actual range.)

- [ ] **Step 2 — Trim Voldemort + Bellatrix base atk.** In `data/wizards.ts`, lower Voldemort's
  `ranges.atk` so its midpoint is ~34 (e.g. [30,38]) and Bellatrix's so its midpoint is ~32. Keep
  Voldemort still among the highest attackers (NOT gutted). Re-run the sweep. Iterate the two ranges
  down until `winRate < 0.60`, aiming for a ~0.50-0.55 margin (noise guard). Do NOT crater the house
  below ~0.40 (a competent Serpeverde must stay viable) — if you're heading there, you've over-trimmed,
  back off.

- [ ] **Step 3 — Extra Serpeverde attackers ONLY if needed.** If Voldemort+Bellatrix at sane values
  (Voldemort midpoint ≥ ~32) can't pull winRate under 0.60, identify the next top-power Serpeverde
  attacker the sweep drafts (e.g. via `powerOf`) and trim its `ranges.atk` modestly too. Prefer the
  smallest combined change. Record every wizard + old→new range.

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
  git add data/wizards.ts tests/ game/engine/houseEffects.ts
  git commit -m "balance(serpeverde): trim Voldemort+Bellatrix base atk to clear the 0.60 gate"
  ```

---

### Task 2: Docs

- [ ] Update `docs/superpowers/remaining-work.md`: mark item #4 (Serpeverde/Voldemort balance) DONE
  with the final lever + number (e.g. "sectumsempra.power 2.4→X [+ deatheater 25→Y]; serpeverdeBalance
  winRate 0.925→Z, gate `< 0.60` re-enabled; Magie Oscure also cooled from 0.950→W"). Commit.
