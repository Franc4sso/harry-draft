# Battle Premium — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Goal

Fix the concrete layout problems on the battle screen and lift the whole thing to a
**premium "grimorio" aesthetic** (gold on near-black violet, frosted glass, soft glow).
All presentational — **no engine/data changes.**

### The list (verbatim intent)
1. **Desktop: the initiative order is clipped on the side** — fix the container so faces +
   names + spd are never cut.
2. **Remove the status legend**; put a **damage recap for BOTH teams** (mine and enemy) in
   the side column instead.
3. **Cards: stats are squashed together** — give them room; make the UI genuinely
   appealing.
4. **Enemy synergies should sit near the enemies** (enemies are on the bottom now).
5. **Character portraits a touch smaller.**
6. **The action box is unclear** — make it bigger and narrative.
7. **Make it premium** — luxurious arcane look.

---

## Design system — "Grimorio Premium"

A small token set, applied across the battle components (Tailwind classes + a few inline
vars; no new dependency).

**Color**
- `ink` `#0B0814` (deep violet-black, page/arena base)
- `ink-2` `#141021` (panels)
- `gold` `#C9A24B`, `gold-bright` `#F0D98A` (noble accents, hairline borders, headers)
- `ally` `#5BD6A0` (emerald — player), `enemy` `#E5616B` (ruby — enemy)
- `glass` `rgba(20,16,33,0.55)` + `backdrop-blur` (frosted panels)

**Type** — reuse existing `font-display` (elegant) for titles + spell names, body for
labels, `tabular-nums` for all numbers (stats, damage). Display used with restraint.

**Signature** — the **central action box** rendered as "a spell being cast": both
combatants in slim gold-rimmed frames, the spell name in display, an animated arrow/beam
between them, and the outcome in a large colored token (DANNO 30 / CURA 20 / PARATO /
SCHIVATO) plus one plain Italian sentence ("Harry colpisce Draco con Expelliarmus: 30
danni"). This is the one memorable element; everything around it stays quiet.

Premium polish elsewhere is restrained: hairline gold borders on glass panels, soft inner
glow, consistent radius, generous spacing. No runes/gems/particle storms (that was the
declined "mistico estremo").

---

## Part 1 — Fix the clipped initiative rail (desktop)

Root cause: the rail is `w-20` inside a `lg:grid-cols-[5rem_…]` (80px) column with
horizontal content (face + name + spd) that exceeds it, so it visually clips. Fixes:
- Widen the grid's first column from `5rem` to `7rem` and the rail to fit (`w-full`), and
  ensure the rail's items don't overflow: name truncates, the row is `min-w-0`.
- The rail keeps vertical scroll (`overflow-y-auto`) but must NOT clip horizontally — remove
  any `overflow-x` clipping; let it use the full column width.
- Each slot: face (smaller, see Part 5) + name (truncate) + spd, with the green/red side
  ring intact. Verify nothing is cut at the standard desktop widths.

---

## Part 2 — Remove the legend, add dual-team damage recap in the side column

- Delete `StatusLegend` from the battle screen (both the desktop side mount and the
  below-lg mount). The component file may remain unused or be removed; the plan removes its
  usage and its test if it becomes dead.
- In the right side column, render **two stacked `BattleRecap` panels**: "I tuoi danni"
  (`side="left"`, ally accent) on top and "Danni nemici" (`side="right"`, enemy accent)
  below. `BattleRecap` already supports `side`; it gains an optional `title` and `tone`
  (`'ally' | 'enemy'`) for the header + accent.
- The existing single `BattleRecap` that sits below the arena is **removed** (its content
  now lives in the side column, doubled). On narrow screens the two recaps stack below the
  arena (the side column collapses under the existing responsive rule).

---

## Part 3 — Roomy, premium cards (stats with breathing room)

`UnitBust` currently stacks three `StatBar`s tightly under a small HP bar. Rework for
clarity + premium feel:
- **Portrait slightly smaller** (Part 5) frees vertical space for stats.
- Stat block gets real spacing: each `StatBar` on its own line with comfortable `gap`,
  larger value text (`text-xs`→ readable), the label (ATT/DIF/VEL) clearly separated from
  the bar, and the bar a touch taller with a subtle gold-tinted track. Buff/debuff arrow +
  color preserved.
- The whole bust sits in a refined glass card: `ink-2`/glass background, hairline border
  tinted by side (ally green-gold / enemy red-gold), soft glow on the acting/targeted unit
  (existing aura, made more premium), consistent rounded corners.
- Keep role badge, status pills, control overlay (with turns), cooldown row, name. Just
  spaced and styled premium — nothing removed.

`StatBar` gets a small style pass (taller track, gold-tinted background, clearer value)
but its API (props) is unchanged so its tests stay valid.

---

## Part 4 — Synergies anchored to their team

Move the two `SynergyRibbon`s out of the single top row:
- **Player synergies** render **above the player row** (top of the arena column).
- **Enemy synergies** render **below the enemy row** (bottom of the arena column).
- Each keeps its title + tone (ally/enemy) from prior work. This makes ownership obvious:
  your buffs hug your team, theirs hug theirs.

This is a placement change in the arena column (BattleScreen), not a `SynergyRibbon` API
change.

---

## Part 5 — Smaller portraits

- Battle bust portrait: reduce the bust width one step (`w-32 sm:w-36` → `w-28 sm:w-32`)
  and/or reduce the portrait's share of the card so stats get room. Keep the rarity frame.
- Initiative face: smaller round crop (e.g. `h-8 w-8`), still with the side ring.
- ActionPanel combatant portraits: sized for the new narrative box (Part 6), framed in gold.

---

## Part 6 — Narrative action box (the signature)

Rework `ActionPanel` into the premium centerpiece:
- Two gold-rimmed combatant frames (attacker left/top, target right/bottom), each with name.
- The **spell name** in `font-display`, centered, with a small type tag (Attacco / Cura /
  Controllo / Difesa) derived from the entry.
- An **animated connector** (beam/arrow) between attacker and target, direction following
  the actor side; reduced-motion → static.
- The **outcome** as a large colored token: `DANNO 30` (rose), `CRITICO 48` (gold),
  `CURA 20` (emerald), `PARATO` (sky), `SCHIVATO` (muted). Plus one plain Italian sentence
  under it: e.g. "Harry colpisce Draco con Expelliarmus: 30 danni" / "Hermione cura Ron:
  +20" / "Draco para l'attacco". The sentence reuses/extends the existing `describeEntry`
  logic so copy stays consistent with the log.
- Degraded states (system frame, no target, null) keep a calm premium placeholder.

ActionPanel stays the arena `center` node (between the rows). Its glass panel gets the
gold-hairline premium treatment.

---

## Part 7 — Premium pass (restrained)

- Arena backdrop (existing `ArenaBackdrop`) retuned to the gold/violet palette — a slow,
  low-opacity living glow; static under reduced motion.
- Glass panels (recap, action box, ribbons, rail) share one premium treatment: `glass`
  bg + `backdrop-blur` + hairline gold border + consistent radius + soft shadow.
- Buttons/controls get a subtle gold-accent hover. Header title in display with a hairline
  gold underline accent.
- Everything transform/opacity-only, reduced-motion respected, keyboard focus visible.
  One bold thing (the action box); everything else quiet.

---

## Components touched

| File | Change |
|---|---|
| `components/screens/BattleScreen.tsx` | grid sizing fix; synergies anchored top/bottom; legend→dual recap side column; remove bottom recap; premium shell |
| `components/battle/InitiativeBar.tsx` | fit the wider column, no clip; smaller face |
| `components/battle/BattleRecap.tsx` | `title` + `tone` props; premium styling |
| `components/battle/UnitBust.tsx` | roomy stats; smaller portrait; premium card |
| `components/battle/StatBar.tsx` | taller/clearer premium bar (API unchanged) |
| `components/battle/ActionPanel.tsx` | narrative premium action box + outcome token + sentence |
| `components/battle/ArenaBackdrop.tsx` | retune to gold/violet palette |
| `components/battle/StatusLegend.tsx` | usage removed (component may be deleted if dead) |

## Testing

- `BattleScreen`: no `StatusLegend` rendered; two recaps present ("I tuoi danni" + "Danni
  nemici"); player synergies above player row, enemy below enemy row; no "azione" counter
  (kept). Update the prior legend/ribbon-placement assertions.
- `InitiativeBar`: faces + side rings render; container does not constrain content width
  (assert the rail uses `w-full`/no `overflow-x-hidden`); smaller face size.
- `BattleRecap`: renders the title + tone; both sides compute correctly (reuse
  `recapTotals`).
- `ActionPanel`: renders the spell name, an outcome token with the right tone, and a plain
  sentence for damage/heal/block/dodge; degraded states render the placeholder.
- `StatBar`: existing tests still pass (API unchanged); add one for the premium track if a
  new data hook is introduced.
- `ArenaBackdrop`: still aria-hidden + reduced-motion static.
- Visual: `npm run build` succeeds; manual desktop check that nothing clips.

## Non-goals

- No engine/data/balance changes. No new statuses/synergies/spells.
- No "mistico estremo" (runes/gems/particle storms). One signature element only.
- No enemy relics (engine invariant; relics stay under the player synergies).
