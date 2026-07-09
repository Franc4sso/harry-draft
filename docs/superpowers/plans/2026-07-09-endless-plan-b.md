# Endless Plan B — Playable UI + Verified Leaderboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Endless playable from the menu with a server-verified (re-simulated) global leaderboard on Netlify Blobs, zero-euro, with a local-best offline fallback.

**Architecture:** Endless is a parallel run flow reusing the Plan A engine. A shared run-logic module (extracted from `useRunB`) drives both campaign and endless. Endless logs every player action into a replayable `RunLog`; a pure `replayRun` re-simulates it (client optional, server for anti-cheat). Netlify functions re-simulate a submitted challenge code and write a top-N leaderboard to Blobs. Determinism/fairness: Endless drafts the FULL roster (profile-independent) and has no shop/meta currency.

**Tech Stack:** TypeScript, Next.js 16, Vitest, Netlify Functions + Netlify Blobs (`@netlify/blobs`).

## Global Constraints

- **Campaign untouched:** `useRunB` behavior must be byte-identical after the shared-logic extraction (Task 1 gated by a regression test). Do NOT modify `BALANCE.campaign`/`campaignB` or the `campaignBalanceB` gate.
- **Anti-cheat = re-simulation:** score is DERIVED by re-simulating player actions; never trust a client-sent number.
- **Endless fairness/determinism (spec Decisions):** (2) Endless has NO shop and NO spellForge nodes and NO profile currency; (4) Endless drafts from the FULL roster (`setDraftPoolRestriction(null)`), NOT the profile pool; (1) the replay log is the full `PlayerAction` union; (3) the log carries an engine-version tag and incompatible replays are REJECTED.
- **Determinism:** no `Date.now`/`Math.random`/`new Date` in `game/engine`. UI/`lib` may use them (not simulated).
- **Zero euro:** Netlify functions fail-silent on exhausted credits; no auto-upgrade. Local best keeps Endless playable offline.
- **Run `npm run test && npm run typecheck` before every commit** — Vitest does NOT typecheck (memory `harry-draft-vitest-no-typecheck`).

---

## File Structure

- `hooks/useRunShared.ts` — CREATE: mode-agnostic run logic (dispatch/move/combat-prep/resolution) shared by campaign + endless.
- `hooks/useRunB.ts` — MODIFY: consume `useRunShared`, campaign behavior unchanged.
- `hooks/useEndless.ts` — CREATE: endless-mode hook (full-roster draft, action logging, advanceEndlessArea, score on wipeout).
- `game/engine/endlessReplay.ts` — CREATE: `PlayerAction`, `RunLog` types, `replayRun` (strict-legality re-simulation).
- `lib/challengeCode.ts` — CREATE: `encodeChallenge`/`decodeChallenge` (base64url).
- `lib/endlessLocal.ts` — CREATE: localStorage personal bests + nickname.
- `game/engine/nodeGen.ts` — MODIFY: honor endless category weights (shop/spellForge → 0).
- `components/screens/EndlessRunner.tsx`, `components/screens/EndlessResult.tsx` — CREATE: endless UI.
- `app/endless/page.tsx` — CREATE: endless route.
- `components/screens/MenuScreen.tsx` — MODIFY: add Endless entry.
- `netlify/functions/submit-score.ts`, `netlify/functions/leaderboard.ts` — CREATE: leaderboard backend.
- `netlify.toml` — CREATE: functions config. `package.json` — add `@netlify/blobs`.

---

## Task 1: Extract shared run logic (campaign-touching, regression-gated)

The one change to campaign code. Extract mode-agnostic logic from `useRunB` into `useRunShared` so `useRunB` and `useEndless` share it. Campaign behavior MUST be preserved.

**Files:**
- Create: `hooks/useRunShared.ts`
- Modify: `hooks/useRunB.ts`
- Test: `tests/hooks/useRunB.regression.test.tsx` (create)

**Interfaces:**
- Produces: `useRunShared(opts)` exposing the shared primitives (`commit`, `viewForPhase`, `chooseNode`, `commitBattle`, resolver callbacks). Exact shape decided by the implementer to minimize `useRunB` churn — the CONTRACT is: `useRunB`'s public `RunBController` interface is unchanged.

- [ ] **Step 1: Write the regression test FIRST (characterize current campaign behavior)**

```tsx
// tests/hooks/useRunB.regression.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'

// Characterization: drive a fixed campaign run through a scripted sequence and snapshot
// the view transitions. This must produce IDENTICAL output before and after extraction.
describe('useRunB campaign behavior (regression guard for extraction)', () => {
  it('produces a stable view sequence for a fixed seed + scripted choices', () => {
    const { result } = renderHook(() => useRunB('regression-seed-1'))
    const views: string[] = [result.current.view]
    // Draft starters via the controller's public API, then walk the first reachable nodes.
    act(() => { /* completeDraft with the first offered starters — use the controller's own offer */ })
    views.push(result.current.view)
    // Walk 2-3 reachable nodes, recording view after each.
    for (let i = 0; i < 3; i++) {
      const node = result.current.reachable[0]
      if (!node) break
      act(() => { result.current.chooseNode(node.id) })
      views.push(result.current.view)
      if (result.current.view === 'battle') { act(() => { result.current.commitBattle() }); views.push(result.current.view) }
    }
    // Snapshot the exact sequence. Regenerate ONLY if you intend to change campaign behavior.
    expect(views).toMatchSnapshot()
  })
})
```

- [ ] **Step 2: Run it on CURRENT useRunB to capture the baseline snapshot**

Run: `npx vitest run tests/hooks/useRunB.regression.test.tsx`
Expected: PASS, writes a snapshot file. Commit this snapshot BEFORE extracting — it is the campaign-behavior baseline.

- [ ] **Step 3: Extract shared logic into `useRunShared.ts`**

Move the mode-agnostic callbacks (`commit`, `viewForPhase`, `chooseNode`, `commitBattle`, `chooseRecruit`, `skipRecruit`, `chooseRelic`, `ackInfirmary`, `chooseEventOption`, `chooseSpellUpgrade`, and combat prep) into `useRunShared`. Keep mode-specific bits in `useRunB` (campaign `advanceArea = clearAreaAndAdvance`, profile pool restriction, reward ceremony). `useRunB` now calls `useRunShared` and re-exports the same `RunBController`. Do NOT change any behavior — this is a pure move.

- [ ] **Step 4: Run the regression snapshot — it MUST still match**

Run: `npx vitest run tests/hooks/useRunB.regression.test.tsx`
Expected: PASS with NO snapshot change. If the snapshot differs, the extraction changed behavior — fix until identical.

- [ ] **Step 5: Full suite + typecheck + campaign gate**

Run: `npm run test && npm run typecheck`
Expected: all green; `campaignBalanceB` unchanged.

- [ ] **Step 6: Commit**

```bash
git add hooks/useRunShared.ts hooks/useRunB.ts tests/hooks/useRunB.regression.test.tsx
git commit -m "refactor(run): extract shared run logic from useRunB (campaign behavior preserved)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**BLOCKED fallback:** if the extraction proves too entangled to keep the snapshot identical, STOP and report — do NOT ship a behavior change. The fallback is a minimal shared-helper set (a few exported functions) rather than a full hook restructure.

---

## Task 2: PlayerAction + RunLog types + challenge code

The replay payload. Pure, no engine execution yet.

**Files:**
- Create: `game/engine/endlessReplay.ts` (types only in this task)
- Create: `lib/challengeCode.ts`
- Test: `tests/lib/challengeCode.test.ts` (create)

**Interfaces:**
- Produces:
  - `type PlayerAction = { t:'move'; nodeId:string } | { t:'resolve'; choice: ResolverChoice } | { t:'set-spell'; wizardId:string; spellId:string } | { t:'use-consumable'; relicId:string }`
  - `interface RunLog { v: 1; engine: string; seed: string; house: House; starterIds: string[]; actions: PlayerAction[] }`
  - `encodeChallenge(log: RunLog): string` / `decodeChallenge(s: string): RunLog` (throws on malformed/unknown version).
  - `ENGINE_VERSION: string` constant (Decision 3) — a bump invalidates old replays.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/challengeCode.test.ts
import { describe, it, expect } from 'vitest'
import { encodeChallenge, decodeChallenge } from '@/lib/challengeCode'
import { ENGINE_VERSION, type RunLog } from '@/game/engine/endlessReplay'

const sample: RunLog = {
  v: 1, engine: ENGINE_VERSION, seed: 's1', house: 'Grifondoro',
  starterIds: ['harry', 'ron'],
  actions: [
    { t: 'move', nodeId: 'a0f1n0' },
    { t: 'resolve', choice: { kind: 'combat-ack' } },
    { t: 'set-spell', wizardId: 'harry', spellId: 'expelliarmus' },
  ],
}

describe('challenge code', () => {
  it('round-trips a RunLog through encode/decode', () => {
    expect(decodeChallenge(encodeChallenge(sample))).toEqual(sample)
  })
  it('throws on malformed input', () => {
    expect(() => decodeChallenge('not-valid-base64url!!')).toThrow()
  })
  it('throws on unknown version', () => {
    const bad = encodeChallenge({ ...sample, v: 999 as unknown as 1 })
    expect(() => decodeChallenge(bad)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/challengeCode.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement types + codec**

```typescript
// game/engine/endlessReplay.ts  (types portion — replayRun added in Task 3)
import type { House } from '@/types'
import type { ResolverChoice } from './resolvers/types'

// Bump when any change to the engine could alter a replay's outcome (Decision 3).
export const ENGINE_VERSION = 'endless-1'

export type PlayerAction =
  | { t: 'move'; nodeId: string }
  | { t: 'resolve'; choice: ResolverChoice }
  | { t: 'set-spell'; wizardId: string; spellId: string }
  | { t: 'use-consumable'; relicId: string }

export interface RunLog {
  v: 1
  engine: string
  seed: string
  house: House
  starterIds: string[]
  actions: PlayerAction[]
}
```

```typescript
// lib/challengeCode.ts
import type { RunLog } from '@/game/engine/endlessReplay'

function toBase64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64').toString('utf8')
}

export function encodeChallenge(log: RunLog): string {
  return toBase64url(JSON.stringify(log))
}

export function decodeChallenge(s: string): RunLog {
  let parsed: unknown
  try { parsed = JSON.parse(fromBase64url(s)) } catch { throw new Error('challenge: malformed') }
  const log = parsed as RunLog
  if (!log || log.v !== 1 || typeof log.seed !== 'string' || !Array.isArray(log.actions)) {
    throw new Error('challenge: invalid or unsupported version')
  }
  return log
}
```

Note: `Buffer` exists in Node (Netlify functions + Vitest). For the browser client, add a `TextEncoder`/`btoa` fallback if `Buffer` is undefined — verify at implementation time whether the client bundle needs it; if so, branch on `typeof Buffer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/challengeCode.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add game/engine/endlessReplay.ts lib/challengeCode.ts tests/lib/challengeCode.test.ts
git commit -m "feat(endless): PlayerAction/RunLog types + challenge code codec

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Replayer with strict legality validation (anti-cheat core)

`replayRun` re-simulates a RunLog. This is where anti-cheat lives: an illegal/no-op action makes the replay INVALID, not "a different valid run".

**Files:**
- Modify: `game/engine/endlessReplay.ts` (add `replayRun`)
- Test: `tests/engine/endlessReplay.test.ts` (create)

**Interfaces:**
- Consumes: `startRunB`, `chooseStarters`, `moveTo`, `resolveCurrent`, `setWizardSpell`, `useConsumableRelic`, `reachable`, `registerCoreResolvers` from `game/engine/runEngine`; `advanceEndlessArea` from `game/engine/endless`; `setDraftPoolRestriction` from `game/engine/draft`; `scoreForEndlessRun`/`globalFloor` from `game/engine/endless`.
- Produces: `replayRun(log: RunLog): { state: RunState; valid: boolean; reason?: string }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/engine/endlessReplay.test.ts
import { describe, it, expect } from 'vitest'
import { replayRun, type RunLog, ENGINE_VERSION } from '@/game/engine/endlessReplay'
import { registerCoreResolvers } from '@/game/engine/runEngine'

registerCoreResolvers()

// A valid RunLog is best produced by RECORDING a real run (see Task 4). For this unit
// test, drive a minimal known-good sequence and a known-bad one.
function baseLog(actions: RunLog['actions']): RunLog {
  return { v: 1, engine: ENGINE_VERSION, seed: 'replay-seed', house: 'Grifondoro', starterIds: [], actions }
}

describe('replayRun', () => {
  it('rejects a log whose starterIds are not in the offered starters (illegal draft)', () => {
    const log = baseLog([])
    log.starterIds = ['definitely-not-a-real-wizard-id']
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  it('rejects an action that is a no-op / illegal in its state', () => {
    // A relic-pick for a relic never offered at that node must invalidate the replay.
    const log = baseLog([{ t: 'resolve', choice: { kind: 'relic-pick', relicId: 'no-such-relic' } }])
    const out = replayRun(log)
    expect(out.valid).toBe(false)
  })

  it('a recorded valid run replays to valid:true and a scorable state', () => {
    // This case is filled in once Task 4 can RECORD a real log; wire that recorded log here.
    // Until then, assert the shape contract only.
    const out = replayRun(baseLog([]))
    expect(out).toHaveProperty('valid')
    expect(out).toHaveProperty('state')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/engine/endlessReplay.test.ts`
Expected: FAIL — `replayRun` not exported.

- [ ] **Step 3: Implement `replayRun`**

```typescript
// append to game/engine/endlessReplay.ts
import type { RunState } from '@/types'
import {
  startRunB, chooseStarters, starterOffer, moveTo, resolveCurrent,
  setWizardSpell, useConsumableRelic, reachable, registerCoreResolvers,
} from './runEngine'
import { advanceEndlessArea } from './endless'
import { setDraftPoolRestriction } from './draft'
import { createRng } from './rng'

export function replayRun(log: RunLog): { state: RunState; valid: boolean; reason?: string } {
  if (log.engine !== ENGINE_VERSION) return { state: null as unknown as RunState, valid: false, reason: 'engine version mismatch' }
  registerCoreResolvers()
  setDraftPoolRestriction(null) // Decision 4: full roster, profile-independent

  const rng = createRng(log.seed)
  // Validate starters are in the deterministic offer for this seed+house.
  const offer = starterOffer(log.seed, log.house)
  const offeredIds = new Set(offer.map(d => d.wizard.id))
  if (!log.starterIds.length || !log.starterIds.every(id => offeredIds.has(id))) {
    return { state: null as unknown as RunState, valid: false, reason: 'illegal starters' }
  }
  let s = chooseStarters(startRunB(log.seed), log.house, log.starterIds, rng)
  s = { ...s, endless: true }

  for (const a of log.actions) {
    const before = s
    if (a.t === 'move') {
      if (!reachable(s).some(n => n.id === a.nodeId)) return { state: s, valid: false, reason: 'unreachable node' }
      s = moveTo(s, a.nodeId)
    } else if (a.t === 'resolve') {
      s = resolveCurrent(s, a.choice, createRng(log.seed))
    } else if (a.t === 'set-spell') {
      s = setWizardSpell(s, a.wizardId, a.spellId)
    } else if (a.t === 'use-consumable') {
      s = useConsumableRelic(s, a.relicId)
    }
    // Strict legality: a resolver/action that returned the SAME state object is a no-op
    // (illegal choice) — invalidate rather than accept a divergent run. (move already
    // validated above; combat-ack legitimately transitions, so exempt ack from this.)
    if (s === before && !(a.t === 'resolve' && a.choice.kind === 'combat-ack')) {
      return { state: s, valid: false, reason: `no-op action: ${JSON.stringify(a)}` }
    }
    // Advance area at boundary (endless never wins).
    if (s.phase === 'area-cleared' || s.phase === 'win') s = advanceEndlessArea(s, createRng(log.seed))
    if (s.team.length > 0 && s.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)) break // wiped
  }
  return { state: s, valid: true }
}
```

Note: the `s === before` no-op check assumes resolvers return the SAME object reference on no-op (verified in recruit/relic/spell/consumable resolvers — they `return state`). Confirm this holds for every action type used; if any resolver returns a shallow-copied identical state on no-op, replace the reference check with a deep-equal or an explicit offer-membership check for that action.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/engine/endlessReplay.test.ts`
Expected: PASS (the two rejection cases; the valid-run case is completed in Task 4).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add game/engine/endlessReplay.ts tests/engine/endlessReplay.test.ts
git commit -m "feat(endless): replayRun re-simulation with strict legality validation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Endless hook (record actions, full-roster draft, score on wipeout)

Drives an endless run via the shared logic, RECORDS every player action into a `RunLog`, and produces a challenge code + score at wipeout. Closes Task 3's "recorded valid run" test.

**Files:**
- Create: `hooks/useEndless.ts`
- Test: `tests/hooks/useEndless.test.tsx` (create) + complete the recorded-run case in `tests/engine/endlessReplay.test.ts`

**Interfaces:**
- Consumes: `useRunShared` (Task 1), `advanceEndlessArea`/`scoreForEndlessRun`/`globalFloor`, `setDraftPoolRestriction(null)`, `encodeChallenge`, `RunLog`/`PlayerAction`/`ENGINE_VERSION`.
- Produces: `useEndless(seed)` controller exposing the run views PLUS `getChallengeCode(): string`, `score: number | null`, `floor: number`.

- [ ] **Step 1: Write the failing test (record → replay → same score)**

```tsx
// tests/hooks/useEndless.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEndless } from '@/hooks/useEndless'
import { decodeChallenge } from '@/lib/challengeCode'
import { replayRun } from '@/game/engine/endlessReplay'
import { scoreForEndlessRun } from '@/game/engine/endless'

describe('useEndless record + replay parity', () => {
  it('a played run recorded to a challenge code replays to the SAME score', () => {
    const { result } = renderHook(() => useEndless('endless-ui-seed'))
    // Draft starters from the full roster, then greedily walk until wipeout.
    // (Use the controller's own offered starters + reachable nodes; combat auto-acks.)
    // ...drive the run to wipeout via act()...
    const code = result.current.getChallengeCode()
    const played = result.current.score!
    const { state, valid } = replayRun(decodeChallenge(code))
    expect(valid).toBe(true)
    expect(scoreForEndlessRun(state)).toBe(played)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/hooks/useEndless.test.tsx`
Expected: FAIL — `useEndless` not found.

- [ ] **Step 3: Implement `useEndless`**

Build on `useRunShared`. Key differences from `useRunB`:
- On mount: `setDraftPoolRestriction(null)` (full roster — Decision 4). Do NOT apply the profile pool.
- Start state carries `endless: true`.
- Wrap each player action callback so it ALSO pushes a `PlayerAction` to an internal `actions` ref: `chooseNode`→`{t:'move'}`, resolve callbacks→`{t:'resolve',choice}`, spell set→`{t:'set-spell'}`, consumable→`{t:'use-consumable'}`.
- Area advance uses `advanceEndlessArea`.
- On wipeout: compute `score = scoreForEndlessRun(state)`, `floor = globalFloor(state)`, expose them.
- `getChallengeCode()` builds `RunLog { v:1, engine: ENGINE_VERSION, seed, house, starterIds, actions }` and returns `encodeChallenge(log)`.

- [ ] **Step 4: Run to verify pass; then fill Task 3's recorded-run case**

Run: `npx vitest run tests/hooks/useEndless.test.tsx`
Expected: PASS. Then paste the recorded challenge code into `tests/engine/endlessReplay.test.ts`'s valid-run case and assert `valid:true` + a positive score. Re-run that file.

- [ ] **Step 5: Full suite + typecheck + commit**

Run: `npm run test && npm run typecheck`

```bash
git add hooks/useEndless.ts tests/hooks/useEndless.test.tsx tests/engine/endlessReplay.test.ts
git commit -m "feat(endless): useEndless records actions; record→replay score parity

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Endless map generation excludes shop + spellForge

Decision 2: no shop, no spellForge (meta) nodes in Endless.

**Files:**
- Modify: `game/engine/nodeGen.ts` (category weights honor an endless flag)
- Modify: `game/engine/map.ts` (thread endless into `assignAreaCategories`)
- Test: `tests/engine/endlessNodeGen.test.ts` (create)

**Interfaces:**
- Consumes: existing `assignAreaCategories(rng, widths, bias)` and `BALANCE.map.categoryWeights`.
- Produces: endless area generation yields ZERO nodes of type `shop` or `spellForge`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine/endlessNodeGen.test.ts
import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { areaRng } from '@/game/engine/runEngine'

describe('endless map generation', () => {
  it('never generates shop or spellForge nodes across many endless areas', () => {
    for (let area = 1; area <= 20; area++) {
      const map = generateArea(areaRng('endless-mapgen', area), 'endless-mapgen', area,
        { teamSize: 3, teamMax: 5 }, true) // endless=true
      for (const n of map) {
        expect(n.type).not.toBe('shop')
        expect(n.type).not.toBe('spellForge')
      }
    }
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/engine/endlessNodeGen.test.ts`
Expected: FAIL — endless areas still roll shop/spellForge.

- [ ] **Step 3: Thread endless into category weighting**

In `game/engine/nodeGen.ts`, make `assignAreaCategories` accept an optional `endless = false`; when true, force `shop` and `spellForge` weights to 0 in the `entries` weight list (line ~132). In `game/engine/map.ts`, `generateArea` already has the `endless` param (Plan A) — pass it into `assignAreaCategories`.

- [ ] **Step 4: Run to verify pass + campaign unaffected**

Run: `npx vitest run tests/engine/endlessNodeGen.test.ts && npx vitest run tests/engine/campaignBalanceB.test.ts`
Expected: endless test PASS; campaignBalanceB unchanged (campaign passes endless=false → weights unchanged).

- [ ] **Step 5: Full suite + typecheck + commit**

Run: `npm run test && npm run typecheck`

```bash
git add game/engine/nodeGen.ts game/engine/map.ts tests/engine/endlessNodeGen.test.ts
git commit -m "feat(endless): exclude shop + spellForge nodes from endless areas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Local best + nickname storage

localStorage personal bests + nickname. Client-only, no network.

**Files:**
- Create: `lib/endlessLocal.ts`
- Test: `tests/lib/endlessLocal.test.ts` (create)

**Interfaces:**
- Produces: `recordLocalBest(score: number, floor: number): void`; `getLocalBests(): {score:number;floor:number}[]` (sorted desc, capped e.g. 10); `getNickname(): string | null`; `setNickname(n: string): void`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/endlessLocal.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { recordLocalBest, getLocalBests, getNickname, setNickname } from '@/lib/endlessLocal'

beforeEach(() => { localStorage.clear() })

describe('endless local storage', () => {
  it('records bests sorted by score desc', () => {
    recordLocalBest(100, 10); recordLocalBest(300, 25); recordLocalBest(200, 18)
    expect(getLocalBests().map(b => b.score)).toEqual([300, 200, 100])
  })
  it('stores and returns nickname', () => {
    expect(getNickname()).toBeNull()
    setNickname('Franc')
    expect(getNickname()).toBe('Franc')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/lib/endlessLocal.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/endlessLocal.ts`**

```typescript
// lib/endlessLocal.ts
const BESTS_KEY = 'endless.bests'
const NICK_KEY = 'endless.nickname'
const MAX_BESTS = 10

export function recordLocalBest(score: number, floor: number): void {
  const list = getLocalBests()
  list.push({ score, floor })
  list.sort((a, b) => b.score - a.score)
  localStorage.setItem(BESTS_KEY, JSON.stringify(list.slice(0, MAX_BESTS)))
}
export function getLocalBests(): { score: number; floor: number }[] {
  try { return JSON.parse(localStorage.getItem(BESTS_KEY) ?? '[]') } catch { return [] }
}
export function getNickname(): string | null {
  return localStorage.getItem(NICK_KEY)
}
export function setNickname(n: string): void {
  localStorage.setItem(NICK_KEY, n.slice(0, 20))
}
```

- [ ] **Step 4: Run to verify pass; typecheck; commit**

Run: `npx vitest run tests/lib/endlessLocal.test.ts && npm run typecheck`

```bash
git add lib/endlessLocal.ts tests/lib/endlessLocal.test.ts
git commit -m "feat(endless): local personal-best + nickname storage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Endless UI — route, menu entry, runner, result screen

Wire the playable UI. Reuses `RunBRunner`'s node/battle views via the shared controller.

**Files:**
- Create: `app/endless/page.tsx`, `components/screens/EndlessRunner.tsx`, `components/screens/EndlessResult.tsx`
- Modify: `components/screens/MenuScreen.tsx` (add Endless entry), `components/screens/RunBRunner.tsx` (accept an injected controller so it is mode-agnostic)
- Test: `tests/screens/endlessResult.test.tsx` (create)

**Interfaces:**
- Consumes: `useEndless` (Task 4), `getLocalBests`/`getNickname`/`setNickname`/`recordLocalBest` (Task 6), the leaderboard fetch (Task 9 — stub/skip network in the unit test).
- Produces: a playable `/endless` route; `EndlessResult` showing score, floor, local bests, nickname prompt, submit button.

- [ ] **Step 1: Make RunBRunner mode-agnostic (accept injected controller)**

`RunBRunner` currently calls `useRunB(seed)` at line 32. Change it to accept an optional `controller` prop; when absent, default to `useRunB(seed)` (campaign unchanged). `EndlessRunner` passes `useEndless(seed)`. This reuses all node/battle/map views for endless with zero view rebuild.

- [ ] **Step 2: Write the failing test (result screen renders score + bests)**

```tsx
// tests/screens/endlessResult.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EndlessResult } from '@/components/screens/EndlessResult'

beforeEach(() => localStorage.clear())

describe('EndlessResult', () => {
  it('shows the final score and floor', () => {
    render(<EndlessResult score={2100} floor={21} challengeCode="abc" />)
    expect(screen.getByText(/2100/)).toBeInTheDocument()
    expect(screen.getByText(/21/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify fail**

Run: `npx vitest run tests/screens/endlessResult.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 4: Implement the UI**

- `app/endless/page.tsx`: renders `EndlessRunner` inside the same Suspense/shell as `app/play/page.tsx` (seed from query or generated via `lib/seed`).
- `EndlessRunner.tsx`: `const c = useEndless(seed)`; render `<RunBRunner controller={c} />`; when `c.score !== null`, render `<EndlessResult score={c.score} floor={c.floor} challengeCode={c.getChallengeCode()} />`.
- `EndlessResult.tsx`: show score + floor prominently (premium UI classes/GameShell), local bests list (`getLocalBests`), nickname input (prefill `getNickname`), and a Submit button (calls the submit flow in Task 9). Record local best on mount via `recordLocalBest(score, floor)`.
- `MenuScreen.tsx`: add an "Endless" button routing to `/endless` next to the existing play CTA (line ~154).

- [ ] **Step 5: Run to verify pass; full suite; typecheck; commit**

Run: `npm run test && npm run typecheck`

```bash
git add app/endless/page.tsx components/screens/EndlessRunner.tsx components/screens/EndlessResult.tsx components/screens/RunBRunner.tsx components/screens/MenuScreen.tsx tests/screens/endlessResult.test.tsx
git commit -m "feat(endless): playable /endless route, menu entry, result screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Netlify setup + leaderboard read function

Infra scaffold + the read side (simpler, no re-sim). Landing before submit so the client has something to fetch.

**Files:**
- Create: `netlify.toml`, `netlify/functions/leaderboard.ts`
- Modify: `package.json` (add `@netlify/blobs`)
- Test: `tests/functions/leaderboard.test.ts` (create — unit test the handler logic with a mocked Blobs store)

**Interfaces:**
- Produces: `GET /.netlify/functions/leaderboard` → `200 [{ nickname, score, floor }]` (top-N desc).

- [ ] **Step 1: Add dependency + config**

Run: `npm install @netlify/blobs`

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[functions]
  node_bundler = "esbuild"
```

- [ ] **Step 2: Write the failing test (handler logic, mocked store)**

```typescript
// tests/functions/leaderboard.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async () => JSON.stringify([{ nickname: 'A', score: 300, floor: 25 }, { nickname: 'B', score: 100, floor: 10 }]),
  }),
}))

import { readLeaderboard } from '@/netlify/functions/leaderboard'

describe('leaderboard read', () => {
  it('returns entries sorted by score desc', async () => {
    const list = await readLeaderboard()
    expect(list.map(e => e.score)).toEqual([300, 100])
  })
})
```

- [ ] **Step 3: Implement the function (export testable core)**

```typescript
// netlify/functions/leaderboard.ts
import { getStore } from '@netlify/blobs'

export interface Entry { nickname: string; score: number; floor: number }

export async function readLeaderboard(): Promise<Entry[]> {
  const store = getStore('endless-leaderboard')
  const raw = await store.get('top')
  const list: Entry[] = raw ? JSON.parse(raw) : []
  return list.sort((a, b) => b.score - a.score)
}

export default async function handler(): Promise<Response> {
  try {
    const list = await readLeaderboard()
    return new Response(JSON.stringify(list), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch {
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }) // fail-silent
  }
}
```

- [ ] **Step 4: Run to verify pass; typecheck; commit**

Run: `npx vitest run tests/functions/leaderboard.test.ts && npm run typecheck`

```bash
git add netlify.toml netlify/functions/leaderboard.ts package.json package-lock.json tests/functions/leaderboard.test.ts
git commit -m "feat(endless): netlify setup + leaderboard read function

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: submit-score function (re-simulate + verify + write) + client wiring

The anti-cheat gate: re-simulate the challenge code, compute the authoritative score, write to Blobs. Then wire the client Submit button to it.

**Files:**
- Create: `netlify/functions/submit-score.ts`
- Modify: `components/screens/EndlessResult.tsx` (Submit calls the function; nickname flow)
- Test: `tests/functions/submitScore.test.ts` (create)

**Interfaces:**
- Consumes: `decodeChallenge`, `replayRun`, `scoreForEndlessRun`, `globalFloor`, `readLeaderboard`/Blobs write.
- Produces: `POST /.netlify/functions/submit-score` `{ challengeCode, nickname }` → `200 { rank, score, floor }` on success; `400` invalid replay; `409` engine mismatch.

- [ ] **Step 1: Write the failing test (re-sim accept + reject)**

```typescript
// tests/functions/submitScore.test.ts
import { describe, it, expect, vi } from 'vitest'

const written: string[] = []
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async () => JSON.stringify([]),
    set: async (_k: string, v: string) => { written.push(v) },
  }),
}))

import { processSubmission } from '@/netlify/functions/submit-score'
import { encodeChallenge } from '@/lib/challengeCode'
import { ENGINE_VERSION, type RunLog } from '@/game/engine/endlessReplay'

describe('submit-score processing', () => {
  it('rejects a challenge with an illegal starter (invalid replay)', async () => {
    const log: RunLog = { v: 1, engine: ENGINE_VERSION, seed: 's', house: 'Grifondoro', starterIds: ['nope'], actions: [] }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'X' })
    expect(res.status).toBe(400)
  })
  it('rejects an engine-version mismatch', async () => {
    const log: RunLog = { v: 1, engine: 'ancient-0', seed: 's', house: 'Grifondoro', starterIds: [], actions: [] }
    const res = await processSubmission({ challengeCode: encodeChallenge(log), nickname: 'X' })
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/functions/submitScore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `submit-score.ts`**

```typescript
// netlify/functions/submit-score.ts
import { getStore } from '@netlify/blobs'
import { decodeChallenge } from '@/lib/challengeCode'
import { replayRun, ENGINE_VERSION } from '@/game/engine/endlessReplay'
import { scoreForEndlessRun, globalFloor } from '@/game/engine/endless'

const MAX_ENTRIES = 100

export async function processSubmission(body: { challengeCode: string; nickname: string }):
  Promise<{ status: number; body: unknown }> {
  let log
  try { log = decodeChallenge(body.challengeCode) } catch { return { status: 400, body: { error: 'malformed' } } }
  if (log.engine !== ENGINE_VERSION) return { status: 409, body: { error: 'engine mismatch' } }

  const { state, valid, reason } = replayRun(log)
  if (!valid) return { status: 400, body: { error: 'invalid replay', reason } }

  const nickname = (body.nickname ?? '').trim().slice(0, 20) || 'Anon'
  const score = scoreForEndlessRun(state)
  const floor = globalFloor(state)

  const store = getStore('endless-leaderboard')
  const raw = await store.get('top')
  const list: { nickname: string; score: number; floor: number }[] = raw ? JSON.parse(raw) : []
  list.push({ nickname, score, floor })
  list.sort((a, b) => b.score - a.score)
  const top = list.slice(0, MAX_ENTRIES)
  await store.set('top', JSON.stringify(top))
  const rank = top.findIndex(e => e.score === score && e.nickname === nickname) + 1
  return { status: 200, body: { rank, score, floor } }
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { status, body: out } = await processSubmission(body)
    return new Response(JSON.stringify(out), { status, headers: { 'content-type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'server' }), { status: 500 })
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/functions/submitScore.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the client Submit button**

In `EndlessResult.tsx`, the Submit button: ensure a nickname (prompt via `setNickname` if `getNickname()` is null), `POST` `{ challengeCode, nickname }` to `/.netlify/functions/submit-score`, show the returned rank, and refresh the leaderboard (GET). On network failure, keep the local best and show "offline — punteggio salvato in locale" (fail-silent per zero-euro).

- [ ] **Step 6: Full suite + typecheck + commit**

Run: `npm run test && npm run typecheck`

```bash
git add netlify/functions/submit-score.ts components/screens/EndlessResult.tsx tests/functions/submitScore.test.ts
git commit -m "feat(endless): submit-score re-simulation gate + client submit wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Component 1 (shared logic) → Task 1. Component 2 (endless hook) → Task 4. Component 3 (UI) → Task 7. Component 4 (challenge code) → Task 2. Component 5 (replayer) → Task 3. Component 6 (submit fn) → Task 9. Component 7 (leaderboard fn) → Task 8. Component 8 (local best + nickname) → Task 6. ✅
- Decision 1 (PlayerAction union) → Task 2. Decision 2 (no shop/spellForge) → Task 5. Decision 3 (engine-version gate) → Tasks 2/3/9. Decision 4 (full-roster draft) → Tasks 3/4. ✅

**Placeholder scan:** Task 3's "recorded valid run" test case is intentionally completed in Task 4 (you need the recorder to produce a real log) — documented as a two-step, not a hidden TODO. Tasks 1, 3, 7 flag real integration unknowns (exact extraction shape, no-op reference semantics per resolver, RunBRunner injection) with explicit verify-then-implement steps — acceptable.

**Type consistency:** `RunLog`/`PlayerAction`/`ENGINE_VERSION` consistent (Tasks 2,3,4,9). `replayRun(log) → {state,valid,reason}` consistent (Tasks 3,9). `encodeChallenge`/`decodeChallenge` consistent (Tasks 2,4,9). `Entry {nickname,score,floor}` consistent (Tasks 8,9). `useEndless(seed)` → `{score,floor,getChallengeCode}` consistent (Tasks 4,7). ✅

**Carried risks:** Task 1 (extraction) is the one campaign-touching task — gated by a characterization snapshot + BLOCKED fallback. Task 3's no-op reference check depends on resolvers returning the same object on no-op (verified for the resolvers used, flagged to confirm per action).
