# Boss finale forte (il climax) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use
> checkbox (`- [ ]`). Spec: `docs/superpowers/specs/2026-06-30-strong-final-boss-design.md`.

**Goal:** Make the final boss a real climax — raise its statMult from 0.60 toward the area-boss 1.33
(parity) — WITHOUT dropping `campaignBalanceB` below its 0.15 floor, by first making the sweep harness
model the shipped Lacrime di Fenice recovery lever (it currently ignores it). Lock a pure-math invariant
so the climax can't silently regress below the area boss.

**Architecture:** the boss strength is ONE constant (`data/constants.ts` `campaignB.finalBossMenace`,
statMult = `1 + finalBossMenace`, applied at `resolvers/combat.ts:58`). The win-band sweep
(`campaignBalanceB.test.ts` `runOne`) fights the final boss but never uses the consumable revive — make
it model `useConsumableRelic` mid-area. Add an invariant test. Then tune the constant up within the band.

**Tech Stack:** TypeScript, Vitest, the seeded campaign sweep harness.

## Global Constraints
- **Faithful harness, not gamed:** modeling `useConsumableRelic` in the sweep is fixing an under-model
  (the lever is shipped + real); declare the assumption "competent player has & uses the recovery lever."
  Use the REAL `useConsumableRelic(state, 'lacrime-fenice')` engine fn (pure, no rng) — do not fake it.
- **Only `finalBossMenace` moves** for boss strength. Do NOT touch `menaceOffset`/`menacePerLevel`
  (those shift ALL enemies and would break the curve + every sweep).
- **Determinism:** `useConsumableRelic` takes no rng; calling it in `runOne` must not desync the seeded
  node/enemy generation (it's a pure state transform on team+relics — verify the sweep stays
  deterministic: the test's own re-run determinism assertion must still pass).
- **Primary gate:** `campaignBalanceB` winRate stays in [0.15, 0.45] WITH the consumable modeled.
- **Climax invariant:** `1 + finalBossMenace >= 1 + menaceForLevel(BALANCE.leveling.levelMax)`.
- Run focused: `npx vitest run tests/engine/campaignBalanceB.test.ts` (prints winRate). Full `npm test`.
  Typecheck `npx tsc --noEmit`.

---

### Task 1: Model the recovery lever in the sweep + climax invariant + tune

**Files:**
- Modify: `tests/engine/campaignBalanceB.test.ts` (`runOne`: give the team a `lacrime-fenice` and call
  `useConsumableRelic` mid-area when a wizard is dead; re-baseline the recorded winRate + comment)
- Create: `tests/engine/finalBossClimax.test.ts` (pure-math invariant)
- Modify: `data/constants.ts` (`finalBossMenace` ↑; update the scan-log comment block)
- Re-baseline comments: `tests/engine/{esecuzioneSweep,velenoSweep,magieOscureSweep,scudiRigenSweep,serpeverdeBalance}.test.ts` (only if their printed winRate moves)

- [ ] **Step 1 — Baseline.** Run `npx vitest run tests/engine/campaignBalanceB.test.ts`; record winRate
  (~0.183) and confirm `finalBossMenace = -0.40` (statMult 0.60) and `menaceForLevel(levelMax)` (= the
  area-boss menace, ~+0.33 → statMult 1.33). Read `runOne` to see how it owns relics + handles the map.

- [ ] **Step 2 — Model the consumable in `runOne`.** Inject a `lacrime-fenice` `ActiveRelic` into the
  sweep run's `relics`, and add a branch: while on the map (before advancing past a node) if
  `state.team.some(isDead)` and the team owns a `lacrime-fenice`, call the REAL
  `useConsumableRelic(state, 'lacrime-fenice')` and continue with the returned state. Keep the existing
  re-run determinism assertion passing (the call is pure). Re-measure winRate (expect it to RISE above
  0.183 — the recovery lever reduces mid-area attrition). Record the new baseline.

- [ ] **Step 3 — Climax invariant test.** Create `tests/engine/finalBossClimax.test.ts`: assert
  `1 + BALANCE.campaignB.finalBossMenace >= 1 + menaceForLevel(BALANCE.leveling.levelMax)` (i.e. final
  boss statMult ≥ area boss statMult). Import the real constants + `menaceForLevel`. This will FAIL now
  (0.60 < 1.33) — it's the spec/RED for Step 4.

- [ ] **Step 4 — Raise `finalBossMenace`.** In `data/constants.ts`, raise it toward `+0.33` (parity,
  statMult 1.33) — the value that satisfies the invariant. Re-run `campaignBalanceB`: it must stay in
  [0.15, 0.45] (now with the consumable headroom from Step 2). If `+0.33` holds the band → keep it (try
  `+0.38`/1.38 only if the band still comfortably holds). The invariant test must PASS at the final value.
  Update the scan-log comment in `constants.ts` (drop the "climax awaits a future slice" note).

- [ ] **Step 5 — FORK if the band won't hold.** If, even with the consumable modeled, parity (`+0.33`)
  drops `campaignBalanceB` below 0.15, STOP and report: the achieved winRate at parity, and the highest
  `finalBossMenace` that DOES hold the band (its statMult). Do NOT relax the band floor or weaken the
  boss silently — the controller decides the difficulty fork.

- [ ] **Step 6 — Re-baseline other sweeps.** Run the full suite. For each other sweep whose recorded
  winRate comment moved (they fight the final boss too), refresh the comment. For any snapshot/replay
  test that pins a final-boss fight, READ the diff, confirm it's the intended menace change, regen with
  `-u`, and list it. `npm test` green, `npx tsc --noEmit` clean.

- [ ] **Step 7 — Commit.**
  ```bash
  git add tests/ data/constants.ts
  git commit -m "feat(final-boss): model recovery lever in sweep + raise finalBossMenace to area-boss parity; lock climax invariant"
  ```

---

### Task 2: Docs

- [ ] Update `docs/superpowers/remaining-work.md`: mark item #5 DONE with the final `finalBossMenace`
  value + statMult, the modeled-consumable harness change, and the invariant test (and, if the fork
  happened, the chosen resolution). Commit.
