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

### Kill detection via a per-side tally (not a bus hook)

Scaling is driven by **counting the player's kills**, not by firing effects on kill.
Adding a reactive `onKill` bus hook would be over-engineering — nothing would consume
it, since the jokers use counters, not effects. Instead the sim exposes a
`BattleResult.kills: {left,right}` tally. Simpler, cleaner, no listener side-effects.

- **Cadence:** scaling wants *rare, meaningful* events. Frequent triggers (a hit)
  hit their cap in one battle → no growth arc. Kills are rare and earned → the right
  cadence for a Balatro-style curve. All three jokers scale on kills, differentiated
  by *what stat they grow*.
- **Killer-side semantics:** the tally increments only where the victim is an ENEMY
  of the killer — the direct-hit death site (killer = attacker) and the DoT-tick
  death site (killer = the poisoner = the victim's opposite side). It does NOT count
  recoil self-kills or fatigue deaths (no enemy killer). Friendly fire is
  structurally impossible (`effects.ts` guards), so a counted kill is always an enemy
  going down — no self-scaling exploit. `kills.left` (enemies the player killed)
  drives the player jokers.

### Jokers stack (the "joker synergy" feel)

All three jokers scale on kills, so a single kill grows every held joker at once.
Holding two scalers compounds a kill-focused board — this *is* the Balatro joker-combo
dopamine, and it emerges from the shared trigger with no extra machinery.

### Starter set (3 jokers)

| id | name | grows (per kill) | cap | build it pushes |
|----|------|------------------|-----|-----------------|
| `fame-vorace` | Fame Vorace | `+2 attack` | +20 | pure aggro / snowball |
| `collezionista-anime` | Collezionista di Anime | `+8 maxHp` | +80 | aggro-bruiser (survivable snowball) |
| `marchio-vorace` | Marchio Vorace | `+3% veleno damage` | +45% | **aggro + DoT combo** (kill → poison hits harder) |

`marchio-vorace` is the explicit cross-keyword combo: it only pays off if you *also*
run a veleno build, welding two archetypes into one payoff. Per-kill increments and
caps are **starting values** — final tuning is gated on the balance harness + playtest.

### Data-driven scaling primitive

Add a dedicated `scaling` descriptor to `Relic` (its own concept, kept out of the
trigger/bus system) so future jokers are pure data, matching the codebase's
data-driven grain (events, relics):

```ts
// types/relic.ts — on Relic
scaling?: {
  trigger: 'kill'                            // extensible; only kills for now
  stat: 'attack' | 'maxHp' | 'velenoMult'    // extensible union
  per: number      // bonus added per counter unit
  cap: number      // max cumulative bonus (bonus = min(runCounter * per, cap))
}
```

`ActiveRelic` gains one mutable counter:

```ts
// types/relic.ts — on ActiveRelic
runCounter?: number   // cumulative kills this run; undefined == 0
```

One counter per `ActiveRelic` is sufficient (each joker has exactly one `scaling` spec).
`attack`/`maxHp` are read in `applyRelicBonuses`; `velenoMult` in `keywordDamageMult`.

### Persistence architecture (the key integration)

The combat sim is pure and its `EventBus` is created per-battle and discarded, so the
counter **cannot** live inside the sim. Flow:

1. During a battle, the sim increments a per-side kill tally at the enemy-kill sites
   and returns it as `BattleResult.kills: {left,right}`.
2. The **combat resolver** (`game/engine/resolvers/combat.ts`) adds `kills.left` to
   `RunState.relics[i].runCounter` for every relic with a `scaling` descriptor.
3. Stat calculation reads the *effective* bonus from the counter:
   `min((runCounter ?? 0) * per, cap)`, folded into `applyRelicBonuses` (attack/maxHp)
   and `keywordDamageMult` (velenoMult) in `game/engine/relics.ts`.

Because the counter lives on `RunState.relics`, it persists across battles within a
run and is discarded when a new `RunState` is constructed → automatic reset. Nothing
touches `MetaProfile`.

## Architecture / files touched

- `types/combat.ts` — add `kills: {left,right}` to `BattleResult`.
- `types/relic.ts` — add `scaling` to `Relic`; add `runCounter` to `ActiveRelic`.
- `game/engine/combat/simulate.ts` — increment the per-side kill tally at the
  direct-hit and DoT-tick death sites (enemy kills only); return `kills`.
- `game/engine/relics.ts` — `scalingStatBonus` helper folded into `applyRelicBonuses`
  (attack/maxHp) and `keywordDamageMult` (velenoMult); `applyRelicScaling(relics,
  killDelta)`; exclude `SCALING_RELIC_IDS` from `selectEnemyRelics`.
- `game/engine/resolvers/combat.ts` — `applyRelicScaling(state.relics, kills.left)`
  in the resolve spread.
- `data/relics.ts` — define the 3 jokers; export `SCALING_RELIC_IDS`.
- `data/unlocks.ts` — add the 3 joker ids to `STARTER_RELICS` (available from run 1).

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
