# Endless Draft = Campaign Screen-Draft — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Endless's house-pick starter draft with the campaign `DraftScreen` screen-draft (3 tier-weighted screens, pick 3, no house), keeping the full-roster pool, and rework the anti-cheat RunLog/replay to record per-pick draft choices.

**Architecture:** Endless reuses the campaign draft path (`DraftScreen` → `useDraft`/`DraftSession` → `confirmDraftPicks`). The RunLog stops encoding `house`+`starterIds` and instead records the ordered picked wizard ids (`draftPicks`); `replayRun` re-drives a seeded `DraftSession`, validating each pick was legally on its screen, then `confirmDraftPicks`. `ENGINE_VERSION` bumps.

**Tech Stack:** TypeScript, Next.js (custom build — read `node_modules/next/dist/docs/` before touching Next APIs), Vitest, React. No new dependencies.

## Global Constraints

- **Copy in Italian** (player-facing).
- **Endless stays unlock-independent:** the Endless draft pool is the FULL roster (`setDraftPoolRestriction(null)`), never profile unlocks — leaderboard fairness. Campaign is unchanged (unlocked pool).
- **Determinism = anti-cheat:** live play and replay must reconstruct the identical draft screens from the seed. `tests/engine/endlessReplayParity.test.ts` must stay 0-mismatch. Any rng draw uses the same seeded path both sides.
- **`STARTER_PICKS = 3`** (`game/engine/runEngine.ts:50`) — the initial draft count, unchanged.
- **Keep** `starterOffer`/`chooseStarters` in `runEngine.ts` (the balance harness `campaignBalanceB.test.ts`/`avgPolicyProbe.test.ts` still uses them) — do NOT delete them.
- `npm run test` does NOT typecheck → run `npm run typecheck` (tsc --noEmit) separately after each task.
- Commit after every task.

---

## File Structure

**Modified:**
- `game/engine/runEngine.ts` — `confirmDraftPicks` threads `state.endless` into `generateArea` (Task 1).
- `game/engine/endlessReplay.ts` — `RunLog` shape (`draftPicks`), `structurallyValid`, `replayRun` draft block, `ENGINE_VERSION` (Task 2).
- `hooks/useEndless.ts` — `completeDraft` replaces `starterOffer`/`chooseStarters`; record `draftPicks`; `getChallengeCode` (Task 3).
- `components/screens/EndlessRunner.tsx` — route draft phase to `DraftScreen`; retire `EndlessStarterPick` (Task 4).
- Tests: `tests/engine/endlessReplay.test.ts`, `tests/lib/challengeCode.test.ts` (Task 2); `tests/hooks/useEndless.test.tsx` (Task 3); a Runner render test (Task 4); `tests/engine/endlessReplayParity.test.ts` + any other RunLog/draft-flow test (Task 5).

**Verified interfaces (quote these):**
```ts
// game/engine/runEngine.ts
export const STARTER_PICKS = 3
export function startRunB(seed: string): RunState            // phase 'draft', team [], endless unset
export function confirmDraftPicks(state, picked: DraftedWizard[], _rng): RunState  // :58 — currently NO endless thread
export function chooseStarters(state, house, starterIds, _rng): RunState           // :101 — passes state.endless ?? false to generateArea
// game/engine/draftSession.ts
export function startDraft(seed: string, targetPicks = BALANCE.draft.teamSize): DraftSession
export function pickFrom(session: DraftSession, candidateIndex: number): DraftSession
//   DraftSession: { seed, pool, picks: DraftedWizard[], current: DraftedWizard[], screenIndex, done, targetPicks }
// game/engine/draft.ts
export function setDraftPoolRestriction(ids: Iterable<string> | null): void
// components/screens/DraftScreen.tsx  — <DraftScreen seed={string} onComplete={(picks: DraftedWizard[]) => void} target?={number} />
//   defaults target = STARTER_PICKS; calls onComplete(picks) when picks.length >= target
// hooks/useRunB.ts:89 completeDraft = (picked) => { confirmDraftPicks(runRef.current, picked, createRng(seed)); commit(next,'map') }
```

---

### Task 1: `confirmDraftPicks` threads `state.endless` into area-0 generation

**Why:** Endless will use `confirmDraftPicks` (not `chooseStarters`). `chooseStarters` passes `state.endless ?? false` to `generateArea` so endless area 0 excludes shop/spellForge nodes (Endless has no shop handler → soft-lock). `confirmDraftPicks` currently omits this. Campaign's `state.endless` is always falsy, so this is byte-identical for campaign.

**Files:**
- Modify: `game/engine/runEngine.ts:58-64`
- Test: `tests/engine/confirmDraftPicksEndless.test.ts`

**Interfaces:**
- Produces: `confirmDraftPicks(state, picked, rng)` now generates area 0 with `state.endless ?? false` (endless area 0 has no `shop`/`spellForge` nodes; campaign area 0 unchanged).

- [ ] **Step 1: Write the failing test** — `tests/engine/confirmDraftPicksEndless.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { startRunB, confirmDraftPicks, starterOffer, STARTER_PICKS } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { setDraftPoolRestriction } from '@/game/engine/draft'

// Build 3 real drafted wizards deterministically via the (kept) starterOffer helper.
function threeStarters(seed: string) {
  setDraftPoolRestriction(null)
  return starterOffer(seed, 'Grifondoro').slice(0, STARTER_PICKS)
}

describe('confirmDraftPicks endless threading', () => {
  it('endless area 0 excludes shop and spellForge nodes', () => {
    const seed = 'endless-draft-1'
    const picked = threeStarters(seed)
    const s = confirmDraftPicks({ ...startRunB(seed), endless: true }, picked, createRng(seed))
    const types = new Set(s.map!.map(n => n.type))
    expect(types.has('shop')).toBe(false)
    expect(types.has('spellForge')).toBe(false)
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(STARTER_PICKS)
  })
  it('campaign area 0 is unchanged (endless falsy) — team + map still build', () => {
    const seed = 'campaign-draft-1'
    const picked = threeStarters(seed)
    const s = confirmDraftPicks(startRunB(seed), picked, createRng(seed))
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(STARTER_PICKS)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/engine/confirmDraftPicksEndless.test.ts`). The endless test fails because area 0 can roll a shop/spellForge node.

- [ ] **Step 3: Implement** — in `game/engine/runEngine.ts`, edit `confirmDraftPicks` (line 60) to thread `state.endless`:

```ts
export function confirmDraftPicks(state: RunState, picked: DraftedWizard[], _rng: Rng): RunState {
  const starters = picked.slice(0, STARTER_PICKS).map(d => recruitVia(d, 'iniziale', 1))
  const map = generateArea(areaRng(state.seed, 0), state.seed, 0,
    { teamSize: starters.length, teamMax: state.teamMax ?? 5 }, state.endless ?? false)
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  return { ...state, area: 0, team: starters, activeSynergies: detectSynergies(starters),
    map, currentNodeId: entry.id, phase: 'map' }
}
```

(Only the `generateArea` call gains the trailing `state.endless ?? false` arg — mirror `chooseStarters:107-108`.)

- [ ] **Step 4: Run — expect PASS.** Then run the campaign draft/area suites to confirm no regression: `npx vitest run tests/engine/confirmDraftPicksEndless.test.ts tests/engine/draft.test.ts tests/engine/draftSession.test.ts` and `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add game/engine/runEngine.ts tests/engine/confirmDraftPicksEndless.test.ts
git commit -m "feat(endless): confirmDraftPicks threads endless into area-0 gen"
```

---

### Task 2: RunLog `draftPicks` + `replayRun` DraftSession + engine bump

**Files:**
- Modify: `game/engine/endlessReplay.ts`
- Test: `tests/engine/endlessReplay.test.ts`, `tests/lib/challengeCode.test.ts`

**Interfaces:**
- Consumes: `startDraft`/`pickFrom` (draftSession), `confirmDraftPicks` (Task 1), `STARTER_PICKS`.
- Produces:
  - `RunLog` is now `{ v: 1; engine: string; seed: string; draftPicks: string[]; actions: PlayerAction[] }` — `house`/`starterIds` REMOVED.
  - `replayRun(log)` reconstructs the team by driving a `DraftSession` over `log.draftPicks`, validating each id is on its screen; illegal pick → `{ valid:false, reason:'illegal draft pick' }`; wrong count → `reason:'incomplete draft'`.
  - `ENGINE_VERSION = 'endless-2'`.

- [ ] **Step 1: Write the failing tests** — replace the house/starterIds fixtures in `tests/engine/endlessReplay.test.ts`. Core new cases (keep the file's existing action-replay cases, just fix how the starting team is drafted):

```ts
import { describe, it, expect } from 'vitest'
import { replayRun, ENGINE_VERSION, type RunLog } from '@/game/engine/endlessReplay'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { STARTER_PICKS } from '@/game/engine/runEngine'

// Legal draft picks for a seed: drive the same DraftSession replayRun will, pick index 0 each screen.
function legalDraftPicks(seed: string): string[] {
  setDraftPoolRestriction(null)
  let s = startDraft(seed, STARTER_PICKS)
  const ids: string[] = []
  for (let i = 0; i < STARTER_PICKS; i++) { ids.push(s.current[0]!.wizard.id); s = pickFrom(s, 0) }
  return ids
}
const baseLog = (seed: string, over: Partial<RunLog> = {}): RunLog =>
  ({ v: 1, engine: ENGINE_VERSION, seed, draftPicks: legalDraftPicks(seed), actions: [], ...over })

describe('replayRun draft', () => {
  it('reconstructs the starting team from draftPicks (valid)', () => {
    const seed = 'replay-a'
    const out = replayRun(baseLog(seed))
    expect(out.valid).toBe(true)
    expect(out.state.team.map(d => d.wizard.id)).toEqual(legalDraftPicks(seed))
    expect(out.state.phase).toBe('map')
  })
  it('rejects a draft pick not on its screen', () => {
    const out = replayRun(baseLog('replay-a', { draftPicks: ['harry', 'harry', 'harry'] }))
    // 'harry' cannot legally be picked 3× (removed after first screen); at least one pick is off-screen
    expect(out.valid).toBe(false)
    expect(out.reason).toBe('illegal draft pick')
  })
  it('rejects an incomplete draft', () => {
    const seed = 'replay-a'
    const out = replayRun(baseLog(seed, { draftPicks: legalDraftPicks(seed).slice(0, 2) }))
    expect(out.valid).toBe(false)
    expect(out.reason).toBe('incomplete draft')
  })
  it('rejects an engine-version mismatch', () => {
    const out = replayRun(baseLog('replay-a', { engine: 'endless-1' }))
    expect(out.valid).toBe(false)
  })
})
```

Also update `tests/lib/challengeCode.test.ts`: its RunLog fixture must use `draftPicks` (drop `house`/`starterIds`) and assert round-trip `encodeChallenge`→`decodeChallenge` preserves `draftPicks`.

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/engine/endlessReplay.test.ts`): `draftPicks` not on `RunLog`, replay still uses `house`.

- [ ] **Step 3: Implement in `game/engine/endlessReplay.ts`.**

Update imports (add draftSession + STARTER_PICKS; `starterOffer`/`chooseStarters` no longer used here — remove them from the import if unused; keep `confirmDraftPicks`, `startRunB`):

```ts
import {
  startRunB, confirmDraftPicks, moveTo, resolveCurrentChecked,
  setWizardSpell, useConsumableRelic, reachable, registerCoreResolvers, combatRngForNode, STARTER_PICKS,
} from './runEngine'
import { startDraft, pickFrom } from './draftSession'
```

Bump version and RunLog:

```ts
export const ENGINE_VERSION = 'endless-2'

export interface RunLog {
  v: 1
  engine: string
  seed: string
  draftPicks: string[]
  actions: PlayerAction[]
}
```

Replace `structurallyValid` (drop `House` import usage / `VALID_HOUSES` if now unused):

```ts
function structurallyValid(log: RunLog): boolean {
  if (!Array.isArray(log.draftPicks) || !log.draftPicks.every(id => typeof id === 'string')) return false
  if (!Array.isArray(log.actions)) return false
  for (const a of log.actions) {
    if (!a || typeof a !== 'object' || !VALID_ACTION_TAGS.has((a as { t?: unknown }).t as string)) return false
  }
  return true
}
```

Replace the starter block in `replayRun` (the old lines 53-65) with the DraftSession drive:

```ts
  const rng = createRng(log.seed)
  // Reconstruct the starting team by driving the SAME seeded DraftSession the live draft used,
  // validating each recorded pick was legally on its screen (anti-cheat). Full roster (null).
  setDraftPoolRestriction(null)
  let session = startDraft(log.seed, STARTER_PICKS)
  for (const id of log.draftPicks) {
    const idx = session.current.findIndex(c => c.wizard.id === id)
    if (idx < 0) return { state: null as unknown as RunState, valid: false, reason: 'illegal draft pick' }
    session = pickFrom(session, idx)
  }
  if (session.picks.length !== STARTER_PICKS) {
    return { state: null as unknown as RunState, valid: false, reason: 'incomplete draft' }
  }
  // endless:true must be set BEFORE confirmDraftPicks so area-0 excludes shop/spellForge (Task 1).
  let s = confirmDraftPicks({ ...startRunB(log.seed), endless: true }, session.picks, rng)
```

(Note: `setDraftPoolRestriction(null)` already appears earlier at line 51 — keep a single call; ensure it runs before `startDraft`. The `rng` var stays for the action loop below; it is unused by the draft now but the loop's non-combat resolvers create their own `createRng(log.seed)`, so leaving `rng` is harmless — or pass it to `confirmDraftPicks` as its `_rng` arg as shown.)

If `House`/`VALID_HOUSES` become unused after this, remove them to keep the file clean.

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/engine/endlessReplay.test.ts tests/lib/challengeCode.test.ts`) + `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add game/engine/endlessReplay.ts tests/engine/endlessReplay.test.ts tests/lib/challengeCode.test.ts
git commit -m "feat(endless): RunLog draftPicks + DraftSession replay + engine bump endless-2"
```

---

### Task 3: `useEndless` — `completeDraft` replaces the house-pick flow

**Files:**
- Modify: `hooks/useEndless.ts`
- Test: `tests/hooks/useEndless.test.tsx`

**Interfaces:**
- Consumes: `confirmDraftPicks` (Task 1), the `RunLog` `draftPicks` shape (Task 2).
- Produces: `EndlessController` drops `starterOffer`/`chooseStarters`, gains `completeDraft: (picked: DraftedWizard[]) => void`. `getChallengeCode` emits `{ ..., draftPicks, actions }`.

- [ ] **Step 1: Write/adjust the failing test** — in `tests/hooks/useEndless.test.tsx`, replace uses of `controller.starterOffer(...)`/`controller.chooseStarters(...)` with `controller.completeDraft(pickedWizards)` where `pickedWizards` are drafted via a `startDraft(seed, STARTER_PICKS)` (import from draftSession) picking index 0 three times (mirror Task 2's `legalDraftPicks` but return the DraftedWizard[]). Assert: after `completeDraft`, `run.phase === 'map'` and `getChallengeCode()` decodes to a log whose `draftPicks` equals the picked ids. Keep the file's other action-recording assertions (they still apply).

- [ ] **Step 2: Run — expect FAIL** (`controller.completeDraft` undefined).

- [ ] **Step 3: Implement in `hooks/useEndless.ts`:**

- Imports: drop `starterOffer as starterOfferEngine, chooseStarters as chooseStartersEngine`; add `confirmDraftPicks` from runEngine. Keep `House` import only if still used elsewhere (it is used in the interface type today — after removing starterOffer/chooseStarters from the interface, `House` may become unused; remove it then).
- Replace the refs (`houseRef`, `starterIdsRef`) with `const draftPicksRef = useRef<string[]>([])`.
- Replace the `starterOffer`/`chooseStarters` callbacks with:

```ts
const completeDraft = useCallback((picked: DraftedWizard[]) => {
  draftPicksRef.current = picked.map(d => d.wizard.id)
  const next = confirmDraftPicks({ ...runRef.current, endless: true }, picked, createRng(runRef.current.seed))
  commit({ ...next, endless: true }, 'map')
}, [commit, runRef])
```

- `getChallengeCode`:

```ts
const getChallengeCode = useCallback((): string => {
  const log: RunLog = {
    v: 1,
    engine: ENGINE_VERSION,
    seed: runRef.current.seed,
    draftPicks: draftPicksRef.current,
    actions: actionsRef.current,
  }
  return encodeChallenge(log)
}, [runRef])
```

- Update the `EndlessController` interface: remove `starterOffer`/`chooseStarters`, add `completeDraft: (picked: DraftedWizard[]) => void`.
- Update the returned object accordingly (remove `starterOffer, chooseStarters`, add `completeDraft`).

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/hooks/useEndless.test.tsx`) + `npm run typecheck` (this will surface any remaining `starterOffer`/`chooseStarters` consumer — the Runner, fixed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add hooks/useEndless.ts tests/hooks/useEndless.test.tsx
git commit -m "feat(endless): useEndless.completeDraft replaces house-pick starter flow"
```

---

### Task 4: `EndlessRunner` UI — route draft phase to `DraftScreen`

**Files:**
- Modify: `components/screens/EndlessRunner.tsx` (route the draft phase; remove `EndlessStarterPick`)
- Test: `tests/screens/endlessResult.test.tsx` or a new `tests/screens/endlessRunner.test.tsx` (render)

**Interfaces:**
- Consumes: `completeDraft` (Task 3), the campaign `DraftScreen` (`components/screens/DraftScreen.tsx`).

**Next.js note:** This edits a React component only; no Next-specific API is touched. If you find yourself importing a Next API, read `node_modules/next/dist/docs/` first.

- [ ] **Step 1: Write the failing render test** — assert that when the endless controller is in `phase === 'draft'`, `EndlessRunner` renders the `DraftScreen` candidate UI (e.g. `getByTestId('draft-pick-0')`) and NOT the old house buttons. Model on `tests/screens/endlessResult.test.tsx` / existing DraftScreen render tests (`tests/screens/DraftScreen.test.tsx`). If mounting the full controller is heavy, render `EndlessRunner` with a stubbed controller in `phase:'draft'` exposing `run.seed` + `completeDraft`.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement in `components/screens/EndlessRunner.tsx`:**
  - Replace the `phase === 'draft'` branch that renders `EndlessStarterPick` with:

```tsx
if (c.run.phase === 'draft') {
  return <DraftScreen seed={c.run.seed} onComplete={c.completeDraft} />
}
```

  - Import `DraftScreen` from `@/components/screens/DraftScreen`.
  - Delete the `EndlessStarterPick` component (and its house-selection state/markup) from the file. Remove now-unused imports (`House`, `starterOffer`/`chooseStarters` props, etc.).

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/screens` + the new test) + `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add components/screens/EndlessRunner.tsx tests/screens/
git commit -m "feat(endless): draft phase renders campaign DraftScreen (no house pick)"
```

---

### Task 5: Update replay/parity tests + full-suite verification

**Files:**
- Modify: `tests/engine/endlessReplayParity.test.ts` (incl. the Duo-biased 30-seed section) and any other test still referencing `house`/`starterIds`/`controller.starterOffer`/`chooseStarters` in an ENDLESS context.
- Test/run: full suite + typecheck.

**Interfaces:** none new — this makes the suite green under the new draft flow and re-verifies the anti-cheat parity gate.

- [ ] **Step 1: Find every remaining consumer** — grep and list before editing:

Run: `git grep -n "starterIds\|\.house\|starterOffer\|chooseStarters" tests/ | grep -iv "campaignBalance\|avgPolicy"`
The balance-harness tests (`campaignBalanceB`, `avgPolicyProbe`) legitimately KEEP `starterOffer`/`chooseStarters` — leave them. Every ENDLESS test that built a `RunLog` header (`house`+`starterIds`) or drove the endless controller's `starterOffer`/`chooseStarters` must switch to the draft-pick flow.

- [ ] **Step 2: Update `tests/engine/endlessReplayParity.test.ts`.** Its `playAndRecord` harness drafts a team and records a `RunLog`. Change it to:
  - `setDraftPoolRestriction(null)`, `let s = startDraft(seed, STARTER_PICKS)`, pick 3 (see the Duo-bias note below), collecting `draftPicks` (ids) and `session.picks`.
  - Build the run via `confirmDraftPicks({ ...startRunB(seed), endless: true }, session.picks, rng)`.
  - Record the log as `{ v:1, engine: ENGINE_VERSION, seed, draftPicks, actions }` (no house/starterIds).
  - The **Duo-biased 30-seed section** (added for the Duo Combos parity gate): its old bias picked Duo-lighting starters from the house offer. Re-implement the bias over the DraftSession: at each of the 3 screens, if a candidate in `session.current` carries a Duo-relevant tag/role (reuse the existing `preferDuoScore`/selection helper, applied to `session.current` instead of the house offer), pick that index; else pick index 0. Keep the `anyRngDuoBattle` assertion (a MIASMA/UNTORE battle must occur) and the 0-mismatch parity assertion.

- [ ] **Step 3: Update any other flagged endless test** from Step 1 (e.g. `endlessScaling`, `endlessScore*`, `endlessBattleLevel`, netlify `submitScore`/`leaderboard` tests IF they construct a RunLog header) to the `draftPicks` flow. Leave campaign/balance-harness tests untouched.

- [ ] **Step 4: Run the parity gate — expect 0 mismatches** (`npx vitest run tests/engine/endlessReplayParity.test.ts`). If a mismatch appears, the live-vs-replay draft reconstruction diverges — confirm both sides call `setDraftPoolRestriction(null)` then `startDraft(seed)` identically before diagnosing further.

- [ ] **Step 5: Full suite + typecheck** — `npm run test` and `npm run typecheck`. Expected: all green (≥ prior 1354). Record counts.

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "test(endless): switch replay/parity tests to draftPicks flow"
```

---

## Self-Review (done at plan-write time)

**Spec coverage:** ✅ campaign DraftScreen flow for endless (T3/T4) · no house (T3/T4) · full-roster pool preserved (T3 keeps `setDraftPoolRestriction(null)`, T2 replay sets null) · RunLog `draftPicks` + per-pick anti-cheat validation (T2) · `confirmDraftPicks` endless area-0 threading (T1, spec §3.2 "endless:true before area gen") · ENGINE_VERSION bump / invalidate old codes (T2) · `starterOffer`/`chooseStarters` kept for balance harness (T2 keeps them, T5 leaves those tests) · parity 0-mismatch (T5) · RunState.house left unset like campaign (no task needed — spec §3.3, it's already optional/unused). No spec requirement without a task.

**Placeholder scan:** No TBD/"handle edge cases". Each engine step carries the real new code; the test-heavy steps (T4 render, T5 harness) name the exact file, the exact grep, and the exact reconstruction, with the one non-mechanical piece (Duo-bias over the DraftSession) spelled out.

**Type consistency:** `RunLog.draftPicks: string[]` defined in T2, produced by T3 (`draftPicksRef`), consumed by T2 `replayRun` + T5 tests. `completeDraft(picked: DraftedWizard[])` defined T3, consumed T4. `confirmDraftPicks(state, picked, rng)` (endless-threaded) from T1 used by T2 replay + T3 hook. `STARTER_PICKS`/`startDraft`/`pickFrom` reused verbatim. `ENGINE_VERSION='endless-2'` set T2, referenced by T3/T5.

**Cut line (if long):** T1+T2+T3 (engine+hook+replay, the anti-cheat core) is the load-bearing slice; T4 (UI) + T5 (test sweep) can follow. But all 5 are small — ship together.
