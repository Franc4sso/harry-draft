# Mira Infallibile (guaranteed-hit ability) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Spec:
> `docs/superpowers/specs/2026-06-30-infallibile-ability-design.md`.

**Goal:** Add a guaranteed-hit ability — some tier-2/3 wizards (tag `infallibile`) and a grant relic
(`occhio-magico`) make their basic attacks ignore the dodge roll: the direct counter to Grifondoro's
`dodgeBonus`. With a declared & tested counter matrix.

**Architecture:** one new `BattleUnit.alwaysHit` flag, one engine gate (`effects.ts:37`, add
`!ctx.actor.alwaysHit`), one pure per-unit computer (`teamAlwaysHit`, modeled on `teamExecute` but
returning a `Set<wizardId>`), one relic field (`grantsAlwaysHit`), stamped in `toBattleUnits`. Then
content (wizard tags + 1 relic), then validation (one counter test). Off-by-default: with no source,
`!undefined → true` so the gate is bit-identical to today and all existing seeded tests stay green.

**Tech Stack:** TypeScript, Vitest, the existing combat engine (`game/engine/`), `@/`-aliased imports.

## Global Constraints

- **Determinism is sacred:** the modified gate MUST be bit-identical when `alwaysHit` is absent. The
  `alwaysHit` path SKIPS the `rng.chance` roll (does not roll-and-ignore). Verify the FULL suite stays
  green after the engine-only change, BEFORE tagging any wizard. After tagging, only battles featuring
  a tagged wizard shift RNG; regenerate any affected snapshot via TDD (none expected unless a snapshot
  fixture uses a now-tagged wizard).
- **Pattern fidelity:** `teamAlwaysHit` mirrors `game/engine/execute.ts` `teamExecute` (relic +
  innate sources, pure, no RNG) but returns a `Set<string>` of wizard ids (per-unit, like
  `houseEffects`), empty when no source.
- **Tier guard lives in the computer**, not the data: only `wizard.tier >= 2` tagged wizards qualify.
- **Metric rule (validation):** assert on the **count of `'dodge'` log flags** (0 with the ability,
  >0 without), NEVER total damage (kill-speed confound — the `velenoSweep`/`esecuzione` lesson).
- **Italian copy** for the relic `name`/`desc` (matches existing content).
- Run tests with `npx vitest run <path>`. Typecheck with `npx tsc --noEmit` (vitest does NOT typecheck).

---

### Task 1: Engine — `alwaysHit` flag, gate, computer, relic field, stamp

**Files:**
- Modify: `types/combat.ts` (near `execute`/`dodgeBonus`)
- Modify: `types/relic.ts` (near `grantsExecute`)
- Modify: `game/engine/combat/effects.ts` (the dodge gate, ~line 37)
- Create: `game/engine/alwaysHit.ts`
- Test: `tests/engine/alwaysHit.test.ts`
- Modify: `game/engine/combat/simulate.ts` (`toBattleUnits` stamp)

**Interfaces produced:** `BattleUnit.alwaysHit?: boolean`; `Relic.grantsAlwaysHit?: boolean`;
`teamAlwaysHit(team, relics): Set<string>`.

- [ ] **Step 1 — Types.** In `types/combat.ts`, after the `execute?: {...}` field add:
  ```ts
  /** This unit ignores the target's dodge roll on canDodge effects (Mira Infallibile — anti-Grifondoro). */
  alwaysHit?: boolean
  ```
  In `types/relic.ts`, after `grantsExecute?: {...}` add:
  ```ts
  /** Grants the whole team guaranteed-hit (ignores dodge) — Occhio Magico relic. */
  grantsAlwaysHit?: boolean
  ```
  Run `npx tsc --noEmit` → PASS (optional fields, no consumer yet).

- [ ] **Step 2 — TDD: `teamAlwaysHit` test FIRST.** Create `tests/engine/alwaysHit.test.ts`. Model the
  fixtures on `tests/engine/` execute helper tests (build `DraftedWizard[]` + `ActiveRelic[]`). Cover:
  - tag `infallibile` + `tier >= 2` wizard → id is in the set;
  - tag `infallibile` but `tier === 1` wizard → id is NOT in the set (tier guard);
  - a relic with `grantsAlwaysHit: true` → ALL team ids in the set;
  - no source → empty set.
  Run it → FAILS (module missing).

- [ ] **Step 3 — Implement `game/engine/alwaysHit.ts`.** Pure function:
  ```ts
  export function teamAlwaysHit(team: DraftedWizard[], relics: ActiveRelic[]): Set<string> {
    const ids = new Set<string>()
    for (const dw of team) {
      if ((dw.wizard.tags?.includes('infallibile')) && dw.wizard.tier >= 2) ids.add(dw.wizard.id)
    }
    const granted = relics.some(r => r.relic.grantsAlwaysHit && relicMatchesCondition(...))
    if (granted) for (const dw of team) ids.add(dw.wizard.id)
    return ids
  }
  ```
  Confirm the real shapes (`DraftedWizard`, `ActiveRelic`, `relicMatchesCondition` signature) from
  `game/engine/execute.ts` and reuse them identically. Run the test → PASS. `npx tsc --noEmit` → PASS.

- [ ] **Step 4 — Engine gate.** In `game/engine/combat/effects.ts`, change the dodge line to:
  ```ts
  if (eff.canDodge && !ctx.actor.alwaysHit && dodged(ctx.rng, ctx.actor, ctx.target)) {
  ```
  (The `alwaysHit` check is BEFORE `dodged()` so the RNG roll is skipped, not rolled-and-ignored.)

- [ ] **Step 5 — Stamp in `toBattleUnits`** (`game/engine/combat/simulate.ts`). Where `execute`/
  `houseMap` are computed (before the `.map`), add `const alwaysHitIds = teamAlwaysHit(team, relics)`.
  In each unit's stamp object add `alwaysHit: alwaysHitIds.has(dw.wizard.id)`. Use the per-side team
  exactly like `execute`/`houseMap` (left team's set for left units, right's for right).

- [ ] **Step 6 — Determinism gate.** Run the FULL suite: `npm test`. Expected: ALL still green (no
  source grants `alwaysHit` yet, so the gate is bit-identical). `npx tsc --noEmit` → PASS. If any
  snapshot changed, STOP — it means the gate altered RNG with no active source (a bug); fix before
  proceeding.

- [ ] **Step 7 — Commit.**
  ```bash
  git add types/combat.ts types/relic.ts game/engine/alwaysHit.ts tests/engine/alwaysHit.test.ts game/engine/combat/effects.ts game/engine/combat/simulate.ts
  git commit -m "feat(infallibile): alwaysHit flag + dodge-skip gate + teamAlwaysHit computer"
  ```

---

### Task 2: Content — wizard tags + `occhio-magico` relic

**Files:**
- Modify: `data/wizards.ts` (add `infallibile` tag to 3-4 tier-2/3 wizards)
- Modify: `data/relics.ts` (add `occhio-magico`)
- Modify/Test: `tests/data/relics.test.ts` (extend invariant to accept `grantsAlwaysHit`, if needed)

- [ ] **Step 1 — Pick the wizards.** In `data/wizards.ts`, find 3-4 wizards with `tier >= 2` whose
  theme fits relentless precision/aim. Confirm real ids + tiers. Candidates (verify each exists & is
  tier 2-3): Alastor "Malocchio" Moody, Bellatrix Lestrange, Antonin Dolohov, Severus Snape. Add
  `'infallibile'` to their existing `tags` array (preserve existing tags). Do NOT touch any Grifondoro
  starter used by `campaignBalanceB` (avoid RNG shift in that harness).

- [ ] **Step 2 — Add the relic.** In `data/relics.ts`, append:
  ```ts
  { id: 'occhio-magico', name: 'Occhio Magico di Malocchio', desc: '...', rarity: 'rara', grantsAlwaysHit: true },
  ```
  Italian `desc` (the eye that sees through everything → the team never misses). Match the exact
  `Relic` object shape used by neighboring relics (e.g. `spada-grifondoro`).

- [ ] **Step 3 — Tests green.** Run `npx vitest run tests/data/relics.test.ts` and the wizard-data
  tests. If a relic invariant rejects the new shape, widen it honestly (mirror how `grantsExecute` was
  accepted). Run `npm test` — expect green except any snapshot featuring a now-tagged wizard, which is
  a faithful consequence (regenerate with `-u` ONLY after confirming the diff is logLen/dodge-related,
  not winner/turns regressions). `npx tsc --noEmit` → PASS.

- [ ] **Step 4 — Commit.**
  ```bash
  git add data/wizards.ts data/relics.ts tests/
  git commit -m "feat(infallibile): tag tier-2/3 precision wizards + Occhio Magico grant relic"
  ```

---

### Task 3: Validation — `tests/engine/infallibileCounter.test.ts`

**Files:**
- Create: `tests/engine/infallibileCounter.test.ts`

- [ ] **Step 1 — Write the counter test** (model on `tests/engine/esecuzioneCounters.test.ts`). Use a
  fixed seed and a simulated battle (the same `simulateBattle`/harness the other counter tests use):
  - **BEATS dodge:** left team where the attacker has `alwaysHit` (granted via the `occhio-magico`
    relic OR a tagged tier-2 wizard) vs a right target with high `dodgeBonus` (e.g. a Grifondoro stack,
    or stamp `dodgeBonus: 0.6` directly to make it decisive). Assert the battle log contains **zero**
    `'dodge'` flags attributable to the left attacker, and left wins / target dies within N turns.
  - **CONTROL:** identical stats but the attacker has NO `alwaysHit` vs the same evasive target →
    assert the log contains **> 0** `'dodge'` flags (it misses sometimes). This proves the ability is
    what removes the misses, not the stats.
  Robust metric = `'dodge'` flag count, never total damage.

- [ ] **Step 2 — Green + typecheck.** `npx vitest run tests/engine/infallibileCounter.test.ts` → PASS.
  `npx tsc --noEmit` → PASS. Full suite `npm test` green.

- [ ] **Step 3 — Commit.**
  ```bash
  git add tests/engine/infallibileCounter.test.ts
  git commit -m "test(infallibile): counter-web — beats dodge-stacking, control proves the flip"
  ```

---

### Task 4: Docs

- [ ] Update `docs/superpowers/remaining-work.md`: move item #2 to done, add a "Mira Infallibile" row
  to the counter-web table (Beats: Grifondoro/dodge-stacking; Loses to: —). Commit.
