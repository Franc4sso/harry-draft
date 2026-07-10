# Handoff & Archetypes/Combos Direction

**Date:** 2026-07-10
**Purpose:** Resume point for a PC switch. Summarizes what's shipped, open follow-ups, and the archetypes/combos direction (NOT yet a plan — brainstorm first).

---

## 1. What's shipped (on master, pushed to origin)

### Endless Plan A — core engine (merged commit ec3d4d6)
Infinite Endless run + skill-based local score, gated on `RunState.endless` so campaign is untouched.
- `game/engine/endless.ts` — `advanceEndlessArea` (infinite, never wins, heals at boundary), `globalFloor`, `scoreForEndlessRun`.
- `game/engine/combat/threat.ts` — `endlessEnemyLevel(floor)` UNCAPPED (bypasses levelMax:10).
- `game/engine/endlessScore.ts` — pure depth×(1+kill+hp) score.
- Recruit-level fix: recruits enter at area normal level, not 1.
- Calibration: `BALANCE.endless` — `levelPerFloor: 0.1` + `levelPerFloorSq: 0.010` (median death-floor ~19, p90 ~99). `tests/engine/endlessScaling.test.ts` is the gate.

### Endless Plan B — playable UI + verified leaderboard (merged commit 1aed8d4)
Playable from menu (`/endless`), server-verified global leaderboard on Netlify Blobs.
- `hooks/useRunShared.ts` — mode-agnostic run logic extracted from `useRunB` (campaign byte-identical, snapshot-gated).
- `hooks/useEndless.ts` — endless hook; records every player action into a `RunLog`; full-roster draft; score at wipeout.
- `game/engine/endlessReplay.ts` — `PlayerAction`/`RunLog` types + `replayRun` (strict legality, anti-cheat core). `resolveCurrentChecked` in runEngine detects illegal no-ops.
- `lib/challengeCode.ts` — base64url codec (browser Buffer fallback).
- `lib/endlessLocal.ts` — localStorage personal bests + nickname.
- `netlify/functions/{leaderboard,submit-score}.ts` — read + re-simulation write. Score is 100% server-computed (anti-cheat by construction). Fail-silent (zero-euro).
- `components/screens/Endless{Runner,Result}.tsx`, `app/endless/page.tsx`, menu entry.

### Anti-cheat integrity (hard-won — two review saves)
- replayRun's no-op legality check was DEAD CODE (Critical, caught by adversarial review) → fixed (`resolveCurrentChecked`).
- replay combat used raw rng vs live's forked `combatRng` → replay score ≠ played (resubmit exploit, caught by final whole-branch review) → fixed. **`tests/engine/endlessReplayParity.test.ts` is the permanent multi-seed parity gate** (was 11/20 mismatch pre-fix, 20/20 post-fix).
- Fairness: full-roster draft (profile-independent), no shop/meta currency in Endless, engine-version gating.

### Verification state
Full suite 1274/1274 green, typecheck clean, campaignBalanceB winRate 0.2833 unchanged.

---

## 2. Open follow-ups (non-blocking, from the ledger)

All ACCEPTABLE — none blocks anything. Address if/when they bite:
- **Nickname HTML-encoding**: currently trim+cap(20) only. React auto-escapes on render, so no current XSS vector; encode if a raw-HTML leaderboard render is ever added.
- **Blobs inner try/catch**: submit-score/readLeaderboard Blobs ops rely on the handler catch-all (500 on outage). Matches design.
- **useEndless log-before-delegate**: action pushed to log before applying; a throw would leave a phantom entry. Not reachable in normal flow (UI only sends reachable ids).
- **useRunShared raw setters**: exposes setBattle/setLastFallen/commit/runRef for restart — small abstraction leak, campaign-only.
- **endlessLocal**: caps/corrupt-JSON paths correct but untested; `getLocalBests` trusts stored shape.
- **scoreForEndlessRun kill-count is final-area-only** (`state.map` regenerates per area) — elite/boss-kill bonus barely matters except in the last area. Confirm this is the intended scoring model; if not, add a running counter on RunState.
- **`levelPerFloor`/`levelPerFloorSq` now interact**: any endless scaling OR endless map-gen change must re-run the endlessScaling sweep.
- **LESSON for future reviews**: when a task touches shared map/engine generation, the reviewer must run ALL dependent gates including calibration sweeps — the Task 5 review missed the endlessScaling regression because it only ran endlessNodeGen + campaignBalanceB.

---

## 3. Archetypes / Combos — direction (NOT a plan yet)

**Why now:** Endless is the natural proving ground for build variety (full-roster draft = many builds). A leaderboard is only interesting if there are DISTINCT viable builds; one dominant line makes it a seed lottery. Archetypes are the content that gives the leaderboard meaning.

**Key insight — the foundation already exists.** This is an EXTENSION of the synergy system, not a new system. `data/synergies.ts` already has 5 archetype axes:
- **role** (Attaccante/Tank/Supporto/Controllo — stat bonuses at 2/3/4)
- **house** (Grifondoro/Serpeverde/Corvonero/Tassorosso)
- **group** (Golden Trio, Weasley, Ordine, Mangiamorte, Malandrini, Esercito di Silente)
- **origin/tag** (Tossicità=veleno, Spietatezza=esecuzione, Bastione=scudirigen, Oscurità=magieOscure)
- And `data/relics.ts` has scaling relics (trigger: kill/turn/battleWin/allyDead) + conditional relics (teamSizeBelow) — build-defining payoffs.

So an "archetype" = a synergy axis pushed to a full build payoff + supporting relics/spells that reward committing to it. The mechanic-seeds the code already tunes: **veleno** (Tossicità — bypasses damage reduction by design), **taunt/muro** (Tank + Iron Taunt + scudirigen/Bastione), **glass cannon** (Attaccante + esecuzione/Spietatezza), **regen/attrito** (Supporto + Tassorosso).

**The tension to resolve in brainstorming (this is the hard part):** the user likes the game HARD. Archetypes/combos that are too strong make it EASIER for whoever finds them → against that preference. The design target is combos that open DEPTH (go further in Endless, differentiate the leaderboard) WITHOUT trivializing. A combo should be a reason to go deeper, not a win button.

### Open questions to decide (in the next brainstorming session)
1. **How many archetypes to seed first?** (Recommend 2-3 distinct ones — e.g. veleno-stack, taunt-wall, glass-cannon — not a big bang.)
2. **Build enabler mechanism:** new synergy families? new scaling/conditional relics keyed to a tag? archetype-specific spells? (Likely a mix — reuse the synergy `bonus`/`keywordMult` + relic `scaling` machinery.)
3. **Balance gate:** every archetype moves campaignBalanceB AND the endlessScaling calibration. Each archetype is its own calibration slice — must re-measure both gates. (Memory: "re-measure campaignBalanceB on ANY enemy-power change"; and endless has two interacting levers now.)
4. **Player-only vs enemy:** JOKER relics are player-only by design (that's what keeps them balance-safe — see memory `harry-draft-jokers-player-only`). Archetype payoffs likely follow the same rule; decide explicitly.
5. **Where combos live:** campaign, Endless, or both? (Endless is the safer sandbox to introduce them; campaign has a tight balance floor.)

### Recommended next-session flow
1. `superpowers:brainstorming` → pick 2-3 archetypes, answer Q1-Q5 above, produce a spec.
2. `superpowers:writing-plans` → one plan; each archetype is a TDD task ending with its calibration slice (campaignBalanceB + endlessScaling both green).
3. `superpowers:subagent-driven-development` → execute (same flow as Plan A/B: implementer → task review → final whole-branch review).

**Ground rule reaffirmed from this session:** trust adversarial review over green tests. The two worst bugs (dead-code anti-cheat, replay-score divergence) shipped green and were only caught by capable-model review. Any archetype work must re-run the full gate set, not just the touched test.

---

## 4. How to run / play (for the other PC)
- Dev: `npm run dev` → open the app → menu has **Campagna** and **Endless**.
- Tests: `npm run test` (full suite ~150s) + `npm run typecheck` (separate — Vitest does NOT typecheck).
- Balance gate: `npx vitest run tests/engine/campaignBalanceB.test.ts` (winRate must stay ~0.2833) and `tests/engine/endlessScaling.test.ts` (median death-floor ~19).
- Leaderboard is Netlify-only (functions in `netlify/functions/`); locally Endless works with local best (offline fallback), the online leaderboard needs a Netlify deploy.
