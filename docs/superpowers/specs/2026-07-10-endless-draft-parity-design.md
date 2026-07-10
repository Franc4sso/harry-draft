# Endless draft = campaign screen-draft — design spec

**Date:** 2026-07-10
**Status:** Design approved (brainstorming), ready for writing-plans.
**One-liner:** Replace Endless's house-pick starter draft with the campaign `DraftScreen` flow
(3 tier-weighted screens, pick 3, no house), keeping the full-roster pool for leaderboard fairness,
and rework the anti-cheat RunLog/replay to record per-pick draft choices.

---

## 1. Why

The user wants the Endless initial draft to be **the same as normal (campaign) runs**: 3 wizards drafted
one-per-screen from tier-weighted candidates, with **no house selection** ("non voglio che l'utente
scelga una casata e di conseguenza i più forti"). Today Endless makes the player pick a House, then pick
3 wizards from that whole house's roster shown at once — the exact "pick a house, take the strongest"
flow the user rejects.

---

## 2. Current state (verified)

- **Campaign draft (target flow):** `components/screens/DraftScreen.tsx` → `hooks/useDraft.ts` →
  `game/engine/draftSession.ts` (`startDraft`/`pickFrom`) → `hooks/useRunB.ts` `completeDraft` →
  `confirmDraftPicks` (`runEngine.ts`). `STARTER_PICKS = 3` (`runEngine.ts:50`). Screens are `screenSize:3`
  tier-weighted candidates (`data/constants.ts` `BALANCE.draft`), one pick per screen, 3 screens.
  Pool = `[STARTER_WIZARDS + profile.unlockedWizards]` via `setDraftPoolRestriction` (`useRunB.ts:67-72`).
- **Endless draft (to replace):** `components/screens/EndlessRunner.tsx` `EndlessStarterPick` → house
  buttons → `starterOffer(seed, house)` (`runEngine.ts:67`, full house pool) → pick 3 → `chooseStarters`
  (`runEngine.ts:101`). Pool = full roster (`useEndless.ts:61` `setDraftPoolRestriction(null)`).
- **Endless anti-cheat/replay:** the draft is encoded in the `RunLog` HEADER as `house` + `starterIds`
  (`endlessReplay.ts:20-27`), NOT as `actions`. `replayRun` re-derives the team by re-running
  `starterOffer(seed, house)` and validating every `starterId` is in that offer (`endlessReplay.ts:55-65`).

---

## 3. Design (decisions locked in brainstorming)

**Behavior.** Endless's initial draft becomes the campaign `DraftScreen` flow exactly: 3 sequential
screens × 3 tier-weighted candidates, pick one per screen, `STARTER_PICKS = 3`, **no house selection**.
After this change, the ONLY difference between campaign and Endless draft is the pool.

**Pool (confirmed): FULL ROSTER for Endless.** Endless keeps `setDraftPoolRestriction(null)` (all ~60
wizards, unlock-independent) — this matches "tra tutti" AND preserves the leaderboard-fairness rule
(Endless must not depend on meta unlocks). Campaign is unchanged (unlocked pool).

**Engine version (confirmed): bump, invalidate old Endless codes.** The draft change alters replay
semantics, so `ENGINE_VERSION` (`endlessReplay.ts:12`) bumps; old Endless challenge codes / leaderboard
entries stop validating (accepted — not widely deployed).

### 3.1 Code (mostly reuse)
- **UI:** `EndlessRunner` routes `phase === 'draft'` to the campaign `<DraftScreen seed=... onComplete=.../>`
  (same component campaign uses), NOT `EndlessStarterPick`. Retire `EndlessStarterPick` and the
  house-selection UI.
- **Controller:** `useEndless` gains `completeDraft(picked: DraftedWizard[])` mirroring `useRunB.completeDraft`:
  it runs `confirmDraftPicks(runRef.current, picked, createRng(seed))`, sets `endless: true`, commits to
  the map phase, and records the picks for replay (§3.2). It keeps `setDraftPoolRestriction(null)` set
  before the draft. `starterOffer`/`chooseStarters` wrappers are removed from the Endless controller.
- **Keep** `starterOffer`/`chooseStarters` in `runEngine.ts` — the balance harness
  (`campaignBalanceB.test.ts`, `avgPolicyProbe.test.ts`) still uses them; not this feature's concern.

### 3.2 Anti-cheat / replay rework (the real work)
- **RunLog** (`endlessReplay.ts`): drop `house` and `starterIds`; add the ordered draft picks. Store the
  **picked wizard ids in pick order** (`draftPicks: string[]`, length 3). (Wizard ids over screen indices:
  human-readable, and legality is validated by membership in the reconstructed screen either way.)
- **Recording:** `useEndless.completeDraft` writes the 3 picked ids (in order) to a ref the challenge-code
  encoder reads (replacing `houseRef`/`starterIdsRef`).
- **Replay** (`replayRun`): set `setDraftPoolRestriction(null)`, then drive a `DraftSession`:
  `startDraft(log.seed, STARTER_PICKS)`, and for each recorded pick, **validate the id is present in the
  current screen** (`session.current.some(c => c.wizard.id === id)`) — this is the anti-cheat check,
  replacing the old `offeredIds` membership test — then `pickFrom(session, indexOfThatId)`. After 3 picks,
  `confirmDraftPicks(startRunB(seed) with endless:true, session.picks, rng)` to build the starting state.
  Any pick not on its screen → `{ valid: false, reason: 'illegal draft pick' }`.
- **Determinism:** live play and replay both `setDraftPoolRestriction(null)` then `startDraft(seed)` (pure,
  channel `draftRngChannel`, per-screen forks), so the screens reconstruct identically. `endless: true`
  must be set before area-0 generation (as today).
- **Version:** bump `ENGINE_VERSION`.

### 3.3 RunState.house
Campaign never sets `RunState.house` (the DraftSession flow doesn't pick one), so it is already optional
and unused mechanically by the campaign path. Endless drops the house too; leave the `house?` field as-is
(no migration needed) — it simply goes unset in Endless, exactly like campaign.

---

## 4. Testing
- **Replay parity:** `tests/engine/endlessReplayParity.test.ts` must stay 0-mismatch under the new draft
  (the recorded picks reproduce the same team + score). Update its `playAndRecord` harness to draft via the
  new flow.
- **Anti-cheat:** a new test that a `draftPicks` entry NOT present in its reconstructed screen →
  `replayRun` returns `valid:false` (`'illegal draft pick'`).
- **Endless hook/replay tests** (`tests/hooks/useEndless.test.tsx`, `tests/engine/endlessReplay*.test.ts`):
  update to the DraftScreen flow (no house). The balance-harness tests that use `starterOffer` are
  untouched (those functions remain).
- **Determinism:** same seed → same reconstructed screens → same team, live vs replay.
- Full suite + `npm run typecheck` green.

---

## 5. Out of scope
- Campaign draft (unchanged). The `starterOffer`/`chooseStarters` functions (kept for the balance harness).
- Any change to the full-roster fairness rule (Endless stays unlock-independent).
- Leaderboard/back-compat migration for old codes (explicitly invalidated).

## 6. Project rules honored
- Copy in Italian. Endless stays unlock-independent (leaderboard fairness). Determinism = anti-cheat
  (replay must reproduce the draft exactly; parity gate green). `npm run test` does not typecheck →
  run `npm run typecheck` separately.
