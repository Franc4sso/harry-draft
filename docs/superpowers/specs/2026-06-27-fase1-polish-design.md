# Fase 1 Polish — Design Spec

**Date:** 2026-06-27
**Branch base:** `master` (run-progression Fase 1 merged at `f28bf66`)
**Status:** Approved design, pending spec review

## Purpose

The roguelite run loop (Fase 1) is merged and working, but playtesting surfaced
eight issues spanning combat correctness, run flow, map navigation, and UI
visibility. This spec batches them into one polish pass. Combat correctness
(cooldown, Protego) and information visibility (levels, persistent team panel)
are the priorities; a visual restyle of three screens follows.

## Scope

In scope: the eight items below (A–F). Out of scope: Fase 2+ (shop/event/common
room, galleoni, library, theming).

---

## A · Combat

### A1. Cooldown means WAIT, not basic attack

**Current:** `game/engine/combat/selectSpell.ts:8` — when a unit's spell is on
cooldown, `selectSpell` returns `base_attack`. So a recharging wizard keeps
chip-attacking every turn.

**Target:** A wizard whose spell is on cooldown does **nothing** that turn (it
"waits" for the spell to recharge). `base_attack` remains the fallback ONLY when
the unit *cannot cast its spell at all* this turn for another reason (e.g.
`silence`, disarm) — i.e. `canCastSpell(unit) === false` but the spell is not
merely on cooldown.

**Mechanic:**
- Introduce a `WAIT` action (a no-op turn). `selectSpell` returns a sentinel
  (e.g. `null` / a `wait` pseudo-spell) when the spell is purely cooldown-gated.
- `simulate.ts` skips the action when `WAIT` is selected: the unit consumes its
  turn, cooldown ticks down, statuses/DoT still resolve, but no attack lands.
- A unit at full readiness (cooldown 0) casts its spell as today.

**Balance (critical):** If every wizard idles during cooldown, fights slow down
and risk hitting the turn cap (stalemate). Mitigation:
- Re-tune spell cooldowns DOWN in `data/spells.ts` so wizards act often enough.
  Guideline: most offensive/control spells land in the 0–2 range; only the
  heaviest nukes (Avada `avada`, Ardemonio `fiendfyre`) stay at 3. `base_attack`
  stays cooldown 0.
- Re-run the new-loop balance harness (`tests/engine/campaignBalanceB.test.ts`)
  and keep the win-rate band (0.15, 0.55).
- The restored **no-stalemate guard** (no battle reaches `BALANCE.combat.turnCap`
  on any of 120 seeds) MUST still pass. If it fails, lower cooldowns further or
  add a fatigue ramp; do not weaken the test.

### A2. Protego negates the next incoming spell

**Current:** `data/spells.ts:34-35` — `protego` and `protego_maxima` are plain
DEF buffs (`{kind:'buff', stat:'def', ...}`). They do not block spells.

**Target:** Protego applies a charge-based status that **fully negates the next
spell that would resolve on the protected unit**, then is consumed.

**Mechanic:**
- New status `protego` (in `data/statuses.ts`) carrying `charges` (default 1).
- New effect kind (e.g. `protego`/`wardNextSpell`) in
  `game/engine/combat/effects.ts` that pushes the status onto the target(s).
- In spell resolution (`game/engine/combat/resolve.ts`), BEFORE applying a
  spell's effects to a target: if the target has a `protego` status with
  `charges > 0`, the spell is **negated entirely** (no damage, no heal, no
  status/effect applied — it "misses"), decrement a charge, and emit a `block`
  flag for the UI/log. `base_attack` is NOT a spell for this purpose — Protego
  wards *spells*, not basic attacks (basic attacks are the cooldown-filler, and
  warding them would make Protego trivial). (If playtest says otherwise we can
  revisit, but default: spells only.)
- **Targeting:** Protego may protect **self or one ally**. The caster-side AI
  picks the most-threatened friendly unit (lowest current HP fraction; tie →
  highest ATK value), defaulting to self if it is the most threatened. Reuse the
  ally-target selection that healing spells already use.
- `protego` → 1 target (1 charge). `protego_maxima` → **2 targets**, each with 1
  charge (the two most-threatened allies; may include self).
- Negates ANY spell type (attack, control, debuff) — not only offensive ones.
- Other Difesa spells (`fianto`, `salvio`, `riddikulus`, `expecto`, `aegis`)
  keep their current buff/shield behavior.

### A3. Show wizard levels in battle (player + enemy)

**Current:** `level` exists on `DraftedWizard` but is never rendered. Enemies
have no `level` field; difficulty comes from `menace`.

**Target:** A "Lv. N" badge on each combat unit (`components/battle/UnitBust.tsx`)
and on roster/draft cards (`WizardCard`, `WizardCardRow`), for both sides.

**Enemy derived level:** enemies are not leveled, so display a derived level that
maps their `menace` stat-multiplier onto the player's growth curve:

```
enemyLevel = clamp(round(1 + menace / BALANCE.leveling.autoGrowthPct), 1, levelMax)
```

With `autoGrowthPct = 0.10`: menace +0.20 → Lv 3, +0.50 → Lv 6. The final boss
uses `finalBossMenace`. This is consistent — it answers "what player level has
the same stat boost." Compute it where the enemy team is built
(`resolvers/combat.ts`, which already knows `rightMenace`) and carry it on the
battle payload so `UnitBust` can show it. Player units show `dw.level`.

---

## B · Run start — no House, classic 2-of-5 draft

**Current:** `startRunB` → `HouseSelectScreen` (pick 1 of 4 houses) →
`StarterPickScreen` (pick 2 from that house). `state.house` is read only in
`resolvers/recruit.ts:13` to bias recruit offers.

**Target:** Remove house selection. The run opens with the **classic draft**:
show 5 wizards, the player picks one, the screen refreshes with 5 new wizards,
the player picks a second. After 2 picks the run proceeds to the map. This is the
**exact old draft mechanic**, retargeted from 5 picks to 2.

**Mechanic:**
- Restore the legacy draft engine from git history (pre-`0b0feb0`):
  `game/engine/draftSession.ts`, `hooks/useDraft.ts`,
  `components/screens/DraftScreen.tsx` (and their tests as a starting point).
  `game/engine/draft.ts` `generateScreen` (5 wizards, ≤1 low tier guarantee,
  tier-weighted draw) is the source of offers.
- Retarget: the run-start draft ends after **2** picks (a `targetPicks` of 2),
  not `teamSize` (5). The remaining 3 slots fill via in-run recruitment as today.
- New `RunPhase`/view `draft` replacing `house` + `starter`. `startRunB` starts
  in `draft`. `RunBRunner` renders `DraftScreen` for that phase; on the 2nd pick
  it transitions to `map` (generating area 0 with `teamSize = 2`).
- Remove `HouseSelectScreen`, `StarterPickScreen`, `selectHouse`, `backToHouse`,
  `confirmStarters`, `starterOffer` and the `house` phase.
- `state.house` becomes optional/unused for offers (kept on the type only if
  other code still reads it; otherwise removed).

**Recruit offers — no house bias:** `offerRecruits` drops the house guarantee and
house bias; offers become purely tier-weighted random over the un-recruited pool
(`offerSize` slots). Synergies still form naturally from whatever is picked.

---

## C · Map — usually two nearby options

**Current:** `game/engine/map.ts` edge wiring gives each node 1 guaranteed
outgoing edge plus a 2nd only on `rng.chance(0.5)`. Result: ~half of nodes offer
a single choice. `reachable()` simply returns `cur.next`.

**Target:** Slay-the-Spire / pokelike feel — a node usually offers **2 reachable
options**, and those options are the **two nearest nodes** (by column index) on
the next floor.

**Mechanic:**
- Replace step (c)'s coin flip: for each node, connect to the **two nearest
  next-floor nodes by column index** (e.g. for a node at column `i` with next
  floor of width `w`, link the next nodes whose columns are closest to `i`).
- When the next floor has only 1 node (entry→/→boss convergence), 1 edge is
  correct. Boss node keeps 0 outgoing edges.
- Preserve existing invariants: no orphan nodes (every next node has ≥1 incoming
  edge), no dead ends before the boss. The `mapWiring.test.ts` invariants must
  still pass; add an assertion that interior nodes typically have 2 outgoing
  edges where the next floor width allows.

---

## D · Persistent team + synergy panel

**Current:** `RunBRunner` only switches between full-screen views; no persistent
chrome. Team/synergies are shown ad-hoc on some screens, absent on Map / Recruit
/ Relic / LevelUp.

**Target:** A persistent `TeamSynergyBar` rendered by `RunBRunner` around the
active view, visible during Map, Recruit, Relic, LevelUp (and consistent in
battle). It shows each team member (portrait, name, **level**) and the active
synergies.

**Mechanic:**
- New `components/run/TeamSynergyBar.tsx` reusing `SquadPanel` (or a compact
  variant) + the synergy rendering used by `SynergyRibbon`/`TeamScreen`. Reads
  `run.team` and `run.activeSynergies` (and per-wizard `level`).
- `RunBRunner` wraps `renderView()` with the bar for the relevant phases. It is
  hidden during the opening `draft` (no team yet) and `win`/`defeat` result
  screens. In `battle`, the existing in-battle synergy display stays; the bar is
  suppressed there to avoid duplication (or shown compactly — decide in plan).
- Layout: fixed strip (top or bottom); does not scroll with view content.

---

## E · Visual restyle — Map, Relic, Recruit

**Current:** all three are minimal (emoji icons, flat borders, no portraits, no
previews). Rich primitives already exist: `PortraitImage`, `RarityFrame`,
`GlowPanel`, `Chip`, `Tooltip`, `HouseCrest`, `houseTheme`.

**Target:** A polished, intentional look consistent with the existing
gold/house-themed system. Direction (to be refined with browser mockups):
- **Map (challenge tree):** real node framing (type-colored frames/glow),
  reachable-node glow, current-node emphasis, optional reward/difficulty hint per
  node; clearer floor-to-floor flow than the current reversed flat columns.
- **Relic:** richer relic cards (rarity glow already in `RelicCard`), owned-vs-new
  grouping, and a hint of which synergies/effects a relic interacts with.
- **Recruit:** real portraits, tier/house chips, and a preview of how the pick
  changes team synergies; clearer "replace when full" affordance.

**Process:** This phase uses the brainstorming **visual companion**: produce 2–3
layout variants per screen in the browser, get approval, THEN implement with the
frontend-design skill. Runs LAST, after A–D land (levels + synergy panel change
what these screens display).

---

## F · Recruit rarity — verified, no change

Investigated: recruit offers derive rarity purely from `BALANCE.draft.tierWeights`
`{1:1, 2:3, 3:30, 4:66}` → **4% epic+legendary per card** (down 4× from the
pre-redesign 16%). The redesign goal is already met. **No change**, unless
playtest still feels too generous, in which case lower tier-1/2 weights further.

---

## Testing strategy

- **A1 cooldown:** unit test on `selectSpell` (cooldown → wait, not base_attack;
  silence → base_attack still). Balance harness + no-stalemate guard stay green.
- **A2 Protego:** unit tests in combat — a spell into a protego'd target is fully
  negated and consumes a charge; the *next* spell lands; `protego_maxima` covers
  2 targets; basic attacks are not warded.
- **A3 levels:** component test that `UnitBust` renders a level badge for player
  and enemy; engine test for the `enemyLevel` derivation formula.
- **B draft:** restore/adapt `draftSession.test.ts`; test the run-start draft
  ends after 2 picks and proceeds to map with a 2-wizard team; recruit offers
  have no house guarantee.
- **C map:** extend `mapWiring.test.ts` — interior nodes offer 2 edges where
  width allows, nearest-by-column, invariants (no orphan / no dead end) hold.
- **D panel:** test `TeamSynergyBar` shows members + levels + synergies; smoke
  test that it appears on Map/Recruit/Relic/LevelUp.
- **E visuals:** rendering/smoke tests per screen; visual judged via mockups.

## Implementation order

A (combat) → C (map) → B (run-start draft) → D (panel) → E (visuals last).
F is a no-op verification. Each area lands behind passing tests + tsc.
