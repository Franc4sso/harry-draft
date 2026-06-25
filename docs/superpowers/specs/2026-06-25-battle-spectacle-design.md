# Battle Spectacle — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Goal

Make the battle screen dramatically clearer and more spectacular. A focused list of
layout/identity/legibility fixes plus a "spinto ma sicuro" visual pass. **All presentational
— no engine/data changes.**

### The list (verbatim from the user)
1. **My team on TOP, enemies on BOTTOM** (invert the current 5↑enemies/5↓player).
2. **Expanded cards** — make stats big and clear (ATK/DEF/SPD with bars).
3. **Status legend on the SIDE** (not below).
4. **Stun/control overlay shows the turn count** ("Stordito · 2t").
5. **Synergies & relics: separate MINE vs ENEMY** with clear headers — don't pile them up.
6. **Initiative order VERTICAL**, on the LEFT of the arena.
7. **Initiative shows FACES + a mine/enemy indicator** (green = mine, red = enemy).
8. **Remove the action counter** in the header ("azione N/M").
9. **Make it spectacular** — animated arena backdrop, richer impacts (hit flash + shake,
   crit jolt), dynamic auras, polished transitions. Transform/opacity-only,
   reduced-motion safe, no regressions.

---

## Part 1 — Invert teams (my team top, enemies bottom)

`BattleArena` currently renders the `right` (enemy) units in `row-enemies` on top and
`left` (player) units in `row-player` below, with the `center` slot between. Invert: the
**player (`left`) row goes on top**, the enemy (`right`) row on bottom. The `data-testid`
attributes keep their meaning (`row-player` is the player's units, `row-enemies` the
enemies); only their vertical order swaps. The center slot stays between them.

Projectiles: unaffected (DOM-measured). Action-focus dim logic unaffected. The team title
labels (`leftTitle`/`rightTitle`) move with their rows — player title on top, enemy on bottom.

The damage/heal floats, control overlays, and the `mirrored` styling on enemy busts are
unchanged; only row order swaps.

---

## Part 2 — Expanded cards with stat bars

The user asked twice for bigger/clearer stats. Replace the single cramped stat row in
`UnitBust` (the `atk · def · spd` line) with three **labeled stat bars**:

- Each stat (ATT, DIF, VEL) gets: an icon, the numeric value (larger, `text-xs`+), and a
  thin horizontal bar whose fill is proportional to the value against a per-stat reference
  max (`STAT_REF = { atk: 60, def: 60, spd: 60 }`, clamped to 100%). Color per stat
  (atk rose, def sky, spd amber).
- Buff/debuff direction keeps the existing up/down coloring (green when buffed above base,
  red when below) plus a small ▲/▼ glyph; the bar tints accordingly.
- This makes the bust taller. Keep width `w-32 sm:w-36` (from prior work). The control
  overlay box still tracks the portrait `aspect-[3/4]` (unchanged).

The role badge, traits affordance (existing), cooldown row, HP bar, status pills all stay.
A small `StatBar` sub-component (local to UnitBust or a tiny `components/battle/StatBar`
helper) renders one bar; unit-tested for fill % and buff tint.

---

## Part 3 — Status legend on the side

Today `StatusLegend` renders below the arena (in BattleScreen's vertical stack). Move it to
a **side column** (right side, opposite the initiative bar on the left). It becomes a
vertical, always-readable panel (still collapsible, default open on desktop). On narrow
screens it falls back to below the arena (the side columns collapse). Implementation: the
battle screen body becomes a 3-column grid on `lg`: `[initiative | arena+center | legend]`;
below `lg` it stacks. `StatusLegend` itself only needs a `vertical`/side-friendly layout
variant (single column list).

---

## Part 4 — Control overlay shows turns

The full-bust control overlay (`UnitBust`, `CONTROL_OVERLAY`) currently shows just the
label ("Stordito"). Add the remaining turns from the matching `ActiveEffect.remaining`:
"Stordito · 2t" (use the existing `turnsLabel` → "2 turni", but compact "·2t" form for the
overlay badge to save space; the full tooltip already says the long form). The number comes
from the same `ctrl` effect already found (`ctrl.remaining`).

---

## Part 5 — Separate mine vs enemy synergies/relics

Today BattleScreen renders two `SynergyRibbon`s in one flex row (player left-aligned, enemy
right-aligned) so they visually merge into one pile. Make the split explicit:

- Each ribbon gets a small **header label**: "Le tue sinergie" (player) and
  "Sinergie nemiche" (enemy), and a side accent (player = green/gold accent, enemy = red
  accent) so a glance distinguishes them.
- Relics only ever belong to the player (engine invariant) → they appear only under the
  player header, visually grouped, never mixed with enemy synergies.
- Layout: the player ribbon sits with the player's row (top), the enemy ribbon with the
  enemy row (bottom), OR both stay in the header band but clearly separated into two
  labeled groups with a divider. Chosen: **two labeled groups in the header band**, player
  group left with green accent + relics, enemy group right with red accent. A vertical
  divider between them. This keeps them in one place but unmistakably separate.

`SynergyRibbon` gains an optional `title` and `tone: 'ally' | 'enemy'` prop driving the
accent color + header.

---

## Part 6 & 7 — Vertical initiative bar with faces + side identity

Rewrite `InitiativeBar` from a horizontal crest rail into a **vertical column on the left**:

- Top-to-bottom in speed order (fastest first), alive units only (current behavior).
- Each slot shows the unit's **face** (`PortraitImage` `variant="bust"`, small round/!square
  crop) instead of the house crest, the name, and the spd value with a ⚡ icon.
- A **side indicator**: green ring/border + a small "▲ tuo" tag for player (`left`) units,
  red ring + "▼ avv." for enemy (`right`) units. So you can tell whose turn is coming.
- The unit acting **now** is enlarged + highlighted in place (keep current "Ora" label).
- Column scrolls vertically if tall; fixed narrow width (~`w-20`).

The bar consumes the same `replay` + `index` it already does; `ReplayUnit` already carries
`id`, `house`, `side`, `name`, `spd` — enough for faces + side. No new data.

---

## Part 8 — Remove the action counter

In `BattleScreen` header, the line `Turno N · azione I/M · agisce X` includes "azione
I/M". Remove the "· azione {r.index}/{r.total - 1}" segment. Keep the turn number and the
"agisce <name>" actor cue (those are useful). The header becomes "Turno N · agisce X".

---

## Part 9 — Spectacle (spinto ma sicuro)

Transform/opacity-only, all degrade under `useReducedMotion()`, no test regressions:

1. **Animated arena backdrop** — a subtle living gradient / drifting magical motes behind
   the busts (a low-opacity absolutely-positioned layer in `BattleArena`, `pointer-events-none`,
   `aria-hidden`). House-neutral palette so it doesn't fight the busts. Pure CSS/transform
   animation; static under reduced-motion.
2. **Richer impacts** — on a landed hit, the *target bust* flashes (quick white/red overlay
   pulse) and shakes (small x/y jitter); a **critical** hit gets a stronger jolt + a golden
   ring burst. Driven by the existing frame `entry` flags (`crit`, `kill`) — no new state.
   This replaces nothing; it augments the existing float + hp-drop. Capped so it stays one
   clear gesture, not noise.
3. **Dynamic auras** — the acting unit's green aura and the targeted unit's red aura
   (already present) get a soft pulse; the current-initiative face pulses gently.
4. **Polished transitions** — the center action panel content cross-fades between actions;
   KO busts fade to grayscale with a brief darken (augment existing tombstone).

All effects live in existing components (`BattleArena`, `UnitBust`) behind reduced-motion
guards. New animated backdrop is one isolated component `components/battle/ArenaBackdrop.tsx`.

---

## Components touched

| File | Change |
|---|---|
| `components/battle/BattleArena.tsx` | invert rows; mount ArenaBackdrop; impact flash/shake hook |
| `components/battle/ArenaBackdrop.tsx` | NEW — animated backdrop layer |
| `components/battle/UnitBust.tsx` | stat bars; control overlay turns; impact flash/shake; aura pulse |
| `components/battle/StatBar.tsx` | NEW — one labeled stat bar (or local helper) |
| `components/battle/InitiativeBar.tsx` | vertical + faces + side identity |
| `components/battle/StatusLegend.tsx` | side/vertical layout variant |
| `components/battle/SynergyRibbon.tsx` | `title` + `tone` (ally/enemy) header + accent |
| `components/screens/BattleScreen.tsx` | 3-col grid (initiative | arena | legend); labeled ribbons; remove action counter |

## Testing

- `BattleArena`: player row precedes enemy row in the DOM now (invert the existing
  `row-player`/`row-enemies` order assertion). Center slot still renders.
- `StatBar`: fill % clamps to 100; buff tint up/down.
- `UnitBust`: stat bars render with values; control overlay shows "·2t"; impact/aura are
  reduced-motion-guarded (assert static under reduced motion if feasible, else smoke).
- `InitiativeBar`: renders faces (PortraitImage / img alt) and a side indicator per unit;
  current unit enlarged; vertical container.
- `StatusLegend`: side variant lists statuses.
- `SynergyRibbon`: renders the title + tone accent; ally ribbon includes relics, enemy
  ribbon never does.
- `BattleScreen`: header no longer contains "azione"; renders both labeled ribbons,
  initiative, legend. Update existing header/screen assertions.
- `ArenaBackdrop`: renders an aria-hidden decorative layer; static under reduced motion.

## Non-goals

- No engine/data/balance changes. No new statuses, synergies, or spells.
- No "massimo rischio" effects (global screen shake, slow-mo, particle KO explosions) — the
  user chose "spinto ma sicuro".
- No enemy relics (engine invariant).
