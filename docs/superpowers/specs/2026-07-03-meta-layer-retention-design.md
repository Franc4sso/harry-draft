# Meta-Layer & Retention — Design Spec

**Date:** 2026-07-03
**Status:** Approved design, ready for implementation plan
**Scope:** The first retention block — persistent profile, content unlocks, currency, milestones, end-of-run ceremony, codex/collection hub, plus a light seeded boss pool.

---

## Problem

Players quit after 1–2 runs. Diagnosis (confirmed in code and in `docs/superpowers/specs/2026-06-28-game-design-direction.md`): a run terminates on a bare "Nuova run" button with **zero persistence** — no unlocks, no currency, no collection, no lifetime stats. All 60 wizards and 28 relics are available from run 1, and the run is structurally identical every time (fixed 3×5 floors, same 3 bosses in the same order). The game gives away all its novelty immediately, so it is consumed in 1–2 runs.

Retention rests on a triangle: each run should **leave something** (permanent progress), **promise something** (a visible next unlock), and **vary** (structural novelty). Today the game has none of the three. This block builds the first two lines fully and the cheapest slice of the third.

## Design decisions (locked)

- **Unlock model: Hybrid.** Deterministic milestone unlocks (guaranteed cadence) + a currency ("Cioccorane") earned every run and spent freely in a hub (player choice).
- **Lock depth: Medium.** Start with ~20 of 60 wizards and ~12 of 28 relics; the rest is unlocked through play.
- **Horizontal only.** Unlocks add variety, never power. Currency never buys power. This protects the already-tuned hard-mode balance and never punishes new players.
- **Light boss pool folded in.** One alternate boss per area (reskins reusing calibrated `budget`/`hpMult`), picked per-run by seed — reinforces the meta-layer (codex + boss milestones) at near-zero balance risk.

## Non-goals (later waves)

Ascension ladder, daily run, achievements-with-rewards, event/shop node resolvers, map-shape variety, per-area biome modifiers, floor-count changes. Explicitly out of this block.

---

## The two reservations, and how this design retires them

### Reservation 1 — a restricted starter pool could break hard-mode balance

The game is tuned to ~0.10 win rate assuming the full 60-wizard pool. Restricting the player's pool risks making early runs unwinnable or feel bad.

**Resolution — turn the worry into an automated gate.** Three facts from the code make this cheap:

1. **Single choke point.** Both player draft entry points (`starterOffer` in `runEngine.ts`, recruit offers in `recruit.ts`) funnel through one function: `createDraftPool()` in `game/engine/draft.ts`. Enemies draw from `WIZARDS` directly (`teamGen.ts`), bypassing it. So restricting the player pool is a ~7-line seam and leaves enemy strength untouched.
2. **The measuring instrument already exists.** `tests/engine/campaignBalanceB.test.ts` plays 120 full bot-vs-bot runs with a near-optimal bot and produces the live ~0.10 win rate. We clone it, wrap the sweep in `setDraftPoolRestriction(STARTER_SET)`, and assert the restricted win rate clears the same 0.07 floor. The starter set becomes a **test fixture that must pass CI**.
3. **The data dictates the starter-set rules** (so it is designed, not guessed):
   - **Tier-representative.** Power is not uniform (tier weights `{1:1, 2:3, 3:30, 4:66}`, tier 1 strongest). The starter set samples across all tiers so restricting does not lower the average power the bot can reach — this both holds the floor and keeps unlocks horizontal (you start *different*, not *weaker*).
   - **≥3 Grifondoro.** The bot hardcodes `starterOffer(seed, 'Grifondoro')` and takes the top 3 by power; fewer than 3 Grifondoro under-fills the starter offer.
   - **Keep harry/ron/hermione.** Golden Trio is the only ID-fragile synergy; keeping all three makes it reachable from run 1 (a strong tutorial synergy).
   - **≥3 veleno wizards.** Preserves the tested "veleno counters the Muro wall" affordance in early runs.
   - **≥8 wizards minimum** to avoid recruit-pool exhaustion (`offerRecruits` throws below `offerSize`); 20 is comfortably safe.

**Outcome:** we do not hope the starter set is balanced — the harness proves it, or we iterate the set (or soften the lock as a fallback). Gate cost: ~7 lines in `draft.ts` + one test file.

### Reservation 2 — the run stays structurally identical

The meta-layer answers "why start run #3" but does not change that run #3 *plays* like run #1 (same floors, same 3 bosses). Collection-chasing realistically buys ~15–25 runs before structural sameness reasserts.

**Resolution — fold in the cheapest structural lever, which also feeds the meta-layer.** The three area bosses are the only fully deterministic memorable climax (regular/elite packs already vary per seed). `generateBossTeam(rng, BossDef)` is entirely data-driven and the selection RNG is already isolated per `(seed, area)` in `battlePackage.ts`. Replacing the hardcoded area if/else with a `BOSSES_BY_AREA` pool and a seeded pick is ~10 lines. Alternate bosses **reuse an existing boss's calibrated `budget`/`hpMult`**, swapping only `bossWizardId` / `name` / `exclusiveSynergy` → near-zero balance risk. Because a boss pool is exactly the kind of content worth *unlocking* and *collecting*, boss variants become codex entries and milestone triggers — structural variety and retention reinforce each other.

Heavier structural levers (event nodes, map shape, biome modifiers) stay in later waves.

---

## Architecture

Seven units, each with one purpose, communicating through typed interfaces. The React screens are thin consumers of the pure engine/store layer.

### Unit 1 — `lib/metaStore.ts` (new, pure, no React)

The persistence foundation. Stores the profile in `localStorage` under `harry:profile:v1`, sibling to the existing `harry:run:v1` (untouched). All other units read/write the profile only through this module's typed helpers.

```ts
interface MetaProfile {
  version: 1
  cioccorane: number
  unlockedWizards: string[]        // ids unlocked beyond the starter set
  unlockedRelics: string[]
  unlockedBosses: string[]         // alt-boss ids unlocked
  milestones: Record<string, boolean>   // which milestone flags have fired
  stats: {
    runsPlayed: number
    runsWon: number
    bossesKilled: number
    bestStageReached: number
    totalCioccoraneEarned: number
    wizardUsage: Record<string, number>
  }
  codex: {
    wizardsSeen: string[]
    relicsSeen: string[]
    synergiesSeen: string[]
    bossesSeen: string[]
  }
}
```

Public API (pure functions over a loaded profile, plus load/save):
- `loadProfile(): MetaProfile` — creates a default profile (starters unlocked, 0 currency, empty codex) on first load or missing key; migrates older versions forward.
- `saveProfile(p: MetaProfile): void`
- `grantCioccorane(p, amount): MetaProfile`
- `spendCioccorane(p, amount): MetaProfile | null` — null if insufficient
- `unlockWizard(p, id) / unlockRelic(p, id) / unlockBoss(p, id)` — idempotent
- `markSeen(p, kind, id): MetaProfile`
- `recordRunEnd(p, summary: RunSummary): { profile, earned, unlocked }` — applies currency + evaluates milestones from a run summary; returns what changed so the ceremony can animate it.

**Backward compat:** existing players with only `harry:run:v1` get a fresh default profile on first load; no data loss.

### Unit 2 — `data/unlocks.ts` (new, data-driven)

The single source of truth for what is locked, how it unlocks, and what it costs.
- `STARTER_WIZARDS: string[]` (~20 ids), `STARTER_RELICS: string[]` (~12 ids) — the curated starter sets, obeying the four rules above.
- `MILESTONES: Milestone[]` — table of `{ id, when(summary): boolean, unlock: {kind, id} }`. Examples: beat Il Muro → a wizard; beat Bellatrix → a Mangiamorte; first Voldemort kill → a marquee wizard; complete a named synergy in a run → the missing piece of that family; reach Area 2 → a relic; defeat an alt-boss variant → a wizard.
- `UNLOCK_COSTS: { wizard: number; relic: number }` — currency prices for the hub (e.g. wizard 100, relic 60).
- `EARN_FORMULA` params — Cioccorane per floor cleared + per elite/boss killed + first-win bonus; losses pay a reduced amount. Tuned so the first unlock is reachable within a few runs.

**Invariant tests (Unit 2):** starter set covers all 4 houses and all 4 roles; contains ≥3 Grifondoro, harry/ron/hermione, and ≥3 veleno wizards; every locked wizard/relic is reachable by at least one path (milestone or purchasable) so nothing is permanently unreachable.

### Unit 3 — draft pool restriction (`game/engine/draft.ts`)

The single integration point that hides content. ~7 lines:

```ts
let restriction: ReadonlySet<string> | null = null
export function setDraftPoolRestriction(ids: Iterable<string> | null): void {
  restriction = ids ? new Set(ids) : null
}
export function createDraftPool(): Wizard[] {
  return restriction ? WIZARDS.filter(w => restriction.has(w.id)) : [...WIZARDS]
}
```

At run start, the app computes `available = STARTER_WIZARDS ∪ profile.unlockedWizards` and calls `setDraftPoolRestriction(available)`. Relic offers are filtered the same way at the relic resolver. **Enemies are unaffected** (they use `WIZARDS` directly) — you fight wizards you have not unlocked, which is itself a desire hook.

### Unit 4 — light boss pool (`data/bosses.ts` + `game/engine/combat/battlePackage.ts`)

- `data/bosses.ts`: add `BOSSES_BY_AREA: BossDef[][]` — one alternate `BossDef` per area alongside the existing Muro / Bellatrix / Voldemort, each reusing the existing boss's calibrated `budget`/`hpMult` and swapping `bossWizardId` / `name` / `exclusiveSynergy`.
- `battlePackage.ts`: replace the hardcoded area if/else boss selection with a seeded pick from `BOSSES_BY_AREA[area]` using the already-isolated `(seed, area)` RNG fork. Locked alt-bosses are excluded from the pick until unlocked (so boss variants are discoverable content); the default boss is always in the pool.

**Balance note:** because alt-bosses reuse calibrated numbers, the existing `campaignBalanceB` floor is expected to hold; the boss-pool test re-runs the sweep to confirm.

### Unit 5 — end-of-run ceremony (`components/screens/ResultScreen.tsx`)

Replaces the bare "Nuova run". On run end, calls `recordRunEnd` and stages the returned deltas:
- Animated Cioccorane tally (per-source breakdown).
- Milestone unlock reveals ("Nuovo mago sbloccato: ___") — the dopamine beat.
- Lifetime stats delta (run #, best stage, bosses killed).
- Buttons: "Nuova run" + "Collezione".

### Unit 6 — collection / hub screen (new component, from menu + result)

The completionist driver:
- Cioccorane balance.
- Grid of all 60 wizards and 28 relics: unlocked in full color; locked as silhouettes showing *how* to unlock (milestone text or "compra: 100 🍫"); seen-but-locked (met as enemies) show richer info than never-seen.
- Purchase action spends Cioccorane via `spendCioccorane` + `unlockWizard/Relic`.
- Lifetime stats panel.

### Unit 7 — codex "seen" tracking (hooks in the run flow)

When a wizard/relic/synergy/boss is encountered (drafted, offered, fought against, triggered), call `markSeen`. Powers the "scoperti X/60" counter and enriches locked entries. Enemy-team wizards are marked seen when a battle package is built.

---

## Data flow

```
New run:
  loadProfile() → available = STARTER_WIZARDS ∪ unlockedWizards
              → setDraftPoolRestriction(available)
              → relic offers filtered by STARTER_RELICS ∪ unlockedRelics
  During run: markSeen(...) on draft/offer/enemy/synergy/boss encounters
Run ends:
  build RunSummary → recordRunEnd(profile, summary)
                  → { profile', earned, unlocked }  → saveProfile(profile')
  ResultScreen animates earned + unlocked
Hub:
  spendCioccorane + unlockWizard/Relic → saveProfile
```

## Error handling & edge cases

- Corrupt/absent `harry:profile:v1` → `loadProfile` returns a fresh default (never throws).
- Version mismatch → migrate forward; unknown future version → treat as default rather than crash.
- Idempotent unlocks (re-firing a milestone or re-buying an owned item is a no-op).
- Restriction is cleared (`setDraftPoolRestriction(null)`) in test teardown so suites see the full 60.
- Starter-set floor guarantees recruit offers never exhaust.

## Testing

- **Balance gate (Reservation 1):** `tests/engine/campaignBalanceRestricted.test.ts` — clones `runOne`, wraps the 120-seed sweep in `setDraftPoolRestriction(STARTER_WIZARDS)`, asserts `winRate > 0.07`. Fails CI if the starter set is unwinnable.
- **Boss pool (Reservation 2):** re-run the balance sweep with alt-bosses in the pool; assert the floor still holds.
- **metaStore unit tests:** default creation, migration, grant/spend, idempotent unlocks, `recordRunEnd` currency + milestone evaluation.
- **unlocks invariant tests:** starter coverage (houses/roles/Grifondoro≥3/trio/veleno≥3), full reachability of every locked item.
- **draft filter test:** a locked wizard is never drafted by the player but still appears in enemy teams.
- Existing suites must stay green (typecheck + full test run).

## Rollout order (for the implementation plan)

1. `metaStore.ts` + `data/unlocks.ts` (+ their tests) — the foundation, no UI.
2. Draft restriction seam + `campaignBalanceRestricted.test.ts` — **the Reservation-1 gate; iterate the starter set until it passes before building UI on top.**
3. Boss pool + its balance test.
4. Codex "seen" hooks.
5. ResultScreen ceremony.
6. Collection/hub screen.
