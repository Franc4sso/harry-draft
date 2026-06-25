# Battle Clarity II — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Goal

Five targeted improvements to the battle screen, building on the 5↑/5↓ overhaul:

1. **Center action panel** — the "who hits whom" panel moves into the gap between the
   enemy row (top) and the player row (bottom), replacing the bare "VS".
2. **More room for busts + info** — enlarge each `UnitBust` so stats/traits/statuses read
   clearly.
3. **Per-archetype spell animations** — activate the existing 8 archetypes (each with a
   distinct shape), and give heal its own animation (currently it renders nothing).
4. **Clear control effects** — stunned/frozen/silenced wizards get a visible on-bust
   overlay, an explicit log line, and an accessible status legend.
5. **Live damage/heal recap** — an always-visible panel below the arena ranking the
   player team by damage dealt + healing done, updating as the replay plays.

Scope: battle screen UI only. **No engine changes** — the recap is derived from the
existing replay log; animations and layout are presentational.

---

## Part 1 — Center action panel

Today `ActionPanel` renders *below* `BattleArena` (BattleScreen.tsx:58), and `BattleArena`
shows a bare "VS" divider between the two rows (BattleArena.tsx, the `font-display ... VS`
div). We move the action readout into that center slot.

- `BattleArena` accepts an optional `center?: React.ReactNode` prop and renders it where
  the "VS" currently sits (between `row-enemies` and `row-player`). When `center` is
  absent it falls back to the current "VS" text (keeps existing tests/other callers safe).
- `BattleScreen` passes `<ActionPanel … />` as `center` and **removes** the separate
  `ActionPanel` line below the arena.
- The action panel stays **compact** (chosen): attacker portrait → spell name → arrow →
  target portrait → result (damage/heal/blocked), one horizontal strip. No status-applied
  details (that was the "rich" option, declined). ActionPanel already renders this; we
  only verify it fits a centered horizontal band and tighten spacing if needed.

The projectile layer is unaffected: `SpellFx` is still rendered inside `BattleArena` over
the whole arena box, and bust positions are still DOM-measured — the center node sits
between the rows and does not change bust geometry.

---

## Part 2 — More room for busts + info

`UnitBust` is currently `w-28 sm:w-32`. Enlarge to `w-32 sm:w-36` and bump the internal
text scales one step where they're cramped (name, stat row, cooldown row, status pills)
so the extra width is used for legibility, not just whitespace. The 5-in-a-row
`flex-nowrap` must still fit at common desktop widths (5 × ~144px + gaps ≈ 780px, within
the `max-w-3xl`/arena width); on narrow mobile the row may scroll horizontally — acceptable
and already the case. Keep the rarity frame / portrait aspect ratio.

No behavioral change; this is sizing/typography. Existing bust tests assert content, not
exact widths, so they remain green; if any asserts a specific class width, update it.

---

## Part 3 — Per-archetype spell animations

`lib/spellArchetype.ts` already classifies every entry into one of 8 archetypes
(beam/curse/fire/dark/shield/heal/stun/disarm) each carrying a `shape`
(bolt/orb/wave/burst) and colors. **`SpellFx` ignores `shape`** — it always renders one
flat oval. And heal returns `null` (only a green float shows).

Rework `SpellFx` to render a shape-specific projectile/effect:

- **bolt** (beam, curse, disarm): elongated streak flying caster→target (close to today's
  oval but sharper, with a motion trail).
- **orb** (dark): a round charged sphere that travels and pulses.
- **burst** (fire, stun): travels then **bursts** at the target (quick scale-up + fade ring).
- **wave** (shield): handled by `ShieldFx` already — `SpellFx` continues to skip `shield`.
- **heal** (NEW): no projectile from a caster; instead a **rising sparkle** anchored on the
  *target* — green motes drift upward with a soft glow. This is the "cura" animation the
  user asked for, distinct from any attack.

Implementation stays transform/opacity-only (mobile-cheap), keyed on the frame so each
action re-triggers. `SpellFx` gains the target point for heal anchoring (already passed as
`to`). Each rendered effect carries `data-archetype` (already) and a new `data-shape`
attribute for testing.

Reduced-motion: each effect degrades to a static final-state frame (as today).

---

## Part 4 — Clear control effects (stun/freeze/silence/disarm)

Three layers, all presentational:

1. **On-bust overlay** — when a unit has an active control status this frame, draw a
   clear overlay on the bust: chains/lock tint for stun, an ice sheen for freeze, a muted
   "silenced" mark for silence, crossed-swords tint for disarm. This is *in addition* to
   the existing top-corner status pill, so a skipped turn is obvious at a glance. Derived
   from the frame's `statusEffects[unitKey]` (already available in `BattleArena`).
2. **Explicit log line** — `BattleLog.describeEntry` already emits
   "X è stordito e salta il turno" for stun. Extend so freeze/silence/disarm also read
   explicitly ("X è congelato e salta il turno", "X è silenziato: niente incantesimi",
   "X è disarmato: niente attacchi") whenever the engine logs a skipped/blocked action.
   (Engine already logs the skip as a 'Stordito'/system action; we widen the copy mapping
   by the unit's active control status — no engine change.)
3. **Status legend** — a small dismissible/toggle "Legenda" affordance on the battle
   screen listing each status with its icon, color, and one-line effect (Italian), so a
   new player can learn what every pill/overlay means. Reuses the status metadata in
   `data/statuses.ts` (name) plus a short effect blurb.

---

## Part 5 — Live damage/heal recap panel

A new component `BattleRecap` rendered below the arena (always visible, chosen).

- **Data**: derived purely from `replay.frames.slice(1, index+1)`. For each frame's
  `entry`, attribute `entry.value` to `entry.actorId`/`actorSide`:
  - damage dealt: entries that are damage (not heal, not dot self-tick, not dodge/0).
  - healing done: entries with the `heal` flag / `Cura` type.
  - DoT ticks log against the *victim* as actor (self-target); exclude these from
    "damage dealt" so a poisoned unit isn't credited for hurting itself. (Filter: dot
    ticks have `actorId === targetId`.)
- **Shape**: a small per-unit helper `recapTotals(frames, upToIndex)` →
  `Array<{ key, name, side, dealt, healed }>` for the **player** team, sorted by
  `dealt + healed` descending. Unit-tested.
- **Render**: compact rows (portrait/name + a damage bar in rose and a heal bar in
  emerald, scaled to the team's current max), updating live as `index` advances. The
  top row is implicitly the current MVP. Header: "Resoconto squadra".
- Enemy totals are out of scope (the panel is "chi sono i più forti del *team*").

---

## Components touched

| File | Change |
|---|---|
| `components/battle/BattleArena.tsx` | `center` prop in the divider slot; control overlays on busts |
| `components/screens/BattleScreen.tsx` | pass ActionPanel as `center`; remove bottom ActionPanel; render legend + `BattleRecap` |
| `components/battle/UnitBust.tsx` | larger size + control overlay rendering |
| `components/battle/SpellFx.tsx` | shape-specific animations + heal sparkle |
| `components/battle/BattleLog.tsx` | explicit freeze/silence/disarm log copy |
| `components/battle/BattleRecap.tsx` | NEW — live recap panel |
| `lib/battleRecap.ts` | NEW — `recapTotals` pure helper |
| `components/battle/StatusLegend.tsx` | NEW — status legend |

## Testing

- `lib/battleRecap.ts`: unit tests for `recapTotals` — damage/heal attribution, DoT-self
  exclusion, sorting, partial-index (live) totals.
- `SpellFx`: each archetype renders its `data-shape`; heal renders the sparkle (target-
  anchored, no caster projectile); reduced-motion degrades.
- `BattleArena`: `center` prop renders in the divider slot; control overlay appears for a
  stunned/frozen unit's frame.
- `BattleLog`: freeze/silence/disarm produce explicit Italian copy.
- `BattleRecap`: renders sorted player rows; top row = highest combined.
- `StatusLegend`: lists each status with name + effect.
- Update any bust test that pins exact width classes.

## Non-goals

- No engine/data changes. No new statuses or balance edits.
- No enemy recap. No "rich" center panel (status-applied details) — compact only.
