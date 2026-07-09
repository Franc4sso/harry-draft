# Endless Plan B — Playable UI + Verified Global Leaderboard — Design

**Date:** 2026-07-09
**Status:** Approved (design), pending user spec review
**Depends on:** Plan A (Endless core engine — merged, commit ec3d4d6)
**Author:** brainstorming session (francesco_cassano)

## Goal

Make Endless playable from the menu and competitive via a global leaderboard on
Netlify Blobs. Scores are **server-verified by re-simulation** (anti-cheat by
construction). Zero-euro: Netlify Free hard-limit plan; re-sim measured at ~20ms
(500× margin under the 10s function timeout). Local best works offline as fallback.

## Non-negotiable guarantees

1. **Campaign untouched.** Endless is a parallel flow. `useRunB`/campaign behavior
   unchanged; the shared logic extracted from `useRunB` (Task 1) must pass a
   before/after regression check proving campaign is byte-identical in behavior.
2. **Anti-cheat by construction.** Score is DERIVED by re-simulating the player's
   choices server-side, never transmitted as a raw number.
3. **Zero euro.** Netlify Free is hard-limit (300 credits/mo) — credits out → site
   pauses until next cycle; no auto-recharge, no bill. Leaderboard consumption is
   negligible (re-sim ~20ms; KB JSON). The credit risk is SITE bandwidth, not this.
4. **Fair leaderboard.** No meta-progression advantage: Endless has NO shop and NO
   profile currency (see §Anti-cheat design decisions). Everyone starts equal.

## Anti-cheat design decisions (the three holes found in hostile review)

A hostile re-read of the naive design surfaced three defects; all are resolved here.

### Decision 1 — the replay log is a full PlayerAction union, not just ResolverChoice
The player has state-changing actions OUTSIDE `resolveCurrent` (verified in
`hooks/useRunB.ts`): `setWizardSpell`, `useConsumableRelic` (and, in campaign,
`rerollShop`/`leaveShop`/`shop-buy`). A replay that captured only `(nodeId,
ResolverChoice)` would DIVERGE from real state → wrong score → anti-cheat broken.

Because Endless drops the shop (Decision 2), the residual out-of-band actions are only
`setWizardSpell` and `useConsumableRelic` — both verified PURE on `RunState` with no
profile/localStorage dependency (`setWizardSpell` validates against the wizard's static
`spellPool`; `useConsumableRelic` validates ownership + `active:'revive'`). The replay
log therefore captures this union:

```typescript
type PlayerAction =
  | { t: 'move'; nodeId: string }
  | { t: 'resolve'; choice: ResolverChoice }   // recruit/relic/event/spell-upgrade/combat-ack/skip
  | { t: 'set-spell'; wizardId: string; spellId: string }
  | { t: 'use-consumable'; relicId: string }
```

### Decision 2 — Endless has NO shop and NO profile currency
Cioccorane (🍫) lives in `MetaProfile` (localStorage, `lib/metaStore.ts`), NOT in
`RunState` — the engine comments confirm "cioccorane effects never touch state". So a
🍫 balance is NOT reconstructible from the seed; the server cannot validate shop
purchases → a cheater claims infinite 🍫. USER DECISION: Endless has no shop nodes and
no meta currency. This also makes the leaderboard FAIR (grinding meta-unlocks can't buy
a leaderboard advantage). Implementation: Endless map generation passes category
weights with `shop: 0` and `spellForge: 0` to `assignAreaCategories` (nodeGen.ts) — the
weighting mechanism already exists; no rewrite. Relics still come from deterministic
relic nodes.

### Decision 4 — Endless draft pool is fixed to the FULL roster, profile-independent
The draft/starter pool is profile-dependent: `createDraftPool()` (draft.ts) reads a
module-global `poolRestriction` that `useRunB` sets to `[...STARTER_WIZARDS,
...profile.unlockedWizards]`. `starterOffer(seed, house)` LOOKS pure but internally calls
`createDraftPool()`, so the offered starters depend on the player's unlocks (localStorage).
Two consequences: (a) the SERVER has no `poolRestriction` set → `createDraftPool()` returns
the full roster → the replayed draft DIVERGES from the client → wrong score; (b) it is
UNFAIR — players with more unlocks get stronger starters, a leaderboard edge from grind not
skill. USER DECISION: in Endless the draft/starter pool is the FULL roster (all wizards),
fixed and profile-independent. Client and server both draft from the full roster explicitly
(the endless flow does NOT set `poolRestriction` from the profile; it uses the full pool).
This is deterministic from the seed, re-simulable, fair, and maximizes build variety
(good for future archetypes/combos). Relic pool is likewise the full relic set in Endless.

### Decision 3 — engine-version gating
A challenge code re-simulated under a changed engine yields a different score. The log
carries `v: 1` AND an engine-version tag; the server REJECTS replays whose engine
version is incompatible (does not silently recompute a wrong score).

## Architecture overview

Client-pure core (free forever) + a thin, detachable Netlify layer.

| # | Component | Responsibility | Location |
|---|-----------|----------------|----------|
| 1 | Shared run logic | Extract dispatch/move/combat-prep from useRunB so campaign + endless share it | `hooks/useRunShared.ts` (+ refactor `useRunB.ts`) |
| 2 | Endless hook | Drive an endless run; log every PlayerAction; wipeout → score | `hooks/useEndless.ts` |
| 3 | Endless UI | Menu entry, route, run views (reuse RunBRunner), end-run + leaderboard screen | `app/endless/`, `components/screens/Endless*` |
| 4 | Challenge code | Encode/decode the RunLog; the replay payload | `lib/challengeCode.ts` |
| 5 | Replayer | Pure `replayRun(log) → {state, valid}`; strict legality validation | `game/engine/endlessReplay.ts` |
| 6 | submit-score fn | Re-simulate → score → write Blobs; reject invalid/incompatible | `netlify/functions/submit-score.ts` |
| 7 | leaderboard fn | Read top-N from Blobs | `netlify/functions/leaderboard.ts` |
| 8 | Local best + nickname | localStorage personal bests; nickname prompt on first submit | `lib/endlessLocal.ts` |

The engine is pure TS (verified: no React/DOM; the `endlessScaling` test already drives
full headless runs). The Netlify function imports `game/engine` directly (approach A —
single source of truth for simulation).

## Component 1 — Shared run logic (the one campaign-touching change)

`useRunB.ts` is 313 lines. Rather than clone it (two 300-line files that drift), extract
the shared, mode-agnostic logic — resolver dispatch, `moveTo`, combat prep, node
resolution — into `hooks/useRunShared.ts`. `useRunB` (campaign) and `useEndless` both
consume it. The ONLY differences between modes: area advance (`clearAreaAndAdvance` vs
`advanceEndlessArea`), end-of-run (win/defeat vs score), and action logging (endless only).

**Risk & mitigation:** this is the sole change to campaign code. It must be behavior-
preserving. Task 1 lands a regression test asserting a campaign run produces the
identical sequence of states/views before and after the extraction, and the full suite +
`campaignBalanceB` gate stay green. If extraction proves too entangled, fall back to a
minimal shared helper set rather than a full restructure.

## Component 2 — Endless hook (`useEndless.ts`)

Wraps the shared logic with: `endless: true` on the run state; `advanceEndlessArea` at
area boundaries; **append a `PlayerAction` to an in-memory RunLog on every player action**
(move, resolve, set-spell, use-consumable); on wipeout, compute `scoreForEndlessRun` and
transition to the score screen. The RunLog + seed/house/starterIds is the challenge code
source.

## Component 3 — Endless UI

- Menu entry ("Endless") on the main menu (`app/page.tsx` / menu component) + route
  `app/endless/page.tsx`.
- Run views REUSE `RunBRunner`'s node/battle/map views (they are mode-agnostic once
  Component 1 lands) — no combat UI rebuild.
- New end-run screen: final score, floor reached, personal bests (localStorage), nickname
  prompt (first submit), submit button, and the global leaderboard (top-N from the
  leaderboard function). Uses the existing premium UI system (shared classes/GameShell).

## Component 4 — Challenge code (`lib/challengeCode.ts`)

```typescript
interface RunLog {
  v: 1
  engine: string          // engine-version tag (Decision 3)
  seed: string
  house: House
  starterIds: string[]
  actions: PlayerAction[]  // Decision 1 union, in order
}
encodeChallenge(log: RunLog): string   // base64url, compact
decodeChallenge(s: string): RunLog      // validates v + shape; throws on malformed
```
Contains INPUTS only — no score. Self-verifying: any tampering changes the replayed run.

## Component 5 — Replayer (`game/engine/endlessReplay.ts`)

`replayRun(log: RunLog): { state: RunState; valid: boolean; reason?: string }`

- Rebuild: set the FULL-roster draft pool (Decision 4 — NOT the profile restriction) →
  `startRunB(seed)` → `chooseStarters(house, starterIds)` → for each action, apply the
  matching engine function (`moveTo` / `resolveCurrent` / `setWizardSpell` /
  `useConsumableRelic`), with `advanceEndlessArea` at boundaries. Client and server MUST
  set the identical full pool before drafting, or the replay diverges — this is the single
  most important determinism precondition.
- **Strict legality (closes the silent-no-op hole):** resolvers return the SAME state on
  an illegal choice (e.g. a `relicId` never offered). A silent no-op must make the replay
  INVALID, not "a different valid run". After each action, assert it produced the expected
  effect — the node was `reachable`, the choice was in the resolver's `enter` offer, the
  action changed state when it should. On any failure: `valid: false` with a reason.
- Terminates at wipeout; returns the final state for scoring. Reuses the exact loop shape
  proven in `tests/engine/endlessScaling.test.ts`.

Lives in `game/engine/` — pure, shared by client (optional local verify), server, tests.

## Component 6 — submit-score function (`netlify/functions/submit-score.ts`)

```
POST { challengeCode, nickname }
  → decodeChallenge (400 on malformed)
  → reject if engine version incompatible (409, Decision 3)
  → replayRun; if !valid → 400 (rejected replay, with reason)
  → score = scoreForEndlessRun(state); floor = globalFloor(state)
  → validate nickname (length 1..20, safe charset)
  → Blobs: read leaderboard key → insert sorted → truncate top-N (e.g. 100) → write
  → 200 { rank, score, floor }
```
Imports `game/engine` directly. Re-sim ~20ms (measured). Fail-silent on exhausted
credits (Netlify pauses the site; the client falls back to local best).

## Component 7 — leaderboard function (`netlify/functions/leaderboard.ts`)

```
GET → Blobs read top-N key → 200 [{ nickname, score, floor }]
```
Small JSON. Cached briefly if useful.

## Component 8 — Local best + nickname (`lib/endlessLocal.ts`)

- localStorage: personal best scores (list of `{ score, floor }`, sorted by score desc).
  No timestamp needed — ordering is by score, and the engine has no `Date.now` anyway.
- Nickname: prompted on first submit, stored in localStorage, reused after.
- Works with zero network — the offline/credits-exhausted fallback.

## Blobs storage model

One key `leaderboard` → JSON array of `{ nickname, score, floor }`, sorted desc, truncated
to top-N. Write is read-modify-write with sorted insert. Adequate for indie volume; if it
ever needs concurrency-safe ranking, migrate the write path to Upstash sorted-set (the
client/challenge-code contract is unchanged).

## Implementation order (plan tasks, TDD)

1. **Shared run logic extraction** (campaign-touching; regression-gated) — Component 1.
2. **PlayerAction log + challenge code** encode/decode — Component 4.
3. **Replayer** with strict legality validation — Component 5 (the anti-cheat core).
4. **Endless hook** wiring log + advance + score — Component 2.
5. **Endless map gen** excludes shop/spellForge nodes (Decision 2); **Endless draft uses
   the full roster, not the profile pool** (Decision 4) — both wired here.
6. **Endless UI** menu/route/end-run screen — Component 3, 8 (local best + nickname).
7. **submit-score function** (re-sim + Blobs write) — Component 6.
8. **leaderboard function** (Blobs read) — Component 7.
9. **End-to-end**: play → submit → verified rank; tamper → rejected.

Client-pure components (1-5, 8) are testable with zero infra. The Netlify functions (6-7)
land last and are detachable — local best keeps Endless playable without them.

## Risks & mitigations

- **Campaign regression from useRunB extraction** → behavior-preserving regression test,
  gate stays green, minimal-helper fallback (Component 1).
- **Replay divergence** (missed player action) → PlayerAction union covers all out-of-band
  actions; Endless has no shop, shrinking the surface (Decisions 1-2).
- **Forged illegal-choice log** → strict legality validation in replayRun (Component 5).
- **Engine drift breaks old scores** → engine-version gate rejects incompatible replays
  (Decision 3).
- **Draft-pool divergence / unfairness** (profile unlocks leak into starters) → Endless
  drafts from the full roster, profile-independent, client and server identical (Decision 4).
- **Credit overrun** → fail-silent functions + hard-limit plan; local best fallback.
