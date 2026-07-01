# Strong Final Boss — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise `BALANCE.campaignB.finalBossMenace` to the strongest value that keeps `campaignBalanceB` winRate strictly above 0.15, giving the final boss a real climax without breaking campaign completion.

**Architecture:** `finalBossMenace` is a dedicated lever — the combat resolver applies it ONLY to the final boss (`isFinalBoss ? cb.finalBossMenace : menaceForLevel(...)`), so raising it touches no other enemy. Task 1 measures campaignBalanceB as the boss rises and locks the max value holding the floor; Task 2 guards the 4 archetype sweeps + the finalBossClimax tripwire (which flips by design if parity is reached) and annotates the result.

**Tech Stack:** TypeScript, Vitest. One data constant (`data/constants.ts`), two test files touched (`campaignBalanceB.test.ts` comment log, `finalBossClimax.test.ts` assert/comment).

## Global Constraints

- ONLY lever this slice: `BALANCE.campaignB.finalBossMenace` (currently -0.384, statMult 0.616). Do NOT change `menaceOffset`, `menacePerLevel`, `growthBudgetPerLevel`, level-base constants, or any wizard/relic data.
- Parity target after the snowball pass: `1 + menaceForLevel(levelMax=10) = 1 + 0.08 = 1.08`. finalBossMenace = 0.08 → statMult 1.08 = full parity.
- `campaignBalanceB` band: winRate ∈ (0.15, 0.45) strict. Raising the boss lowers winRate, so the risk is the 0.15 floor, not 0.45.
- Archetype sweep floors: `veleno/esecuzione/scudiRigen/magieOscure` each above floor (0.05). Post-snowball baseline: 0.608 / 0.800 / 0.142 / 0.742.
- `finalBossClimax.test.ts` assertions (line 36 and 46): (a) `finalStatMult > 0.60` stays green; (b) `finalStatMult < areaBossStatMult (1.08)` — if the chosen value reaches 0.08 (parity), this MUST be updated coherently (assert + comment), not left failing.
- Sweeps run at collection time, ~120 seeds, SLOW — run individually, never the full suite during iteration.
- `npm run test` skips typecheck — run `npx tsc --noEmit` on any change.
- Verify HEAD before each commit (`git rev-parse HEAD`); commit + push to master when a task's deliverable is done (standing user permission).

---

### Task 1: Raise finalBossMenace to the max holding the 0.15 floor

Empirical: raise the constant, measure campaignBalanceB, repeat, lock the strongest value that keeps winRate > 0.15.

**Files:**
- Modify: `data/constants.ts` (`BALANCE.campaignB.finalBossMenace`)
- Modify: `tests/engine/campaignBalanceB.test.ts` (append a dated calibration comment — the file has a running log convention at the top)
- Reference (do not modify): `game/engine/resolvers/combat.ts` (confirms the lever is final-boss-only), `game/engine/combat/threat.ts` (`menaceForLevel`).

**Interfaces:**
- Consumes: current `finalBossMenace = -0.384`; campaignBalanceB baseline winRate 0.2000.
- Produces: a committed `finalBossMenace` value = the max holding winRate > 0.15, with the measured progression recorded.

- [ ] **Step 1: Confirm the lever is final-boss-only**

Read `game/engine/resolvers/combat.ts` and confirm the line `const rightMenace = isFinalBoss ? cb.finalBossMenace : menaceForLevel(pkg.enemyLevel)`. This verifies raising `finalBossMenace` affects only the final fight. No edit — a sanity read so you know the blast radius.

- [ ] **Step 2: Record the pre-raise campaignBalanceB baseline**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts -t "winnable" 2>&1 | tail -15`
Expected: PASS, winRate ≈ 0.2000. Note it. This is the starting point.

- [ ] **Step 3: Raise finalBossMenace one step and measure**

Edit `data/constants.ts`: change `finalBossMenace: -0.384` to a higher value. First step: `-0.30` (statMult 0.70). Re-run the Step 2 command. Record winRate. Because raising the boss lowers completion, winRate will drop from 0.20.

- [ ] **Step 4: Iterate to the max holding the floor**

Continue raising in small steps (~+0.05-0.08 menace) — e.g. -0.30 → -0.22 → -0.14 → -0.06 → 0.02 → 0.08(parity) — re-running the Step 2 command each time and recording each `finalBossMenace → winRate` pair. Find the HIGHEST `finalBossMenace` whose winRate is still strictly > 0.15. If parity (0.08) itself holds > 0.15, use 0.08 (full climax). If it drops below, back off to the last value > 0.15. Set `finalBossMenace` to that locked value.

- [ ] **Step 5: Record the calibration in the comment log**

Append a dated (2026-07-01) entry to the running comment block at the TOP of `tests/engine/campaignBalanceB.test.ts`, following the existing convention: note the final-boss raise, the measured progression (each menace → winRate), the locked `finalBossMenace` value, its statMult, the final winRate, and whether parity was reached. Do NOT change any assertion in that file — the band (0.15, 0.45) stays.

- [ ] **Step 6: Typecheck + confirm the gate still passes**

Run: `npx tsc --noEmit` (expect 0), then `npx vitest run tests/engine/campaignBalanceB.test.ts 2>&1 | tail -8` (expect all pass — winRate in band, deterministic, no stalls).

- [ ] **Step 7: Commit**

```bash
git rev-parse HEAD
git add data/constants.ts tests/engine/campaignBalanceB.test.ts
git commit -m "balance(final-boss): raise finalBossMenace to the max holding the 0.15 floor"
git push origin master
```

---

### Task 2: Guard sweeps + handle tripwire + annotate

Verify the 4 archetype sweeps still hold; update the finalBossClimax tripwire coherently (it flips by design if parity was reached); annotate the outcome.

**Files:**
- Reference/verify: `tests/engine/velenoSweep.test.ts`, `tests/engine/esecuzioneSweep.test.ts`, `tests/engine/scudiRigenSweep.test.ts`, `tests/engine/magieOscureSweep.test.ts`.
- Modify: `tests/engine/finalBossClimax.test.ts` (assertion line 46 + header comment — ONLY if parity reached; else comment only), `docs/superpowers/remaining-work.md`.
- Possibly modify (only if a sweep fell): `data/constants.ts` — but this slice's only lever is finalBossMenace, so a fallen sweep is ricalibrated by backing finalBossMenace down slightly, NOT by touching other constants.

**Interfaces:**
- Consumes: the locked `finalBossMenace` from Task 1; whether parity (0.08) was reached.
- Produces: all 5 gates green (or tripwire updated coherently); documented final state.

- [ ] **Step 1: Run the 4 archetype sweeps individually**

Run each separately (slow, ~120 seeds — avoid CPU saturation):
`npx vitest run tests/engine/velenoSweep.test.ts 2>&1 | tail -12`
then esecuzioneSweep, scudiRigenSweep, magieOscureSweep. Record each winRate. All must stay above floor (0.05). Baseline was 0.608 / 0.800 / 0.142 / 0.742; raising only the final boss should barely move them (it affects one fight per run).

- [ ] **Step 2: If any sweep fell below floor, back off finalBossMenace**

If a sweep dropped under 0.05: lower `finalBossMenace` by one small step (making the boss slightly weaker), re-run the failing sweep AND campaignBalanceB (`-t "winnable"`) to confirm both hold. Iterate minimally. Do NOT touch any constant other than finalBossMenace. (Expected: no back-off needed — noted here for completeness.)

- [ ] **Step 3: Evaluate the finalBossClimax tripwire**

Run: `npx vitest run tests/engine/finalBossClimax.test.ts 2>&1 | tail -12`

Two outcomes:
- **If both tests PASS** (locked finalBossMenace < 0.08, boss still below parity): no assertion change. Skip to Step 5.
- **If the second test FAILS** (`finalStatMult < areaBossStatMult` no longer true because finalBossMenace reached 0.08 = parity): this is the DESIGNED flip. Proceed to Step 4.

- [ ] **Step 4: (Only if parity reached) Update the tripwire to assert parity**

In `tests/engine/finalBossClimax.test.ts`, the second test (line ~40-46) currently asserts the boss is BELOW parity. Update it to assert parity is REACHED. Change line 46 from:

```typescript
    expect(finalStatMult).toBeLessThan(areaBossStatMult)
```

to:

```typescript
    expect(finalStatMult).toBeGreaterThanOrEqual(areaBossStatMult)
```

Rename the test string from "is still below area-boss parity (the deferred climax goal)" to "reaches area-boss parity (climax goal met)" and update its inline comment to say the deferred goal is now achieved. Also update the file's header comment block (the "DEFERRED" section) to record that parity was reached on 2026-07-01. Re-run the file: `npx vitest run tests/engine/finalBossClimax.test.ts 2>&1 | tail -8` — expect both pass.

- [ ] **Step 5: Annotate the outcome**

- In `tests/engine/finalBossClimax.test.ts` header comment: record the final `finalBossMenace` value, its statMult, the final campaignBalanceB winRate, and whether parity was reached or how close.
- In `docs/superpowers/remaining-work.md` item #1: mark the strong-final-boss step done, record the locked finalBossMenace + statMult + campaignBalanceB winRate + remaining headroom above 0.15. Note the scripted-boss (P4) and house-scissor slices remain.

- [ ] **Step 6: Full suite + typecheck + commit**

```bash
npx tsc --noEmit
npx vitest run 2>&1 | tail -6
git rev-parse HEAD
git add tests/engine/finalBossClimax.test.ts docs/superpowers/remaining-work.md data/constants.ts
git commit -m "balance(final-boss): guard sweeps + tripwire; annotate climax outcome"
git push origin master
```

Expected: suite fully green (860 tests; finalBossClimax assertion possibly updated, not added).

---

## Self-Review notes

- **Spec coverage:** Sez.1 measure&apply → Task 1. Sez.2 tripwire&gate → Task 2 (both tripwire branches: pass-through Step 3, flip Step 4). Sez.3 out-of-scope → Global Constraints (only finalBossMenace lever). Decoupled-lever fact → Task 1 Step 1 + Global Constraints.
- **Placeholder scan:** the finalBossMenace final value is intentionally measured (Task 1 Step 4), not a placeholder — the plan's contract is "raise until the floor". The tripwire update is fully specified with exact before/after code (Task 2 Step 4). All commands complete.
- **Type consistency:** `finalStatMult`/`areaBossStatMult` names match the actual test (lines 31, 44); assertion change targets the real line 46. campaignBalanceB band untouched.
