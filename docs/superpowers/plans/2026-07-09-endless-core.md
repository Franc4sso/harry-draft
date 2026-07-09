# Endless Core (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an infinite Endless run mode with a skill-based, verifiable local score — playable and fun on its own, zero backend infrastructure.

**Architecture:** Reuse the existing deterministic `runEngine` unchanged. Endless is a thin driver that keeps generating areas past the campaign's final area, with enemy difficulty scaling via UNCAPPED enemy level (bypassing the `levelMax: 10` clamp that governs the campaign only). Score is a pure `RunState → number`. The recruit-level bug is fixed en route. Difficulty curve `k` is calibrated from a bot sweep, not guessed.

**Tech Stack:** TypeScript, Next.js 16, Vitest. No new dependencies.

## Global Constraints

- **Campaign untouched:** do NOT modify `BALANCE.campaign`, `BALANCE.campaignB`, or reintroduce menace (`menaceForLevel` must keep returning 0). The `campaignBalanceB` gate must stay at its current result.
- **`levelMax: 10` stays** as the campaign enemy ceiling. Endless bypasses it with its OWN level formula; it does NOT raise `levelMax`.
- **Determinism:** no `Date.now`/`Math.random`/`new Date` in any `game/engine` code. Use the seeded `Rng` (`game/engine/rng.ts`) only.
- **All Endless params live in a NEW `BALANCE.endless` block.** Nothing Endless-specific leaks into campaign constants.
- **Run `npm run test` AND `npm run typecheck`** before every commit — `npm run test` (Vitest) does NOT typecheck (known: memory `harry-draft-vitest-no-typecheck`).

---

## File Structure

- `data/constants.ts` — add `BALANCE.endless` block (new constants only; campaign blocks untouched).
- `game/engine/recruit.ts` — modify `recruitVia` to accept a target level (comp 4).
- `game/engine/resolvers/recruit.ts` — pass area normal level to `recruitVia` (comp 4).
- `game/engine/combat/threat.ts` — add `endlessEnemyLevel(floor)` (uncapped), leave `enemyLevelFor` untouched (comp 2).
- `game/engine/endlessScore.ts` — CREATE: pure score calculator (comp 3).
- `game/engine/endless.ts` — CREATE: Endless driver wrapping `runEngine` (comp 1).
- `tests/engine/endlessScaling.test.ts` — CREATE: bot sweep for `k` calibration (comp 7).
- Plus co-located unit tests per task under `tests/engine/`.

---

## Task 1: Recruit-level fix

Fixes the pre-existing `level: 1` hardcode. Independent of Endless; lands first because Endless depends on recruits scaling with depth.

**Files:**
- Modify: `game/engine/recruit.ts:47` (`recruitVia`)
- Modify: `game/engine/resolvers/recruit.ts:33` (call site)
- Test: `tests/engine/recruitLevel.test.ts` (create)

**Interfaces:**
- Consumes: `expForLevel(level: number): number` from `game/engine/leveling.ts`; `enemyLevelFor(area: number, kind: 'normal'|'elite'|'boss', isFinalBoss: boolean): number` from `game/engine/combat/threat.ts`; `parseAreaNodeId(id).area` from `game/engine/map.ts`.
- Produces: `recruitVia(dw: DraftedWizard, via: string, targetLevel: number): DraftedWizard` — returns a recruit at `level: targetLevel`, `exp: expForLevel(targetLevel)`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine/recruitLevel.test.ts
import { describe, it, expect } from 'vitest'
import { recruitVia } from '@/game/engine/recruit'
import { expForLevel } from '@/game/engine/leveling'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

describe('recruitVia level', () => {
  it('enters at the given target level with coherent exp (does not regress to 1)', () => {
    const rng = createRng('recruit-seed')
    const dw = draftWizard(rng, WIZARDS[0]!, true)
    const recruit = recruitVia(dw, 'Reclutamento', 7)
    expect(recruit.level).toBe(7)
    expect(recruit.exp).toBe(expForLevel(7))
  })

  it('defaults are not level 1 when a higher target is passed', () => {
    const rng = createRng('recruit-seed-2')
    const dw = draftWizard(rng, WIZARDS[0]!, true)
    expect(recruitVia(dw, 'x', 5).level).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/recruitLevel.test.ts`
Expected: FAIL — `recruitVia` currently ignores a 3rd arg and returns `level: 1`.

- [ ] **Step 3: Modify `recruitVia`**

In `game/engine/recruit.ts`, add the import at the top (alongside existing imports):

```typescript
import { expForLevel } from './leveling'
```

Replace the existing `recruitVia` (line ~47):

```typescript
export function recruitVia(dw: DraftedWizard, via: string, targetLevel: number): DraftedWizard {
  const level = Math.max(1, Math.floor(targetLevel))
  return { ...dw, recruitedVia: via, level, exp: expForLevel(level), growthChoices: [] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/recruitLevel.test.ts`
Expected: PASS

- [ ] **Step 5: Update the call site**

In `game/engine/resolvers/recruit.ts`, add to the existing imports from `../combat/threat` (or add a new import line):

```typescript
import { enemyLevelFor } from '../combat/threat'
```

In `recruitResolver.resolve` (line ~33), replace:

```typescript
    const recruit = recruitVia(picked, 'Reclutamento')
```

with:

```typescript
    const { area } = parseAreaNodeId(node.id)
    const recruit = recruitVia(picked, 'Reclutamento', enemyLevelFor(area, 'normal', false))
```

(`parseAreaNodeId` is already imported in this file.)

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: all green. If any existing test called `recruitVia(dw, via)` with 2 args, update it to pass a target level (search: `grep -rn "recruitVia" tests/`).

- [ ] **Step 7: Commit**

```bash
git add game/engine/recruit.ts game/engine/resolvers/recruit.ts tests/engine/recruitLevel.test.ts
git commit -m "fix(recruit): recruit enters at area normal enemy level, not level 1

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Uncapped Endless enemy level

Adds the infinite difficulty lever WITHOUT touching `enemyLevelFor` (campaign path). New `BALANCE.endless` block + a new `endlessEnemyLevel(floor)` that bypasses the `levelMax` clamp.

**Files:**
- Modify: `data/constants.ts` (add `endless` block to `BALANCE`)
- Modify: `game/engine/combat/threat.ts` (add `endlessEnemyLevel`)
- Test: `tests/engine/endlessLevel.test.ts` (create)

**Interfaces:**
- Consumes: `BALANCE.endless.normalLevelBase`, `BALANCE.endless.levelPerFloor`.
- Produces: `endlessEnemyLevel(floor: number): number` — rises linearly with floor, NO cap (may exceed `levelMax: 10`).

- [ ] **Step 1: Add the `BALANCE.endless` block**

In `data/constants.ts`, add a new top-level block inside `BALANCE` (place it right after the `campaignB` block; do NOT touch existing blocks):

```typescript
  // Endless mode (Plan A) — DECOUPLED from campaign/campaignB. Difficulty scales via
  // UNCAPPED enemy level (past leveling.levelMax:10), which drives real per-level stat
  // growth. `levelPerFloor` is the calibration lever (see tests/engine/endlessScaling).
  endless: {
    normalLevelBase: 2,   // enemy level at floor 0 (matches campaignB area-0 normal)
    levelPerFloor: 1,     // PLACEHOLDER — calibrated in Task 7 (endlessScaling sweep)
    pointsPerFloor: 100,  // score base unit (see endlessScore.ts, Task 5)
  },
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/engine/endlessLevel.test.ts
import { describe, it, expect } from 'vitest'
import { endlessEnemyLevel } from '@/game/engine/combat/threat'
import { BALANCE } from '@/data/constants'

describe('endlessEnemyLevel', () => {
  it('starts at the endless base level at floor 0', () => {
    expect(endlessEnemyLevel(0)).toBe(BALANCE.endless.normalLevelBase)
  })

  it('rises linearly with floor', () => {
    const b = BALANCE.endless.normalLevelBase
    const k = BALANCE.endless.levelPerFloor
    expect(endlessEnemyLevel(5)).toBe(b + 5 * k)
  })

  it('is UNCAPPED — exceeds levelMax past the clamp point', () => {
    expect(endlessEnemyLevel(50)).toBeGreaterThan(BALANCE.leveling.levelMax)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/endlessLevel.test.ts`
Expected: FAIL — `endlessEnemyLevel` not exported.

- [ ] **Step 4: Implement `endlessEnemyLevel`**

In `game/engine/combat/threat.ts`, add below the existing `enemyLevelFor` (do NOT modify `enemyLevelFor`):

```typescript
/** Endless-mode enemy level. UNCAPPED (no levelMax clamp) — this is the infinite
 *  difficulty lever. Reuses the level→stat-growth pipeline; campaign is untouched.
 *  `levelPerFloor` is calibrated from tests/engine/endlessScaling.test.ts. */
export function endlessEnemyLevel(floor: number): number {
  const e = BALANCE.endless
  return Math.max(1, Math.round(e.normalLevelBase + Math.max(0, floor) * e.levelPerFloor))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/endlessLevel.test.ts`
Expected: PASS

- [ ] **Step 6: Verify campaign untouched**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts && npm run typecheck`
Expected: `campaignBalanceB` result UNCHANGED (same pass/fail as before this task), typecheck green.

- [ ] **Step 7: Commit**

```bash
git add data/constants.ts game/engine/combat/threat.ts tests/engine/endlessLevel.test.ts
git commit -m "feat(endless): uncapped endlessEnemyLevel + BALANCE.endless block

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Score calculator

Pure `RunState → number`: depth base × (1 + kill-bonus + hp-bonus). Deterministic, monotonic in depth.

**Files:**
- Create: `game/engine/endlessScore.ts`
- Test: `tests/engine/endlessScore.test.ts` (create)

**Interfaces:**
- Consumes: `RunState` from `@/types`; `BALANCE.endless.pointsPerFloor`.
- Produces: `endlessScore(input: EndlessScoreInput): number` where
  `EndlessScoreInput = { floorsCleared: number; eliteKills: number; bossKills: number; hpFraction: number }`.
  `hpFraction` ∈ [0,1] = team HP preserved at run end.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine/endlessScore.test.ts
import { describe, it, expect } from 'vitest'
import { endlessScore } from '@/game/engine/endlessScore'
import { BALANCE } from '@/data/constants'

const P = BALANCE.endless.pointsPerFloor

describe('endlessScore', () => {
  it('base is depth × pointsPerFloor when no style bonus', () => {
    expect(endlessScore({ floorsCleared: 10, eliteKills: 0, bossKills: 0, hpFraction: 0 }))
      .toBe(10 * P)
  })

  it('is monotonic in depth (more floors never lowers score)', () => {
    const a = endlessScore({ floorsCleared: 10, eliteKills: 3, bossKills: 1, hpFraction: 0.5 })
    const b = endlessScore({ floorsCleared: 11, eliteKills: 3, bossKills: 1, hpFraction: 0.5 })
    expect(b).toBeGreaterThan(a)
  })

  it('rewards kills and preserved HP as multiplicative style bonus', () => {
    const plain = endlessScore({ floorsCleared: 10, eliteKills: 0, bossKills: 0, hpFraction: 0 })
    const styled = endlessScore({ floorsCleared: 10, eliteKills: 4, bossKills: 2, hpFraction: 1 })
    expect(styled).toBeGreaterThan(plain)
  })

  it('is deterministic (same input → same output)', () => {
    const i = { floorsCleared: 7, eliteKills: 2, bossKills: 1, hpFraction: 0.3 }
    expect(endlessScore(i)).toBe(endlessScore(i))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/endlessScore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the calculator**

```typescript
// game/engine/endlessScore.ts
import { BALANCE } from '@/data/constants'

export interface EndlessScoreInput {
  floorsCleared: number
  eliteKills: number
  bossKills: number
  /** Fraction of total team HP preserved at run end, in [0,1]. */
  hpFraction: number
}

// Style bonus weights. Multiplicative on the depth base so more depth always wins
// (monotonicity): score = depth*P*(1 + killBonus + hpBonus).
const ELITE_WEIGHT = 0.05
const BOSS_WEIGHT = 0.15
const HP_WEIGHT = 0.25

export function endlessScore(input: EndlessScoreInput): number {
  const depth = Math.max(0, Math.floor(input.floorsCleared))
  const base = depth * BALANCE.endless.pointsPerFloor
  const killBonus = input.eliteKills * ELITE_WEIGHT + input.bossKills * BOSS_WEIGHT
  const hpBonus = Math.min(1, Math.max(0, input.hpFraction)) * HP_WEIGHT
  return Math.round(base * (1 + killBonus + hpBonus))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/endlessScore.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: green.

```bash
git add game/engine/endlessScore.ts tests/engine/endlessScore.test.ts
git commit -m "feat(endless): pure depth+style score calculator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Endless driver

Wraps `runEngine` so the run continues past the final area instead of ending in `'win'`. Reuses `clearAreaAndAdvance`'s area-generation + full-recovery heal, but loops infinitely and uses the Endless level for enemy scaling. Terminates only on wipeout.

**Files:**
- Create: `game/engine/endless.ts`
- Test: `tests/engine/endless.test.ts` (create)

**Interfaces:**
- Consumes: `RunState`, `startRunB`, `clearAreaAndAdvance` from `game/engine/runEngine.ts`; `endlessEnemyLevel` from `game/engine/combat/threat.ts`; `BALANCE.map.floorsPerArea`.
- Produces:
  - `globalFloor(state: RunState): number` — `(state.area ?? 0) * BALANCE.map.floorsPerArea` + floor-within-area (derived from `currentNodeId` via `parseAreaNodeId`).
  - `advanceEndlessArea(state: RunState, rng: Rng): RunState` — like `clearAreaAndAdvance` but NEVER returns `phase: 'win'`; always generates the next area (infinite).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine/endless.test.ts
import { describe, it, expect } from 'vitest'
import { advanceEndlessArea, globalFloor } from '@/game/engine/endless'
import { startRunB, registerCoreResolvers } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

registerCoreResolvers()

describe('endless driver', () => {
  it('advanceEndlessArea never wins — generates a next area past the campaign final area', () => {
    const rng = createRng('endless-seed')
    let s = startRunB('endless-seed')
    // Force area to the campaign's last area; advancing must NOT produce 'win'.
    s = { ...s, area: BALANCE.map.areas - 1, team: s.team.length ? s.team : [] }
    const next = advanceEndlessArea(s, rng)
    expect(next.phase).not.toBe('win')
    expect(next.area).toBe(BALANCE.map.areas) // went PAST the campaign ceiling
  })

  it('advanceEndlessArea fully heals the roster at area boundary', () => {
    const rng = createRng('endless-heal')
    let s = startRunB('endless-heal')
    s = { ...s, area: 0, team: s.team.map(dw => ({ ...dw, currentHp: 1 })) }
    const next = advanceEndlessArea(s, rng)
    for (const dw of next.team) expect(dw.currentHp).toBe(dw.maxHp)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/endless.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the driver**

```typescript
// game/engine/endless.ts
import type { RunState } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { generateArea, parseAreaNodeId, areaRng } from './map'

/** Global floor index across the infinite run: completed areas × floorsPerArea plus
 *  the floor-within-area of the current node. */
export function globalFloor(state: RunState): number {
  const area = state.area ?? 0
  const within = state.currentNodeId ? parseAreaNodeId(state.currentNodeId).floor : 0
  return area * BALANCE.map.floorsPerArea + within
}

/** Endless counterpart to runEngine.clearAreaAndAdvance: ALWAYS generates the next area
 *  (never returns phase:'win'), with the same guaranteed full-recovery heal at the
 *  boundary. Enemy difficulty for the new area comes from endlessEnemyLevel(globalFloor). */
export function advanceEndlessArea(state: RunState, _rng: Rng): RunState {
  const nextArea = (state.area ?? 0) + 1
  const map = generateArea(areaRng(state.seed, nextArea), state.seed, nextArea,
    { teamSize: state.team.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  const team = state.team.map(dw => ({ ...dw, currentHp: dw.maxHp }))
  return { ...state, team, area: nextArea, map, currentNodeId: entry.id, phase: 'map' }
}
```

Note: `areaRng` and `generateArea`/`parseAreaNodeId` are exported from `game/engine/map.ts` (verify the export names with `grep -n "export" game/engine/map.ts`; if `areaRng` is not exported, export it — it is used identically inside `runEngine.clearAreaAndAdvance`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/endless.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck + full suite + commit**

Run: `npm run test && npm run typecheck`
Expected: green (campaign untouched — `clearAreaAndAdvance` is not modified).

```bash
git add game/engine/endless.ts tests/engine/endless.test.ts game/engine/map.ts
git commit -m "feat(endless): infinite area driver (never wins, heals at boundary)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire Endless enemy level into battle generation

Make Endless battles USE `endlessEnemyLevel(globalFloor)` for enemy stats, instead of the campaign's clamped `enemyLevelFor`. This is the surgical bypass — it must be conditional on an Endless flag so the campaign path is byte-for-byte unchanged.

**Files:**
- Modify: `game/engine/combat/battlePackage.ts:27,89` (enemy level source)
- Modify: `types/run.ts` (add optional `endless?: boolean` to `RunState`)
- Test: `tests/engine/endlessBattleLevel.test.ts` (create)

**Interfaces:**
- Consumes: `endlessEnemyLevel` (Task 2), `globalFloor` (Task 4), `RunState.endless?: boolean`.
- Produces: battle packages whose `enemyLevel` follows the uncapped Endless curve when `state.endless === true`, and the unchanged `enemyLevelFor` otherwise.

- [ ] **Step 1: Add the flag to RunState**

In `types/run.ts`, inside `RunState` (alongside the other optional Plan-B fields):

```typescript
  endless?: boolean
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/engine/endlessBattleLevel.test.ts
import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { endlessEnemyLevel } from '@/game/engine/combat/threat'
import { startRunB } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

// NOTE: adjust buildBattlePackage's call signature to match its real export — verify
// with `grep -n "export function buildBattlePackage" game/engine/combat/battlePackage.ts`.
describe('endless battle enemy level', () => {
  it('uses the uncapped endless level (exceeds levelMax) deep in an endless run', () => {
    const rng = createRng('ebl')
    let s = startRunB('ebl')
    s = { ...s, endless: true, area: 20, currentNodeId: s.currentNodeId }
    const pkg = buildBattlePackage(s, s.map![0]!, rng)
    expect(pkg.enemyLevel).toBeGreaterThan(BALANCE.leveling.levelMax)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/endlessBattleLevel.test.ts`
Expected: FAIL — enemy level still clamped at `levelMax`.

- [ ] **Step 4: Branch the enemy-level source**

In `game/engine/combat/battlePackage.ts`, import the endless helpers at the top:

```typescript
import { enemyLevelFor, endlessEnemyLevel, globalDepth, budgetB } from './threat'
```

(Add `endlessEnemyLevel` to the existing import; also import `globalFloor` from `../endless` if not circular — if `battlePackage` importing `endless` creates a cycle, inline the `globalFloor` computation here using `parseAreaNodeId` + `BALANCE.map.floorsPerArea` instead.)

At line ~27, replace:

```typescript
  const enemyLevel = enemyLevelFor(area, ek, isFinalBoss)
```

with:

```typescript
  const enemyLevel = state.endless
    ? endlessEnemyLevel(area * BALANCE.map.floorsPerArea + floorWithinArea)
    : enemyLevelFor(area, ek, isFinalBoss)
```

where `floorWithinArea` is `parseAreaNodeId(node.id).floor` (this file already parses the node id — reuse the existing parse; if `area`/`floor` aren't already destructured, add `const { area, floor: floorWithinArea } = parseAreaNodeId(node.id)`). Do the SAME substitution at the second call site (line ~89, `enemyTeam.map(... level: enemyLevel)` already reads the local `enemyLevel`, so fixing the source above is sufficient — verify no other literal `enemyLevelFor(` remains uncovered in this file).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/endlessBattleLevel.test.ts`
Expected: PASS

- [ ] **Step 6: Verify campaign untouched (flag defaults false/undefined)**

Run: `npm run test && npm run typecheck`
Expected: green, and `campaignBalanceB` UNCHANGED (campaign never sets `endless`, so the `enemyLevelFor` branch always runs there).

- [ ] **Step 7: Commit**

```bash
git add types/run.ts game/engine/combat/battlePackage.ts tests/engine/endlessBattleLevel.test.ts
git commit -m "feat(endless): battles use uncapped endless level when state.endless

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Endless run orchestration + score readout

Tie it together: a function that, given a finished/wiped Endless `RunState`, extracts the score inputs and returns the score. This is the seam the UI and (later) the leaderboard both call.

**Files:**
- Modify: `game/engine/endless.ts` (add `scoreForEndlessRun`)
- Test: `tests/engine/endlessScoreReadout.test.ts` (create)

**Interfaces:**
- Consumes: `endlessScore` (Task 3), `globalFloor` (Task 4), `RunState.log` (RunEvent[] — kill events), `RunState.team` (HP fractions).
- Produces: `scoreForEndlessRun(state: RunState): number` — reads `floorsCleared = globalFloor(state)`, counts elite/boss kills from `state.log`, computes `hpFraction` from `state.team`, and returns `endlessScore(...)`.

- [ ] **Step 1: Inspect the log/event shape**

Run: `grep -n "kind:\|RunEvent\|'elite'\|'boss'\|kind ===" types/run.ts game/engine/resolvers/combat.ts | head`
Confirm how a cleared elite/boss is recorded in `state.log` (event `kind`). Use the actual discriminator in Step 3 (below assumes battle events carry the node kind; adjust to the real field).

- [ ] **Step 2: Write the failing test**

```typescript
// tests/engine/endlessScoreReadout.test.ts
import { describe, it, expect } from 'vitest'
import { scoreForEndlessRun } from '@/game/engine/endless'
import { endlessScore } from '@/game/engine/endlessScore'
import type { RunState } from '@/types'
import { BALANCE } from '@/data/constants'

function stubState(over: Partial<RunState>): RunState {
  return {
    seed: 's', phase: 'defeat', team: [], activeSynergies: [], stage: 0, relics: [],
    area: 2, currentNodeId: 'a2-f0-i0', ...over,
  } as RunState
}

describe('scoreForEndlessRun', () => {
  it('returns endlessScore of the extracted inputs (>=0, deterministic)', () => {
    const s = stubState({})
    const score = scoreForEndlessRun(s)
    expect(score).toBe(scoreForEndlessRun(s)) // deterministic
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('deeper run scores higher, all else equal', () => {
    const shallow = scoreForEndlessRun(stubState({ area: 1, currentNodeId: 'a1-f0-i0' }))
    const deep = scoreForEndlessRun(stubState({ area: 10, currentNodeId: 'a10-f0-i0' }))
    expect(deep).toBeGreaterThan(shallow)
  })
})
```

- [ ] **Step 3: Implement `scoreForEndlessRun`**

Append to `game/engine/endless.ts` (adjust the kill-count discriminator to the real `RunEvent` shape found in Step 1):

```typescript
import { endlessScore } from './endlessScore'

export function scoreForEndlessRun(state: RunState): number {
  const floorsCleared = globalFloor(state)
  const log = state.log ?? []
  // Adjust the predicate to the real RunEvent discriminator confirmed in Step 1.
  const eliteKills = log.filter(e => e.kind === 'elite').length
  const bossKills = log.filter(e => e.kind === 'boss').length
  const team = state.team
  const hpFraction = team.length
    ? team.reduce((a, d) => a + (d.maxHp ? d.currentHp / d.maxHp : 0), 0) / team.length
    : 0
  return endlessScore({ floorsCleared, eliteKills, bossKills, hpFraction })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/endlessScoreReadout.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: green.

```bash
git add game/engine/endless.ts tests/engine/endlessScoreReadout.test.ts
git commit -m "feat(endless): scoreForEndlessRun extracts inputs from run state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Difficulty calibration sweep

Measure `levelPerFloor` from a near-optimal bot's death-floor distribution — same method as the `campaignBalanceB` gate. Sets the shipped `k` and locks it with an assertion so future changes re-measure.

**Files:**
- Create: `tests/engine/endlessScaling.test.ts`
- Modify: `data/constants.ts` (set `endless.levelPerFloor` to the calibrated value)

**Interfaces:**
- Consumes: the bot-harness pattern from `tests/engine/campaignBalanceB.test.ts` (greedy near-optimal policy over N seeds), the Endless driver (Tasks 4-6).
- Produces: a test asserting the median death-floor falls in a healthy window with a long tail; a shipped `levelPerFloor`.

- [ ] **Step 1: Copy the bot harness skeleton**

Read `tests/engine/campaignBalanceB.test.ts` in full and reuse its greedy-policy loop (draft → move → resolve → advance). Adapt it to: set `endless: true` on the state, use `advanceEndlessArea` instead of `clearAreaAndAdvance`, and record the `globalFloor` at wipeout (the death-floor) instead of a win/loss boolean.

- [ ] **Step 2: Write the calibration test (initially exploratory)**

```typescript
// tests/engine/endlessScaling.test.ts
import { describe, it, expect } from 'vitest'
import { advanceEndlessArea, globalFloor } from '@/game/engine/endless'
// ...reuse imports + greedy policy helpers from campaignBalanceB.test.ts...

const SEEDS = Array.from({ length: 60 }, (_, i) => `endless-${i}`)

function deathFloor(seed: string): number {
  // Drive a near-optimal greedy Endless run to wipeout; return globalFloor at death.
  // (Port the greedy policy from campaignBalanceB.test.ts, with endless:true + advanceEndlessArea.)
  // ...
  return 0 // replace with real driver
}

describe('endless scaling calibration', () => {
  it('median death-floor sits in a healthy window with a long tail', () => {
    const floors = SEEDS.map(deathFloor).sort((a, b) => a - b)
    const median = floors[Math.floor(floors.length / 2)]!
    const p90 = floors[Math.floor(floors.length * 0.9)]!
    // Healthy: typical death mid-run, skilled tail goes much deeper.
    expect(median).toBeGreaterThanOrEqual(15)
    expect(median).toBeLessThanOrEqual(40)
    expect(p90).toBeGreaterThan(median) // graded, not a hard wall
  })
})
```

- [ ] **Step 3: Sweep `levelPerFloor` to hit the window**

Run the test with candidate values (edit `data/constants.ts` `endless.levelPerFloor`): try `0.5, 0.75, 1, 1.5`. For each, log the median/p90 death-floor. Pick the value whose median lands in [15,40] with `p90 > median` (graded curve). Record the sweep table as a header comment in the test file (mirror `campaignBalanceB`'s documentation style).

Run each: `npx vitest run tests/engine/endlessScaling.test.ts`

- [ ] **Step 4: Lock the shipped value**

Set `endless.levelPerFloor` in `data/constants.ts` to the chosen value. Replace the `deathFloor` stub with the real greedy driver. Confirm the assertion passes at the shipped value.

Run: `npx vitest run tests/engine/endlessScaling.test.ts`
Expected: PASS at the shipped `levelPerFloor`.

- [ ] **Step 5: Full suite + typecheck + commit**

Run: `npm run test && npm run typecheck`
Expected: all green; `campaignBalanceB` still unchanged.

```bash
git add tests/engine/endlessScaling.test.ts data/constants.ts
git commit -m "test(endless): calibrate levelPerFloor from death-floor sweep

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Comp 1 (driver) → Task 4. Comp 2 (scaling) → Task 2 + wired in Task 5. Comp 3 (score) → Task 3 + Task 6. Comp 4 (recruit fix) → Task 1. Comp 7 (calibration) → Task 7. ✅
- Comp 5 (challenge code) + Comp 6 (Blobs) → deferred to Plan B per the spec's implementation split. ✅ (not in this plan by design)

**Placeholder scan:** Task 7's `deathFloor` is intentionally a stub in Step 2 and replaced with the real driver in Step 4 (calibration is inherently measure-then-set) — this is a documented two-step, not a hidden TODO. Tasks 5 and 6 flag real call-signature/discriminator unknowns (`buildBattlePackage` signature, `RunEvent` kind) with an explicit grep-to-confirm step rather than guessing — these are verification steps, acceptable.

**Type consistency:** `recruitVia(dw, via, targetLevel)` consistent (Task 1). `endlessEnemyLevel(floor)` consistent (Tasks 2, 5). `endlessScore(EndlessScoreInput)` consistent (Tasks 3, 6). `globalFloor`/`advanceEndlessArea`/`scoreForEndlessRun` consistent (Tasks 4, 5, 6, 7). `RunState.endless?` added Task 5, used Task 5. ✅

**Known risk carried into execution:** Tasks 5 and 6 depend on real signatures (`buildBattlePackage`, `RunEvent` shape) not fully pinned here — each has a grep-first step. If `battlePackage` importing `endless` is circular, Task 5 inlines the floor math (noted inline).
