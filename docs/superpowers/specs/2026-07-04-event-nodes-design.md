# Event Nodes (`?`) + broken-relic seed — design spec

**Date:** 2026-07-04
**Status:** approved (brainstorm) → ready for implementation plan
**Goal:** make the run dramatically more **replayable and varied** by adding choice-and-consequence **event nodes** (`?`), and seed the "rule-breaking combo" energy by having some events hand out a few **scaling / rule-bending relics** — so events deliver *exciting* cargo, not stat-bumps.

## 1. Why (the design bet)

The run today is thin: nodes are only battle/elite/boss/recruit/relic/infirmary, so every run feels alike. The single biggest replayability lever in this genre is the **`?` event room** (Slay the Spire): each run hits a different, surprising mix of choices with consequences. Events are also the natural, *interesting* place to acquire build pieces — including rule-breaking relics — via **painful/risky choices** rather than a boring "pay currency" shop.

**Cargo-first principle:** an event system that only hands out modest stat relics is a delivery truck for boring loot. So this slice pairs the delivery (events) with a **seed of genuinely exciting cargo**: a small set of rule-bending relics + inherently run-altering event effects (swap a spell, trade a wizard for one **+2 levels**, sacrifice a wizard for a broken relic). The larger pool of god-tier scaling relics is the explicit **next slice**, delivered through the event system this slice builds.

## 2. Locked decisions

- **New node type `event` (`?`)**, telegraphed on the map, resolved via a choice screen. Follows the existing node→resolver→phase→screen pattern (mirrors recruit/relic/infirmary).
- **Data-driven events** with a small typed **effect vocabulary** (Approach A) — maximises how many events we can author (authoring = pure data), which is the whole point (replayability). No per-event scripting in this slice (YAGNI; add a `custom` escape hatch only if a future event needs it).
- **Economy = broad palette.** Events trade primarily in **run resources** (team HP, wizards: add/remove/level/swap-spell, relics) and can also **grant/cost Cioccorane** (the meta currency — USER pick) sparingly. The *memorable* choices trade run resources / painful sacrifices, not chocolate-frog prices.
- **Deterministic, but varied.** An event's identity and its random ("gamble") outcomes are seeded off the run seed + node id (same seed → reproducible run), so different seeds → different events/outcomes → replayability. Gambles resolve via the run RNG.
- **Choices can be gated** (a `requires` predicate: enough Cioccorane, a wizard of a role/tag, roster not full, etc.); an unmet choice renders disabled with the reason.

## 3. Architecture (follows the existing node pattern)

Grounded in the current engine (`game/engine/resolvers/*`, `nodeCatalog`, `runEngine`, `map.ts`, `nodeGen`, `hooks/useRunB`, `components/screens/*`).

### 3.1 Data — `data/events.ts`
```
type EventEffect =
  | { kind: 'healTeam'; pct: number }            // heal each living wizard by pct of maxHp
  | { kind: 'damageTeam'; pct: number }          // costs pct of maxHp (floored at 1)
  | { kind: 'levelWizard'; which: 'weakest'|'strongest'|'random'; levels: number }
  | { kind: 'swapSpell'; which: 'weakest'|'strongest'|'random' } // reroll that wizard's active spell within its pool
  | { kind: 'addWizard'; level?: number }        // recruit-style add (roster space or replace weakest)
  | { kind: 'removeWizard'; which: 'weakest'|'random' }
  | { kind: 'grantRelic'; relicId: string }      // hand out a specific (possibly rule-breaking) relic
  | { kind: 'grantRelic'; pool: 'ruleBreaking' }  // hand out a random relic from a curated pool
  | { kind: 'cioccorane'; amount: number }        // +/- meta currency
  | { kind: 'gamble'; chance: number; win: EventEffect[]; lose: EventEffect[] }

interface EventChoice { id: string; label: string; requires?: EventRequirement; effects: EventEffect[]; resultText?: string }
interface GameEvent { id: string; title: string; text: string; choices: EventChoice[] }   // a choice pool authored as data
export const EVENTS: GameEvent[]
```
`EventRequirement` (small union): `{ minCioccorane: n } | { role: Role, count: n } | { tag: string, count: n } | { rosterHasSpace: true }`.

### 3.2 Effect engine — `game/engine/events.ts`
- `applyEventEffects(state: RunState, effects: EventEffect[], rng: Rng): { state: RunState; log: string[] }` — pure, deterministic given rng. Applies each effect by reusing existing engine actions where possible (`recruitVia`/`replaceMember` for add, `setWizardSpell` for swap, relic-append for grant, leveling helper for levelWizard, currency helpers for cioccorane). `gamble` forks rng, branches on `rng.chance(chance)`.
- One clear responsibility; independently unit-testable (feed a state + effects → assert new state).

### 3.3 Resolver — `game/engine/resolvers/event.ts`
- `eventResolver: NodeResolver` (`id: 'event'`). `enter` picks the event for this node (seeded: `pickEvent(rng.fork(...))` from `EVENTS`, honoring anti-repetition like themes do) and returns its choices as offers. `resolve` on a `{ kind: 'event-choice'; optionId }` applies the chosen `effects` via `applyEventEffects`, logs a `RunEvent`, returns to the map.
- `ResolverChoice` gains `{ kind: 'event-choice'; optionId: string }`.
- `ResolverEntry.offers` gains an optional `eventChoices?: { id, label, enabled, hint? }[]` (so the UI can render/disable choices) — or a parallel `event?: {...}` field; decided in the plan to keep the interface clean.

### 3.4 Wiring
- `types/run.ts`: `RunNodeType` += `'event'`; `RunState['phase']` += `'event-node'`.
- `game/engine/nodeCatalog.ts`: register `event` → `{ resolverId: 'event', label/icon '?' }`.
- `runEngine.ts`: `phaseForNode` += `event → 'event-node'`; register `eventResolver` in `registerCoreResolvers`.
- `game/engine/nodeGen.ts`: place `event` nodes as a filler category (weighted), like recruit/relic — some areas get 1-2 events, telegraphed as `?`. Events never replace the guaranteed infirmary/elite/relic/boss.
- `map.ts`: event nodes need **no battle package**; skipped by the battle-package loop (only battle/elite/boss get packages).
- `hooks/useRunB.ts`: `'event-node'` phase + `chooseEventOption(optionId)` controller method (mirrors `chooseRecruit`); `viewForPhase` maps it to a new `'event'` view.
- `components/screens/EventScreen.tsx`: renders `title`, `text`, and the choice buttons (disabled + hint when `requires` unmet); on click → `chooseEventOption`. Themed like the existing node screens (Sala Comune material, `Frame`/`Insegna`), reduced-motion aware. `RunBRunner.tsx` renders it for the `event` view.

### 3.5 Cargo seed — rule-bending relics (`data/relics.ts`)
2–3 relics with **rule-breaking / scaling** energy (exact mechanics pinned in the plan after verifying available engine hooks — reuse `onHit`/`onBattleStart` triggers and the now-**permanent** veleno where possible to avoid new combat rewrites). Design intent (illustrative, final ids/values in the plan):
- **Zanna Vorace** — every hit applies **2** veleno stacks instead of 1 (with permanent veleno = a real ramp engine).
- **Furia Iniziale** — at battle start, your highest-atk wizard gains a big atk buff for the fight.
- **Patto di Sangue** (assignable) — carrier deals big bonus damage but takes recoil (reuses the `grantsDarkMagic` recoil pattern).
These form the `'ruleBreaking'` grant pool some events draw from. (The god-tier *cross-run scaling* relics — "crit → permanent +atk for the rest of the run", "on-kill spread", etc. — need run-persistent relic state / new hooks and are the **next slice**, delivered via these events.)

## 4. Starter event pool (~6, all data)

1. **Il Cappello Parlante** — choose: level your **weakest** wizard +2, OR swap its spell (reroll), OR nothing (leave, heal team 15%).
2. **Lo Scambista** — trade your weakest wizard for a **new one +2 levels** above it. (User's idea.) `requires` roster non-empty.
3. **La Coppa Maledetta** — gamble: 60% gain a rule-breaking relic, 40% the team takes 25% max-HP damage.
4. **Il Patto** — pay a wizard (remove weakest) → gain a rule-breaking relic + 20 Cioccorane. `requires` team size > minimum.
5. **La Fonte** — spend Cioccorane (requires ≥30) → heal team fully + a small permanent relic; or leave.
6. **L'Ombra** — a blessing/curse coin-flip: 50% all wizards +8 atk (relic), 50% a random wizard loses its spell (swap to base). Pure gamble, no cost — the "risk it?" texture.

## 5. Testing

TDD. The slice is done when:
1. **Effect engine** (`applyEventEffects`) — each effect kind mutates state correctly and deterministically (unit tests: heal, damage-floor-at-1, levelWizard, swapSpell, add/remove, grantRelic, cioccorane, gamble both branches via seeded rng).
2. **Resolver** — entering an event node offers a seeded event's choices; resolving an option applies its effects and returns to the map; gated choices are marked disabled.
3. **Placement** — `nodeGen` produces `event` nodes at the intended frequency; they never displace the guaranteed infirmary/elite/relic/boss; determinism holds (same seed → same map).
4. **No battle package** — event nodes carry no `battle`/`preview`; the map builder skips them without error.
5. **UI** — `EventScreen` renders title/text/choices, disables gated choices with a hint, and `chooseEventOption` drives the transition (component test mirroring the recruit/relic screen tests).
6. **Full campaign still resolves** — the balance harnesses still run to a terminal phase with `event` nodes present (bot picks a sensible default option); no soft-locks.

## 6. Scope boundaries (YAGNI)

**In:** the `event` node type + resolver + effect engine + `EventScreen` + placement + ~6 authored events + 2-3 rule-bending relics as event rewards + tests.

**Out (next slices):**
- God-tier **cross-run scaling** relics (run-persistent relic state, new on-kill/on-turn hooks) — the "Balatro jokers". Delivered via these events later.
- A dedicated **shop** node; **campfire** rest-choice; **battle modifiers**. (Other replayability nodes from the same menu.)
- Per-event scripted logic (`custom` effect) — add only when an event needs it.
- Event art / elaborate multi-step branching stories.

## 7. Risks / open questions (resolve in the plan)

- **Balance-harness bots** must pick a sensible default event option (e.g. the safest/most-value choice) or they'll skew win rates / soft-lock. The plan adds a tiny bot policy for `event-node` (mirrors how the bots handle recruit/relic).
- **`levelWizard`/`addWizard +levels`** — confirm the leveling helper (`game/engine/leveling.ts`) can apply N levels to a drafted wizard cleanly (stat growth), and that a "+2 levels above" trade is well-defined.
- **`ResolverEntry` shape** — extend cleanly for event choices without breaking the recruit/relic offers contract.
- **Determinism** — event pick + gambles must fork the run RNG deterministically (same pattern as `themedEnemyTeam`/boss pick).
- **nodeGen frequency** — tune so events feel special (not every floor) but reliably appear (~1-2/area); must not break the existing guarantees or the balance floor.
- **Cioccorane coupling** — keep event Cioccorane amounts small; the memorable choices trade run resources, so spending in-run doesn't badly tax meta-unlocks.
