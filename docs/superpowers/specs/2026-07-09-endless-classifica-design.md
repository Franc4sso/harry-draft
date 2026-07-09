# Endless Mode + Global Leaderboard — Design

**Date:** 2026-07-09
**Status:** Approved (design), pending implementation-plan split
**Author:** brainstorming session (francesco_cassano)

## Goal

Add a retention hook: an **infinite Endless run** with a **competitive leaderboard**,
so players return to climb deeper than before. Score rewards **skill (depth + style)**,
not grind. Backend is **Netlify Blobs** — free within the hard-limit plan, with a
**zero-backend fallback** (shareable challenge codes) baked into the core.

## Non-negotiable guarantees

1. **Zero euro.** Netlify Free is a hard-limit credit plan (300 credits/mo) — when
   credits run out, functions stop; there is **no auto-recharge and no surprise bill**.
   The leaderboard's own consumption is negligible (KB JSON payloads, not GB bandwidth).
   Functions **fail silent** on exhausted credits; they never push an upgrade.
2. **Campaign untouched.** The Endless loop is DECOUPLED (like the existing `campaignB`
   loop). No change to `campaign` balance constants; the `campaignBalanceB` gate stays green.
3. **Anti-cheat by construction.** Score is DERIVED from replay inputs, never transmitted
   as a raw number. The server (and any receiving client) re-simulates to compute it.
4. **Fallback included.** The challenge-code core works with zero backend. If Blobs is
   ever removed, peer-to-peer challenge sharing still functions — no rework.

## Architecture overview

Core is **client-pure** (free forever). Blobs is a **thin, detachable layer** on top.

```
Fine run → challengeCode(seed + actions) → submit-score (Netlify function)
    → function RE-SIMULATES with runEngine → derived score → Netlify Blobs
Open game → leaderboard (function) → top-N from Blobs
Offline / credits exhausted → challenge-code still verifies locally (fallback)
```

| # | Component | Responsibility | Location |
|---|-----------|----------------|----------|
| 1 | Endless driver | Wrap `runEngine`; generate areas infinitely with rising difficulty | `game/engine/endless.ts` |
| 2 | Scaling | Enemy level rises past `levelMax` with floor; isolated from campaign | `BALANCE.endless` (new block) |
| 3 | Score calculator | Pure `RunState → number`: depth × (1 + kill-bonus + hp-bonus) | `game/engine/endlessScore.ts` |
| 4 | Recruit-level fix | Recruit enters at the area's normal enemy level, not level 1 | `game/engine/recruit.ts` + `resolvers/recruit.ts` |
| 5 | Challenge code | Serialize `seed + actions`; score derived → self-verifying | `lib/challengeCode.ts` |
| 6 | Blobs layer | `submit-score` (re-sim) + `leaderboard`; fail-silent, detachable | `netlify/functions/` |
| 7 | Calibration | Sweep near-optimal bot; pick difficulty `k` from data | `tests/engine/endlessScaling.test.ts` |

The engine is already deterministic (seeded mulberry32 RNG in `game/engine/rng.ts`,
no `Date.now`/`Math.random` in the engine — those live only in `lib/vfx` and `lib/seed`),
with zero React/DOM coupling. Re-simulation on the server (Node) reuses `runEngine` as-is.

## Component 1 — Endless driver (`game/engine/endless.ts`)

Wraps the existing `runEngine`. Where the campaign stops at the final area, Endless keeps
generating areas indefinitely with a rising difficulty index. Reuses `generateArea`,
`runEngine`, and all resolvers unchanged. The Endless run terminates only on **wipeout**;
the final score is a function of how deep the player reached.

**Units of progression:** a "floor" is one node cleared; an "area" is a block of floors
(matching the campaign's area grouping). End-of-area **full-recovery heal** is inherited
from `runEngine.ts clearAreaAndAdvance` so HP-persistence attrition is capped at one area —
this keeps difficulty legible (level is the sole rising lever) and the calibration clean.

## Component 2 — Scaling (`BALANCE.endless`)

**Key correction from investigation:** the real difficulty driver is **enemy level**, not
menace. `menaceForLevel` was removed (returns 0 since 2026-07-01); difficulty comes from
`enemyLevelFor(area, kind)` — which drives REAL per-level stat growth via `leveledStats` —
plus draft budget (`budgetB`). Today `enemyLevelFor` clamps to `levelMax: 10`.

**Endless scaling = extend enemy level past the `levelMax: 10` clamp, growing with floor.**
This reuses the existing level→stat-growth pipeline instead of adding a parallel multiplier.

- Selection window (`budgetWindow`) saturates at the top of the wizard pool after a few
  floors — expected and fine; it only guarantees enemies draft from the strongest wizards.
  It is NOT the infinite lever (the pool is finite).
- **Level is the infinite lever.** Endless computes an enemy level that keeps rising with
  the floor, UNCAPPED (bypassing the `levelMax` clamp that governs the campaign only).
  `levelMax: 10` stays as the CAMPAIGN enemy ceiling; Endless uses its own level formula.
- **Curve shape:** near-linear, e.g. `endlessEnemyLevel(floor) = normalBase + floor * k`.
  Linear spreads deaths across many floors → graded leaderboard → real competition.
  Geometric compresses deaths into a narrow 2-3 floor window → poor differentiation. Avoid.
- **No cap.** Unlike the campaign boss (statMult 0.55 ceiling), Endless level has no tetto.

Isolation: all Endless parameters live in a NEW `BALANCE.endless` block. `campaign`,
`campaignB`, and `menaceBase: 0` are untouched. The `campaignBalanceB` gate is unaffected.

## Component 3 — Score calculator (`game/engine/endlessScore.ts`)

Pure, deterministic `RunState → number`. Same replay → same score (this is what makes the
leaderboard verifiable).

```
score = floorsCleared * POINTS_PER_FLOOR * (1 + killBonus + hpBonus)
```

- **Base = depth.** `floorsCleared` is the primary lever.
- **killBonus** — weighted count of elite/boss kills (each worth more than a normal kill).
- **hpBonus** — fraction of total team HP preserved at run end. Rewards clean play.
- The "few relics used" style lever was CUT (would incentivize refusing relics — anti-fun).

**Mandatory properties:**
- Pure & deterministic (`RunState → number`), no time/random.
- **Monotonic in depth:** going deeper must never lower the score (else players game for an
  early stop). Style bonuses are multiplicative on a depth base, so more depth always wins.

## Component 4 — Recruit-level fix (`recruit.ts` + `resolvers/recruit.ts`)

**Bug:** `recruitVia` (recruit.ts:47) hardcodes `level: 1, exp: 0`. A recruit always enters
at level 1, useless mid/late run (and unplayable deep in Endless). Affects BOTH campaign and
Endless — this is a general recruitment fix, not Endless-only.

**Fix:**
- `recruitVia(dw, via, targetLevel)` accepts a target level. It sets `level: targetLevel`
  AND `exp: expForLevel(targetLevel)` (leveling.ts:33 already exists) so `levelFromExp` does
  not snap the recruit back to 1 on the next tick. Growth stats resolve coherently.
- `recruitResolver` (resolvers/recruit.ts:33) computes `enemyLevelFor(area, 'normal', false)`
  from node context and passes it as `targetLevel`.
- **Chosen rule (user decision):** recruit enters at the area's NORMAL enemy level — on par
  with the standard mobs of the area. In Endless the "area" grows unbounded, so the recruit
  level rises naturally with depth.

**Test:** a recruit taken at area N enters at `enemyLevelFor(N,'normal')` with coherent exp
(does not regress to level 1 on the first status tick).

## Component 5 — Challenge code (`lib/challengeCode.ts`)

Serializes `seed + player actions` (draft picks, node choices) into a compact base64url
string. `encode(runLog) → string` / `decode(string) → runLog`.

- **Does NOT contain the score** — it contains INPUTS. Score is recomputed by re-simulating.
  Tampering with a number is impossible: change anything and the replay no longer reproduces.
- Serves two jobs from one artifact: offline peer-to-peer sharing AND the payload the Blobs
  function re-simulates. One piece, two uses.

**Presentation (user decision — "personal best + challenge code"):** the player sees their
own best scores (localStorage) with a badge. At run end they generate a shareable challenge
code. A friend pastes it → local re-simulation → verified score shown → "beat 47 floors" on
the same seed.

## Component 6 — Blobs leaderboard layer (`netlify/functions/`)

Thin layer over the client-pure core. **Build this AFTER the core is playable and fun.**

- **`submit-score`** — receives a challenge code → re-simulates with `runEngine` → computes
  score server-side → writes `{name, score, floor, seed}` to Netlify Blobs. The client cannot
  cheat: the server recomputes the number from inputs.
- **`leaderboard`** — reads top-N from Blobs.
- **Budget guard-rails:** functions fail silent when credits are exhausted (leaderboard
  submits pause until next cycle; no bill, no upgrade prompt). Spec documents what consumes
  what so the credit ceiling is always legible. The real credit risk is SITE bandwidth
  (assets/portraits), not the leaderboard — noted so it is not mis-attributed.
- **Detachable:** remove Blobs and the challenge-code core still works. No lock-in.

## Component 7 — Calibration (`tests/engine/endlessScaling.test.ts`)

Difficulty `k` is MEASURED, not guessed — same method as the existing `campaignBalanceB` gate.

- Run a near-optimal bot over ~100 seeds; read the DISTRIBUTION of death-floor for candidate `k`.
- Target: median death in a healthy window (e.g. floors 15-40) AND a long tail (skilled runs
  reach 60+). Not a hard wall, not an infinite-boring plateau.
- `k` is chosen from the data.

## Implementation split

This design becomes **two implementation plans**, built and tested in order:

- **Plan A — Endless core:** components 1, 2, 3, 4, 7. Playable and fun on its own, zero infra.
  Score (comp 3) is computed and shown locally; no code sharing yet.
- **Plan B — Leaderboard:** components 5, 6. Added only after A proves fun.

Component 5 (challenge code) belongs to Plan B: it is not needed for core playability (Plan A
shows scores locally). It is authored first within Plan B because both the offline peer-to-peer
fallback and the Blobs `submit-score` re-simulation depend on it.

## Risks & mitigations

- **Scaling curve wrong** (wall or plateau) → mitigated by data-driven `k` calibration (comp 7).
- **Recruit exp incoherence** (level set but exp snaps back) → mitigated by setting exp via
  `expForLevel` (comp 4).
- **Credit overrun** → mitigated by fail-silent functions + hard-limit plan (no bill possible).
- **Campaign regression** → mitigated by full decoupling into `BALANCE.endless` + gate stays green.
