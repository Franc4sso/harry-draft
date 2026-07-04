# Scaling Jokers — Design Spec

**Date:** 2026-07-05
**Status:** Approved for planning
**Author:** paired (Francesco + Claude)

## Goal

Deliver **within-run scaling relics** ("jokers", Balatro-style) — relics that grow
**permanently within a single run** and reset at run start. This is the concrete
delivery of the "make combos necessary" north-star: jokers reward *committing to a
build direction*, and the payoff (the fully-scaled joker) only materializes if the
player commits.

**Explicitly NOT cross-run.** State lives on `RunState`, never on `MetaProfile`.
Every run starts from zero. This preserves the validated difficulty
(see memory `difficulty-validated-harder-is-good`): jokers accelerate a run that is
*already winning* (you only scale if you get kills); they do **not** rescue a losing
run and must **not** soften difficulty.

## Non-goals

- No cross-run / meta persistence of joker growth.
- No shop node, campfire, or battle modifiers (separate future slices).
- No new keywords or spells.
- No forced-build encounters (explicitly rejected direction — see memory
  `counter-web-veleno-wall`).

## Design decisions (and why)

### One new hook only: `onKill`

- **Cadence:** scaling wants *rare, meaningful* trigger events. Frequent hooks
  (`onHit`) hit their cap in a single battle → no satisfying growth arc. Kills are
  rare and earned → the right cadence for a Balatro-style scaling curve.
- **Scope discipline:** shipping a single new hook (vs. `onKill` + `onApplyStatus`
  + `onWin`) minimizes engine surface and balance-harness disruption. All three
  starter jokers key `onKill`, differentiated by *what stat they grow*.
- **Killer-side semantics:** `onKill` fires from the perspective of the unit/side
  that caused a KO — at every `!alive` transition in `simulate.ts` (direct hit,
  recoil, DoT tick, fatigue). The existing `onDeath` fires for the *victim* side and
  is not a substitute. Friendly-fire is structurally impossible (existing guards in
  `effects.ts`), so a kill is always an enemy going down — no self-scaling exploits.

### Jokers stack on a shared trigger (the "joker synergy" feel)

All three starter jokers key `onKill`, so a single kill triggers every held joker at
once. Holding two scalers compounds a kill-focused board — this *is* the Balatro
joker-combo dopamine, and it emerges from the shared trigger with no extra machinery.

### Starter set (3 jokers)

| id | name | trigger | grows | cap | build it pushes |
|----|------|---------|-------|-----|-----------------|
| `fame-vorace` | Fame Vorace | onKill | `+attack` per kill | +20 | pure aggro / snowball |
| `collezionista-anime` | Collezionista di Anime | onKill | `+maxHp` per kill | +80 | aggro-bruiser (survivable snowball) |
| `marchio-vorace` | Marchio Vorace | onKill | `+veleno power` per kill | +15 | **aggro + DoT combo** (kill → poison hits harder) |

`marchio-vorace` is the explicit cross-keyword combo: it only pays off if you *also*
run a veleno build, welding two archetypes into one payoff. Per-kill increments and
caps are **starting values** — final tuning is gated on the balance harness + playtest.

### Data-driven scaling primitive

Add a generic `grows` spec to `RelicTrigger` so future jokers are pure data, matching
the codebase's data-driven grain (events, relics):

```ts
// types/relic.ts — on RelicTrigger
grows?: {
  stat: 'attack' | 'maxHp' | 'velenoPower'   // extensible union
  per: number      // increment per trigger fire
  cap: number      // max cumulative bonus (bonus = min(runCounter * per, cap))
}
```

`ActiveRelic` gains one mutable counter:

```ts
// types/relic.ts — on ActiveRelic
runCounter?: number   // cumulative qualifying-trigger count this run; undefined == 0
```

One counter per `ActiveRelic` is sufficient (each joker has exactly one `grows` spec).

### Persistence architecture (the key integration)

The combat sim is pure and its `EventBus` is created per-battle and discarded, so the
counter **cannot** live inside the sim. Flow:

1. During a battle, the `onKill` handler for a scaling relic tallies qualifying fires
   into the **battle result** as `relicScalingDeltas: Record<relicId, number>`
   (count of `onKill` fires for that relic's owner side).
2. The **combat resolver** (`game/engine/resolvers/combat.ts`) applies the deltas
   back onto `RunState.relics[i].runCounter` after the battle resolves.
3. Stat calculation reads the *effective* bonus from the counter:
   `min((runCounter ?? 0) * per, cap)`, folded into `applyRelicBonuses` /
   the relevant stat path in `game/engine/relics.ts`.

Because the counter lives on `RunState.relics`, it persists across battles within a
run and is discarded when a new `RunState` is constructed → automatic reset. Nothing
touches `MetaProfile`.

## Architecture / files touched

- `types/events.ts` — add `onKill` to `ReactiveHook`.
- `types/relic.ts` — add `grows` to `RelicTrigger`; add `runCounter` to `ActiveRelic`.
- `game/engine/combat/simulate.ts` — emit `onKill` (killer side) at every `!alive`
  transition; tally scaling deltas into the battle result.
- `game/engine/relics.ts` — whitelist `onKill` in `registerRelicTriggers`; fold the
  counter-derived bonus into the stat/bonus read path.
- `game/engine/resolvers/combat.ts` — apply `relicScalingDeltas` to
  `RunState.relics[i].runCounter` post-battle.
- `data/relics.ts` — define the 3 jokers (append to `RELICS`; add to offer pool).
- Battle-result type (wherever `simulate` returns) — add `relicScalingDeltas`.

## Testing

TDD per joker + integration:

1. **Scaling monotonicity:** N kills → bonus increases by `per` each, up to `cap`,
   then clamps.
2. **Cap respected:** kills beyond cap/per do not exceed `cap`.
3. **Cross-battle persistence:** counter carries from battle A to battle B within a
   run (via resolver write-back).
4. **Run reset:** a fresh `RunState` has `runCounter` unset/zero.
5. **No friendly fire / no self-scaling:** killing does not fire for the victim side;
   only the killer's jokers scale.
6. **`marchio-vorace` combo:** veleno power actually increases and feeds veleno damage.
7. **Full suite re-anchor:** adding `onKill` perturbs the map/combat RNG stream and
   shifts the full-run balance harnesses (`campaignBalanceB`,
   `campaignBalanceRestricted`, veleno/esecuzione/magieOscure sweeps,
   `relicBalance`, etc.). Run the FULL suite (lesson from event-nodes); re-anchor
   shifted reference sweeps as smoke/structural guards, keep archetype-signal
   assertions. **Difficulty guard:** the restricted-pool winRate must NOT balloon —
   if it rises materially, lower the caps.

## Balance stance

Jokers are a **win-more accelerant, bounded by caps**: you scale only by getting
kills (a board already winning), the growth resets each run, and the final 5-unit boss
remains an action-economy wall. Caps start conservative. The balance harness is the
first gate; **user playtest is ground truth** for feel.

## Open tuning knobs (deferred to playtest, not blockers)

- Exact `per` / `cap` per joker.
- Whether `marchio-vorace` should also scale on DoT-tick kills (it will by default,
  since DoT kills fire `onKill`) — verify this feels good, not degenerate.
