# Combat readability — "si capisce tutto" — design

Date: 2026-06-24

## Goal

A battle the player can fully read: at every step they know **who acts → on
whom → what they do → with what result → who is next (and why)**. Plus each
wizard's stats (atk/def/spd) are always visible, with relic/synergy **buffs
shown as buffs** (color), not just a final number.

This is the follow-up to the wound-display fix (commit 8aba205, "Fix A").
Pacing model chosen with the user: **step-by-step clarity**, auto-advancing
with a short pause (~1.2s per action); play/pause/speed/skip stay.

All changes are **presentation-only**. The combat engine, run state, wound
persistence (`currentHp`), and RNG are untouched. The only data change is
adding fields to `ReplayUnit`.

## Section 1 — Stats always visible, buffs in color

Under every unit (`UnitBust`), a compact row: `⚔ atk · 🛡 def · ⚡ spd`
(lucide Sword/Shield/Zap, `text-[10px]`, `tabular-nums`), always visible.

Color per stat by comparing buffed vs base:
- **green** — buffed value > base (potenziata)
- **red** — buffed value < base (indebolita)
- **white** — equal (base)

No new computation: `BattleUnit` already carries `stats` (base) and
`buffedStats` (final, after synergy + relic). We project both to the UI.

Plumbing (fixed shape — do not vary): `ReplayUnit` gains six numeric fields:

```ts
atk: number; def: number; spd: number          // buffed (final) values
baseAtk: number; baseDef: number; baseSpd: number  // base values
```

Sourced from each `BattleUnit` when `buildReplay` constructs `units`:
`atk = u.buffedStats.atk`, `baseAtk = u.stats.atk`, etc. (`hp` stays as the
existing `maxHp` field; we do not add base/buffed hp here.)

## Section 2 — Action panel (the core)

Replace the thin `ActionBanner` with a prominent central **ActionPanel**
rendered each step, answering the five questions at a glance:

```
[mini-portrait] Hermione  ──⚡ Stupeficium──▶  [mini-portrait] Draco
                                               −24  (CRITICO!)
```

- **Attacker** (one side) and **target** (other side): mini-portrait + name.
- **Arrow** between them with the **spell name** above it.
- **Result** under the target, colored:
  - damage → red (`−N`)
  - heal → green (`+N`)
  - miss/dodge → dim grey ("Schivato")
  - crit → gold, larger ("CRITICO!")
  - shield/block → sky ("Bloccato")
- **Direction** follows the actor side (left→right or right→left), reusing the
  `fromMirrored` notion already in `SpellFx`.

The bust auras (green = acting, red = targeted) remain as reinforcement, but the
ActionPanel is the source of truth for what happened. `describeEntry`
(BattleLog) stays the basis for the text; the panel adds the attacker/target/
spell/result structure around it.

For non-attack / system entries (poison tick, KO narration, actorless effects)
the panel degrades gracefully: show the actor + effect + result, no arrow/target
when there isn't one.

## Section 3 — Initiative bar (who's next, and why)

`InitiativeBar` made explicit:
- First slot labelled **"Ora"**; the rest are the upcoming queue.
- Each crest gets the unit **name** (truncated) beneath it — identifiable
  without hover.
- A small `⚡spd` next to each so the order is self-explaining (the fast one
  acts first).
- The acting unit keeps its scale/glow emphasis (already present).

Data: `ReplayUnit` already gains spd in §1, so the bar can show it directly.

## Section 4 — Pacing

Default to auto-advance with a short readable pause (~1.2s per action). Tune the
default in `useBattleReplay` / `REPLAY_SPEEDS` — keep play/pause, the speed
cycle, step, and skip controls intact. No engine timing concept introduced; this
is purely the replay player's default cadence.

## Architecture / data flow

```
toBattleUnits → BattleUnit { stats (base), buffedStats (final), hp }
       │
       ▼
buildReplay → ReplayUnit { + atk/def/spd (buffed) + base atk/def/spd }
       │
       ├─ UnitBust        → colored stat row (green/red/white)        §1
       ├─ ActionPanel     → attacker →[spell]→ target + result        §2  (new, absorbs ActionBanner)
       ├─ InitiativeBar   → "Ora" + names + spd                       §3
       └─ useBattleReplay → short-pause auto-advance default          §4
```

Engine, run state, wound persistence, RNG: unchanged. Only UI components + new
`ReplayUnit` fields.

## Components touched

- `game/engine/combat/replay.ts` — extend `ReplayUnit` + populate from
  `BattleUnit` (base + buffed atk/def/spd).
- `components/battle/UnitBust.tsx` — stat row with buff coloring.
- `components/battle/BattleArena.tsx` — replace `ActionBanner` usage with
  `ActionPanel` (new component, can live in the same file or its own).
- `components/screens/BattleScreen.tsx` — wire the ActionPanel in place of the
  old banner.
- `components/battle/InitiativeBar.tsx` — names + spd + "Ora" label.
- `hooks/useBattleReplay.ts` — default pacing.

## Testing

- `replay.test.ts` — `ReplayUnit` carries base AND buffed atk/def/spd; a unit
  with a synergy/relic atk bonus exposes buffed ≠ base.
- `tests/ui/` — `UnitBust` renders the stat row and colors a buffed stat green,
  a debuffed stat red, a base stat white.
- `tests/ui/` — `ActionPanel` renders attacker name, spell name, target name,
  and a colored result for damage / heal / crit / dodge / block; degrades on
  actorless/system entries.
- `tests/ui/` — `InitiativeBar` shows unit names, spd, and an "Ora" label on the
  first slot.
- Full suite (415+) + production build stay green.

## Out of scope

- Between-battle healing / rest nodes (none exist; not requested).
- In-battle regen behavior (intended; a wounded unit may end a fight healthier —
  not a bug).
- Combat-engine balance or mechanics changes.

## Implementation order

Suggested split into reviewable chunks (each: TDD → verify in-app → commit):
1. §1 stats + buff coloring (smallest, high value, establishes ReplayUnit
   plumbing the others reuse).
2. §2 ActionPanel (the core).
3. §3 InitiativeBar.
4. §4 pacing tune.
