# Serpeverde Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-size the Serpeverde house win rate (0.76–0.95 → into band) by nerfing the `deatheater` synergy's flat +25 atk to an empirically-tuned value, without touching wizard stats, house synergies, or global scaling.

**Architecture:** A single coupled rebalance: (1) a new diagnostic test measuring a competent Serpeverde team's win rate (cloned from `campaignBalanceB`), (2) the one-line `deatheater.atk` nerf, (3) empirical tuning of that one number against three simultaneous constraints, (4) refreshed diagnostic comments in the 3 archetype sweeps. The diagnostic, the nerf, and the tuning are interdependent (you tune the number *against* the test), so this is ONE task with an internal tune loop — not separable into independently-reviewable pieces.

**Tech Stack:** TypeScript, Vitest, the run engine (`startRunB`/`chooseStarters`/etc.), `@/`-aliased imports.

## Global Constraints

- **Only `deatheater.bonus.atk` changes.** Do NOT touch wizard `ranges`/stats, the `slytherin` house synergy (symmetric with other houses by design), the `tossicita`/`spietatezza`/`oscurita` +5 atk, or global scaling/menace in `data/constants.ts` (shared with the Grifondoro `campaignBalanceB` test — the project memory flags this).
- **Three constraints must hold together after the nerf:**
  - **A.** A competent Serpeverde sweep win rate lands in `(0.10, 0.60)` (down from the inflated 0.76–0.95, not over-nerfed).
  - **B.** `tests/engine/campaignBalanceB.test.ts` (Grifondoro starter, band 0.15–0.55) STAYS GREEN — proof the nerf is surgical. (All 7 deatheater carriers are Serpeverde, zero Grifondoro, so this should hold by construction; verify, don't modify it.)
  - **C.** The 3 archetype sweeps (veleno/esecuzione/magieOscure) drop but stay `> 0.05` (their existing assertion). Update only their diagnostic comments to the new observed numbers.
- **Tune empirically:** start at `deatheater.atk = 12`; adjust within `[8, 18]` until A, B, C all hold. The lever is this single number.
- Tests: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`.

---

### Task 1: Serpeverde rebalance (diagnostic + nerf + tune + comment refresh)

**Files:**
- Create: `tests/engine/serpeverdeBalance.test.ts`
- Modify: `data/synergies.ts:34` (the `deatheater` line)
- Modify (comments only): `tests/engine/velenoSweep.test.ts`, `tests/engine/esecuzioneSweep.test.ts`, `tests/engine/magieOscureSweep.test.ts`

**Interfaces:**
- Consumes: `startRunB`, `starterOffer`, `chooseStarters`, `reachable`, `moveTo`, `resolveCurrent`, `clearAreaAndAdvance`, `registerCoreResolvers` from `@/game/engine/runEngine`; `recruitOffer`, `relicOffer` from `@/game/engine/resolvers/recruit`; `powerOf` from `@/game/engine/combat/teamGen`; `createRng`; `BALANCE`. (Same imports as `campaignBalanceB.test.ts`.)

- [ ] **Step 1: Write the diagnostic test (clone of campaignBalanceB, Serpeverde starter)**

Create `tests/engine/serpeverdeBalance.test.ts`. Start from `tests/engine/campaignBalanceB.test.ts` (read it first) and change only: the starter house to `'Serpeverde'`, the starter-pick to bias offensive picks (power is fine — a competent Serpeverde player drafts the strong mangiamorte), the band assertions, and labels. Use the SAME near-optimal `pickNode` policy (fight-for-EXP) so it's an upper-bound player comparable to campaignBalanceB.

```ts
import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { BALANCE } from '@/data/constants'
import type { RunNode, RunState } from '@/types'

// DIAGNOSTIC (2026-06-29). Measures a competent Serpeverde team's win rate to validate the
// deatheater nerf. Before the nerf (deatheater.atk=25) Serpeverde swept 0.76–0.95; the nerf must
// bring this into (0.10, 0.60) while campaignBalanceB (Grifondoro, 0.15–0.55) stays green.
// Same upper-bound fight-for-EXP policy as campaignBalanceB so the two are comparable.
registerCoreResolvers()

function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

function runOne(seed: string, battleTurns?: number[]): 'win' | 'defeat' {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Serpeverde')
  const starters = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Serpeverde', starters, createRng(seed))
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') return 'win'
    if (s.phase === 'defeat') return 'defeat'
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, rng)
      if (s.lastBattle && battleTurns) battleTurns.push(s.lastBattle.turns)
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const pick = [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: pick.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: off[0]!.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'area-cleared') { s = clearAreaAndAdvance(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    break
  }
  return 'defeat'
}

describe('Serpeverde house balance', () => {
  const N = 120
  const turns: number[] = []
  const outcomes = Array.from({ length: N }, (_, i) => runOne(`srp-${i}`, turns))
  const winRate = outcomes.filter(o => o === 'win').length / N
  // eslint-disable-next-line no-console
  console.log(`[serpeverde balance] N=${N} winRate=${winRate.toFixed(3)}`)

  it('is deterministic (same seeds → same outcomes)', () => {
    const again = Array.from({ length: N }, (_, i) => runOne(`srp-${i}`))
    expect(again).toEqual(outcomes)
  })
  it('is no longer inflated (win rate below the over-power line)', () => {
    expect(winRate).toBeLessThan(0.60)
  })
  it('remains a playable house (not over-nerfed)', () => {
    expect(winRate).toBeGreaterThan(0.10)
  })
})
```

- [ ] **Step 2: Run it at the CURRENT deatheater value (25) — confirm the diagnosis**

Run: `npx vitest run tests/engine/serpeverdeBalance.test.ts --reporter=verbose 2>&1 | grep -E "serpeverde balance|✓|✗|×"`
Expected: the `winRate < 0.60` assertion FAILS (win rate is in the inflated 0.76–0.95 regime), confirming the diagnosis. Record the baseline number from the `[serpeverde balance]` line. (The determinism + `> 0.10` tests should pass.)

If the win rate is already < 0.60 at deatheater=25, STOP and report — the diagnosis premise is wrong and the nerf may be unnecessary or mis-aimed.

- [ ] **Step 3: Apply the nerf (deatheater 25 → 12)**

In `data/synergies.ts` line 34, change `bonus: { atk: 25 }` to `bonus: { atk: 12 }`:
```ts
  { id: 'deatheater', name: 'Mangiamorte', kind: 'group', requires: { tag: 'deatheater', count: 3 }, bonus: { atk: 12 } },
```

- [ ] **Step 4: Re-run the diagnostic + tune**

Run: `npx vitest run tests/engine/serpeverdeBalance.test.ts --reporter=verbose 2>&1 | grep -E "serpeverde balance|passed|failed"`
Expected: win rate now in `(0.10, 0.60)` — both band assertions PASS. Record the number.

TUNE if needed (the lever is the single deatheater value, range `[8, 18]`):
- If win rate still ≥ 0.60 → lower deatheater (12 → 10 → 8), re-run.
- If win rate ≤ 0.10 → raise deatheater (12 → 15 → 18), re-run.
- Bake the final value into `data/synergies.ts` and record it.

- [ ] **Step 5: Verify constraint B — campaignBalanceB (Grifondoro) stays green**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`
Expected: PASS (band 0.15–0.55 intact). This proves the nerf is surgical. If it goes RED, STOP and report — the nerf had an unexpected cross-house effect (it shouldn't: no Grifondoro wizard has the deatheater tag).

- [ ] **Step 6: Verify constraint C — the 3 archetype sweeps stay > 0.05, refresh their comments**

Run: `npx vitest run tests/engine/velenoSweep.test.ts tests/engine/esecuzioneSweep.test.ts tests/engine/magieOscureSweep.test.ts --reporter=verbose 2>&1 | grep -E "sweep\]|passed|failed"`
Expected: all three still PASS (their assertion is `winRate > 0.05`). Record each new winRate from the `[... sweep]` diagnostic lines.

Then update ONLY the diagnostic COMMENTS in those three files to reflect the post-nerf numbers (do NOT change any assertion or logic). For each file, find the top-of-file `// Observed:` / diagnostic comment line and append a note like:
```
// Post-deatheater-nerf (25→<final>): winRate now <new number> (was <old>). Still > 0.05, kit intact.
```
Use the actual observed numbers. If any sweep dropped ≤ 0.05, the nerf is too deep → raise deatheater toward 15–18 and re-tune all of Steps 4–6 together.

- [ ] **Step 7: Full suite + typecheck**

Run: `npx tsc --noEmit` → PASS.
Run: `npx vitest run` → all green. Besides the 3 sweeps + the new diagnostic, watch for any OTHER test that pinned a deatheater-team outcome (a seeded battle whose result shifts because a mangiamorte team now hits softer). If one fails: inspect — if it's a balance/sweep-style test with a band, the new value may still be in-band (fine) or need its recorded number refreshed (comment only); if it's a seed-pinned exact-outcome test that now flips, that's an expected consequence of a balance change — update that test's expectation and note it in the report. Do NOT update a test whose failure indicates a real logic break. `relicBalance.test.ts` ~7-30s is expected.

- [ ] **Step 8: Commit**

```bash
git add data/synergies.ts tests/engine/serpeverdeBalance.test.ts tests/engine/velenoSweep.test.ts tests/engine/esecuzioneSweep.test.ts tests/engine/magieOscureSweep.test.ts
# add any seed-pinned test you had to refresh
git commit -m "balance(serpeverde): nerf deatheater +25→<final> atk (surgical house rebalance)"
```

---

### Task 2: Update the backlog handoff doc

**Files:**
- Modify: `docs/superpowers/remaining-work.md`

- [ ] **Step 1: Mark the Serpeverde rebalance done**

In `docs/superpowers/remaining-work.md`:
1. In "✅ Done so far", add a bullet:
```markdown
- **Serpeverde house rebalance — DONE:** diagnosed (Serpeverde won DESPITE lower base stats — the cause was atk-stacking synergies, chiefly `deatheater`'s flat +25 atk, all 7 carriers Serpeverde). Fix: cut `deatheater.atk` 25→<final> in `data/synergies.ts` (surgical — house slytherin, wizard stats, global scaling untouched). Validated: `serpeverdeBalance.test.ts` win rate in (0.10, 0.60), `campaignBalanceB` (Grifondoro) stays green, the 3 archetype sweeps stay > 0.05 (comments refreshed).
```
2. In the item #4 section (Serpeverde rebalance), mark it DONE / strike it.
3. In "NEXT UP", remove the "Serpeverde rebalance now pressing" line (it's done); leave the next pick (more archetypes, or P3 Eventi narrativi) open.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/remaining-work.md
git commit -m "docs(serpeverde): mark house rebalance done"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` → PASS.
- [ ] `npx vitest run` → all green. The new `serpeverdeBalance` diagnostic in band, campaignBalanceB green, 3 sweeps > 0.05.
- [ ] Record the final deatheater value + the four win-rate numbers (Serpeverde diagnostic + 3 sweeps) in the commit/report.
- [ ] `git push origin master` (project convention: push when done).

## Self-Review notes (author)

- **Spec coverage:** diagnosis → the test's premise (Step 2 confirms inflated baseline); fix → Step 3; constraint A → Steps 1-4; constraint B → Step 5; constraint C → Step 6; backlog → Task 2. ✓
- **Single coupled task:** the nerf is tuned *against* the diagnostic, so Steps 1-6 can't be split into independently-reviewable units — correct as one task. ✓
- **No scope creep:** only deatheater + the new test + comment refreshes + (if forced) seed-pinned test refreshes. Slytherin/stats/scaling explicitly untouched. ✓
- **The "diagnosis premise" guard** (Step 2 must FAIL at 25) ensures we don't ship a nerf that does nothing. ✓
