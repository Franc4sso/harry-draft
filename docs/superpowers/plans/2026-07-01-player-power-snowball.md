# Flatten Leveling Snowball — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten the win-based leveling snowball (`growthBudgetPerLevel`) so specialized carriers stop one-shotting everything, opening headroom above the `campaignBalanceB` 0.15 floor — without dropping any of the 5 balance sweeps below their bands.

**Architecture:** A diagnostic sweep first MEASURES the snowball (lv10 atk multiplier, near-optimal↔average winRate delta, turns-per-kill) to establish a baseline and prove the flattening is observable. Then levers (`leveling.growthBudgetPerLevel`, `campaignB.menaceOffset`/`menacePerLevel`) are tuned measure-driven — the executor reports numbers and STOPS for user approval before committing lever values. Finally all 5 gates are re-verified and freed headroom is annotated for the separate final-boss slice.

**Tech Stack:** TypeScript, Vitest. Pure engine functions (`game/engine/leveling.ts`, `game/engine/combat/threat.ts`), data constants (`data/constants.ts`).

## Global Constraints

- Player/enemy curves are DECOUPLED: player uses `leveling.leveledStats` (`growthBudgetPerLevel`); enemy uses `combat/threat.menaceForLevel` (`menacePerLevel`/`menaceOffset`). Lowering the budget weakens only players.
- `campaignBalanceB` band: winRate ∈ (0.15, 0.45), strict. Also deterministic + no turn-cap stalls.
- Archetype sweep floors (draftability): `velenoSweep`, `esecuzioneSweep`, `scudiRigenSweep`, `magieOscureSweep` each above their documented floor (scudi-rigen floor = 0.05, currently 0.100 — MOST at-risk).
- `finalBossClimax` tripwire "is still below area-boss parity" MUST NOT flip in this slice.
- Sweeps run at collection time (module scope); they are slow (~120 seeds). Run individually, not the full suite, during iteration.
- `npm run test` skips typecheck — run `npx tsc --noEmit` on any new/edited TS.
- Verify HEAD before each commit (concurrent git writer possible): `git rev-parse HEAD`.
- Commit to master + push when a task's deliverable is done (user standing permission).

---

### Task 1: Diagnostic snowball sweep (baseline)

Measures the snowball three ways and records a baseline. No tight assertions yet — sanity only. This is the instrument the calibration reads.

**Files:**
- Create: `tests/engine/levelingSnowball.test.ts`
- Reference (do not modify): `tests/engine/campaignBalanceB.test.ts` (harness to mirror), `game/engine/leveling.ts` (`growthWeights`, `leveledStats`), `game/engine/combat/threat.ts`.

**Interfaces:**
- Consumes: `startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent, clearAreaAndAdvance, registerCoreResolvers` from `@/game/engine/runEngine`; `recruitOffer, relicOffer` from `@/game/engine/resolvers/recruit`; `createRng` from `@/game/engine/rng`; `powerOf` from `@/game/engine/combat/teamGen`; `growthWeights, leveledStats` from `@/game/engine/leveling`; `WIZARDS` from `@/data/wizards`; `BALANCE` from `@/data/constants`.
- Produces: nothing imported elsewhere; a standalone diagnostic. Two run policies live in-file: `runNearOptimal(seed)` (mirror of campaignBalanceB `pickNode`) and `runAverage(seed)` (a deliberately weaker policy — see Step 3).

- [ ] **Step 1: Write the atk-multiplier probe test**

The snowball magnitude is the atk multiplier at levelMax for an average-weighted profile vs the most-specialized real roster carrier.

```typescript
import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { growthWeights, leveledStats } from '@/game/engine/leveling'
import { WIZARDS } from '@/data/wizards'
import { BALANCE } from '@/data/constants'
import type { RunNode, RunState } from '@/types'

registerCoreResolvers()

const LMAX = BALANCE.leveling.levelMax

// atk multiplier at levelMax for a given atk growth-weight.
function atkMultAtMax(atkWeight: number): number {
  return 1 + BALANCE.leveling.growthBudgetPerLevel * atkWeight * (LMAX - 1)
}

describe('leveling snowball — atk multiplier at levelMax', () => {
  it('reports average vs specialized-carrier atk growth', () => {
    const avgMult = atkMultAtMax(0.25) // average profile: every weight = 0.25
    // Highest atk growth-weight in the real roster (the sharpest specialization).
    const maxAtkWeight = Math.max(...WIZARDS.map(w => {
      const midBase = {
        hp: (w.ranges.hp[0] + w.ranges.hp[1]) / 2,
        atk: (w.ranges.atk[0] + w.ranges.atk[1]) / 2,
        def: (w.ranges.def[0] + w.ranges.def[1]) / 2,
        spd: (w.ranges.spd[0] + w.ranges.spd[1]) / 2,
      }
      return growthWeights(midBase).atk
    }))
    const carrierMult = atkMultAtMax(maxAtkWeight)
    // eslint-disable-next-line no-console
    console.log(`[snowball] avgAtkMult=${avgMult.toFixed(3)} carrierAtkMult=${carrierMult.toFixed(3)} maxAtkWeight=${maxAtkWeight.toFixed(3)} ratio=${(carrierMult / avgMult).toFixed(3)}`)
    // Sanity only: the carrier grows strictly faster than average.
    expect(carrierMult).toBeGreaterThan(avgMult)
    expect(avgMult).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run it, record the baseline numbers**

Run: `npx vitest run tests/engine/levelingSnowball.test.ts -t "atk multiplier" 2>&1 | grep snowball`
Expected: PASS, and a `[snowball] avgAtkMult=... carrierAtkMult=... ratio=...` line. Copy the printed numbers into a comment at the top of the file as the recorded baseline.

- [ ] **Step 3: Add the near-optimal↔average policy delta probe**

Append to the same file. `runNearOptimal` mirrors campaignBalanceB's `pickNode` exactly. `runAverage` is deliberately weaker: it fights less aggressively (prefers a normal `battle` over `elite`, and only grabs 1 relic), modeling a non-expert player — this is the second reference point that makes flattening observable.

```typescript
function pickNearOptimal(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

// Weaker "average" player: prefers softer normal battles, under-invests in relics.
function pickAverage(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'battle') ?? opts.find(n => n.type === 'elite')
  if (fight) return fight
  if (s.relics.length < 1) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

function runWith(seed: string, pick: (s: RunState) => RunNode): 'win' | 'defeat' {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Grifondoro')
  const starters = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starters, createRng(seed))
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') return 'win'
    if (s.phase === 'defeat') return 'defeat'
    if (s.phase === 'map') { s = moveTo(s, pick(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') { s = resolveCurrent(s, { kind: 'combat-ack' }, rng); continue }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const best = [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: off[0]!.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'infirmary-node') { s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed)); s = { ...s, phase: 'map' }; continue }
    if (s.phase === 'area-cleared') { s = clearAreaAndAdvance(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    break
  }
  return 'defeat'
}

describe('leveling snowball — near-optimal vs average policy delta', () => {
  const N = 120
  const near = Array.from({ length: N }, (_, i) => runWith(`run-${i}`, pickNearOptimal))
  const avg = Array.from({ length: N }, (_, i) => runWith(`run-${i}`, pickAverage))
  const nearRate = near.filter(o => o === 'win').length / N
  const avgRate = avg.filter(o => o === 'win').length / N

  it('reports the win-rate gap between the two policies', () => {
    // eslint-disable-next-line no-console
    console.log(`[snowball] nearOptimalRate=${nearRate.toFixed(4)} averageRate=${avgRate.toFixed(4)} gap=${(nearRate - avgRate).toFixed(4)}`)
    // Sanity: near-optimal is at least as strong as average; both are numbers.
    expect(nearRate).toBeGreaterThanOrEqual(avgRate)
    expect(Number.isFinite(nearRate)).toBe(true)
  })
  it('is deterministic', () => {
    const again = Array.from({ length: N }, (_, i) => runWith(`run-${i}`, pickNearOptimal))
    expect(again).toEqual(near)
  })
})
```

- [ ] **Step 4: Run the policy-delta probe, record baseline**

Run: `npx vitest run tests/engine/levelingSnowball.test.ts -t "policy delta" 2>&1 | grep snowball`
Expected: PASS with a `[snowball] nearOptimalRate=... averageRate=... gap=...` line. Record the gap in the file's baseline comment. **This gap is the number the flattening must shrink** — if it is already ~0 the design thesis is false; STOP and report to the controller.

- [ ] **Step 5: Typecheck + run whole diagnostic file**

Run: `npx tsc --noEmit` (expect exit 0), then `npx vitest run tests/engine/levelingSnowball.test.ts` (expect all pass).

- [ ] **Step 6: Commit**

```bash
git rev-parse HEAD
git add tests/engine/levelingSnowball.test.ts
git commit -m "test(snowball): diagnostic sweep — atk-mult + near-optimal↔average gap baseline"
git push origin master
```

---

### Task 2: Report baseline + PAUSE for lever approval

Measure-driven gate. The executor does NOT choose lever values alone — it reports numbers and proposes, then STOPS for the user.

**Files:** none modified. This task's deliverable is a written report to the controller.

**Interfaces:**
- Consumes: the two `[snowball]` baseline lines from Task 1.
- Produces: a proposal `{ growthBudgetPerLevel: <candidate>, menaceOffset?: <candidate>, menacePerLevel?: <candidate> }` with predicted per-gate effect — handed to the user, not applied.

- [ ] **Step 1: Assemble the baseline report**

State the recorded numbers: `avgAtkMult`, `carrierAtkMult`, `ratio`, `nearOptimalRate`, `averageRate`, `gap`. Confirm `gap` is meaningfully > 0 (thesis holds). If `gap ≈ 0`, report thesis failure and recommend the reward/baseline alternative from the spec instead — do not proceed to Task 3.

- [ ] **Step 2: Propose lever candidates with reasoning**

Propose a first `growthBudgetPerLevel` step (e.g. 0.40 → 0.30–0.34) and note that `menaceOffset`/`menacePerLevel` will likely need easing to re-hold the 0.15 floor. Give the predicted direction of each of the 5 gates. Present to the user via the controller. **Do NOT edit `data/constants.ts` in this task.**

- [ ] **Step 3: STOP — await user approval**

Explicitly hand control back: "Baseline measured. Proposed levers: <values>. Approve before I apply?" Wait for user confirmation of concrete lever values before Task 3.

---

### Task 3: Apply approved levers + re-hold the 0.15 floor

Only runs after the user approves concrete values in Task 2. Iterates `menaceOffset`/`menacePerLevel` (approved ranges) until `campaignBalanceB` is back in band, keeping the approved `growthBudgetPerLevel`.

**Files:**
- Modify: `data/constants.ts` (`BALANCE.leveling.growthBudgetPerLevel`; `BALANCE.campaignB.menaceOffset` and/or `menacePerLevel`).
- Reference: `tests/engine/campaignBalanceB.test.ts` (the gate).

**Interfaces:**
- Consumes: user-approved lever values from Task 2.
- Produces: committed constants; a recorded `campaignBalanceB` winRate back in (0.15, 0.45).

- [ ] **Step 1: Apply the approved `growthBudgetPerLevel`**

Edit `data/constants.ts` `BALANCE.leveling.growthBudgetPerLevel` to the approved value. Add a dated calibration comment noting the old→new value and why.

- [ ] **Step 2: Measure campaignBalanceB after the player nerf**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts -t "winnable" 2>&1 | tail -20`
Expected: winRate will DROP below 0.15 (players weaker, enemies unchanged) → test likely FAILS. Record the new winRate.

- [ ] **Step 3: Ease enemy budget to re-hold the floor**

Edit `BALANCE.campaignB.menaceOffset` (less negative) and/or `menacePerLevel` (down) toward the approved range. Re-run Step 2's command. Repeat in small steps until winRate ∈ (0.15, 0.45), targeting the freed-headroom goal (~0.03+ above 0.15 if reachable). Update the dated calibration comment block in `campaignBalanceB.test.ts` with the final numbers (follow the existing comment convention there).

- [ ] **Step 4: Re-run the diagnostic to confirm the snowball actually flattened**

Run: `npx vitest run tests/engine/levelingSnowball.test.ts 2>&1 | grep snowball`
Expected: `ratio` LOWER than baseline (carrier no longer 2.5× average) AND `gap` narrower than baseline. Append the post-tune numbers to the diagnostic file's baseline comment. If `ratio`/`gap` did not move, the flattening is cosmetic — report to controller before committing.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git rev-parse HEAD
git add data/constants.ts tests/engine/campaignBalanceB.test.ts tests/engine/levelingSnowball.test.ts
git commit -m "balance(snowball): lower growthBudgetPerLevel + ease enemy budget to re-hold 0.15 floor"
git push origin master
```

---

### Task 4: Guard all 5 gates + annotate freed headroom

The pass is not done until every sweep is in band. Runs the 4 archetype sweeps; ricalibrates if any dropped below floor; annotates the campaignBalanceB headroom for the separate final-boss slice.

**Files:**
- Reference/verify: `tests/engine/velenoSweep.test.ts`, `tests/engine/esecuzioneSweep.test.ts`, `tests/engine/scudiRigenSweep.test.ts`, `tests/engine/magieOscureSweep.test.ts`.
- Modify (annotation only): `tests/engine/finalBossClimax.test.ts` (comment recording available headroom), `docs/superpowers/remaining-work.md`.
- Possibly modify (only if a gate fell): `data/constants.ts`.

**Interfaces:**
- Consumes: committed levers from Task 3.
- Produces: all 5 sweeps green; a documented headroom figure for the final-boss slice.

- [ ] **Step 1: Run the 4 archetype sweeps**

Run: `npx vitest run tests/engine/velenoSweep.test.ts tests/engine/esecuzioneSweep.test.ts tests/engine/scudiRigenSweep.test.ts tests/engine/magieOscureSweep.test.ts 2>&1 | tail -30`
Expected: all pass. Record each winRate. scudi-rigen (floor 0.05, was 0.100) is the most at-risk.

- [ ] **Step 2: If any sweep fell below floor, ricalibrate**

If a sweep fails: prefer easing the shared enemy budget (`menaceOffset`) — which also lifts campaignBalanceB, so re-check that stays < 0.45. If the drop is a coherent consequence of the new balance (not a kit break), the documented alternative is lowering that archetype's floor with a dated justification comment (per the existing sweep comment convention). Re-run until all 4 pass + campaignBalanceB still in band. Commit any constants change with `git push`.

- [ ] **Step 3: Confirm finalBossClimax tripwire did NOT flip**

Run: `npx vitest run tests/engine/finalBossClimax.test.ts 2>&1 | tail -10`
Expected: both tests PASS (boss still below parity — this slice does not raise it).

- [ ] **Step 4: Annotate freed headroom**

In `finalBossClimax.test.ts`, update the header comment with the measured campaignBalanceB winRate after this pass and the resulting headroom above 0.15 (how much room a future boss raise now has). In `docs/superpowers/remaining-work.md` item #1, note the pass is done and record the headroom figure for the final-boss slice. Do not change assertions.

- [ ] **Step 5: Full suite + typecheck + commit**

```bash
npx tsc --noEmit
npx vitest run 2>&1 | tail -6
git rev-parse HEAD
git add tests/engine/finalBossClimax.test.ts docs/superpowers/remaining-work.md data/constants.ts
git commit -m "balance(snowball): verify 5 gates in band; annotate freed final-boss headroom"
git push origin master
```

Expected: suite fully green (was 857; new diagnostic tests raise the count).

---

## Self-Review notes

- **Spec coverage:** Sez.1 diagnostic → Task 1. Sez.2 measure-driven/user-decides → Task 2 (explicit STOP). Sez.3 guard-all-5-gates → Task 4. Sez.4 annotate-headroom → Task 4 Step 4. Decoupled-curves fact → Global Constraints. Thesis-falsification path → Task 1 Step 4 + Task 2 Step 1.
- **Placeholder scan:** lever numbers are intentionally user-gated (Task 2/3), not placeholders — the plan's contract is "measure then ask", stated explicitly. All test code is complete and runnable.
- **Type consistency:** `pickNearOptimal`/`pickAverage`/`runWith` defined and used in-file; harness signatures copied verbatim from campaignBalanceB; `growthWeights`/`leveledStats` signatures match `leveling.ts` exports.
