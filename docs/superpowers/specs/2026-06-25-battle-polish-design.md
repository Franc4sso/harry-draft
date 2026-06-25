# Battle Polish — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Goal

Fix one animation bug and apply six battle-screen refinements. All presentational —
**no engine/data changes.**

### The list
1. **BUG: framer-motion spring + multi-keyframe** — "Only two keyframes supported with
   spring" thrown by the impact-shake (`x: [0,-3,3,0]` on a spring transition).
2. **Move the replay controls** (Pausa/Passo/Salta/Continua) **above the arena**, just
   under the header.
3. **End-of-battle modal** — when a team is wiped, after the replay finishes, show a modal
   with the outcome and a single button, so the player doesn't have to hunt for "Continua".
4. **Initiative rail: remove the wizard name** (keep face + spd + side ring).
5. **Role badge: position it absolute over the portrait image**, not on the stat area.
6. **Remove the buff/debuff number pills** ("-20% +10") from the top of the bust; the stat
   change already reads from the stat bars (▲/▼ + color). Control statuses
   (stun/poison/shield/etc.) keep their icons.
7. **(Answered question, not a code change) Damage formula explanation** — documented here
   for reference; no implementation.

---

## Damage formula (reference — no code change)

From `game/engine/combat/effects.ts` + `data/constants.ts`:

```
base = ATK × spell.power − DEF_target × defenseK(0.5)
base = max(1, base)
if attacker.role === 'Attaccante': DEF_target is first reduced by 40% (armor pen)
× trait/relic modifiers (modifyOutgoingDamage / modifyIncomingDamage)
if crit (chance = 0.05 + 0.0015×SPD): × 1.6
```

Worked example — Sirius (ATK 48, Attaccante, trait Furia) casts Flipendo (power 1.1) on
Pansy (DEF ~12), crit:
- armor pen: Pansy DEF 12 → 7.2; ATK 48×1.1 − 7.2×0.5 = 52.8 − 3.6 = **49.2**
- Furia (more wounded → up to +60%): Sirius was low → ≈ **×1.5**
- crit: **×1.6**
- 49.2 × 1.5 × 1.6 ≈ **119** ✓

This is correct behavior — the big number comes from Furia stacking on the crit, not a bug.

---

## Part 1 — Fix the spring/keyframe crash

`UnitBust`'s root `motion.div` uses `transition={{ type: 'spring', stiffness: 360,
damping: 22 }}` while its `animate.x` is a multi-keyframe array during impact
(`[0,-3,3,0]` / `[0,-6,6,-3,0]`). Framer-motion's spring only supports two keyframes, so
the multi-frame shake throws.

Fix: **decouple the shake from the spring.** The scale/targeted-offset stay on the spring;
the impact shake moves to a dedicated `transition` per-property or to a separate wrapper
element animated with a `tween` (which supports keyframe arrays). Cleanest: give the root
`transition` a per-key override so `x` uses a short `tween` while the rest stays spring:

```tsx
transition={{
  type: 'spring', stiffness: 360, damping: 22,
  x: impact ? { type: 'tween', duration: isCrit ? 0.4 : 0.28, ease: 'easeOut' } : { type: 'spring', stiffness: 360, damping: 22 },
}}
```

So the shake (keyframe array) animates as a tween; the non-impact `x` (single value)
stays spring. Reduced-motion path already sets `animate={{}}` (no x), so no crash there.
Verify no "spring two frames" warning remains.

---

## Part 2 — Replay controls above the arena

Move the controls block (the Pausa/Passo/Salta/Continua buttons) from below the arena to
**directly under the header**, above the battle grid. It stays a centered row. Nothing
else about the controls changes; just the DOM position in `BattleScreen`.

---

## Part 3 — End-of-battle modal

When the replay finishes (`r.done`) AND the battle has a decisive winner, show a modal
overlay with the outcome and one action button:
- Player won → "Vittoria" + button "Continua".
- Player lost → "Sconfitta" + button "Vedi esito".
The button calls the existing `onFinish`. The modal appears **after the replay completes**
(respecting the animation — the player still watches the fight), not the instant the last
unit dies.

A small focused component `components/battle/BattleEndModal.tsx`:
- Props: `outcome: 'win' | 'loss'`, `onConfirm: () => void`.
- A centered glass/gold panel over a dimmed backdrop, `role="dialog"` + `aria-modal`,
  focus the button on mount, Esc / button → `onConfirm`. Reduced-motion safe.
- Premium look consistent with the rest (gold hairline, display title).

`BattleScreen` renders it when `r.done` (the existing inline "Continua/Vedi esito" button
that currently appears in the controls row is replaced by this modal; the controls row
keeps only the playback controls while `!r.done`). `outcome` derives from
`result.winner === 'left'`.

---

## Part 4 — Initiative rail without names

In `InitiativeBar`, remove the unit name element from each slot. Keep the face (with the
green/red side ring), the spd value with the ⚡ icon, and the ▲/▼ side glyph. The "Ora"
label on the current unit stays. This declutters the narrow rail (also helps the earlier
clipping).

---

## Part 5 — Role badge over the portrait

Currently the role badge sits `absolute bottom-14` (near the stat rows). Move it to sit
**over the portrait image** — top corner of the portrait (e.g. `top-1`, side per
`mirrored`), as a compact icon+label chip on a translucent backdrop so it reads against
the art. It must not overlap the control overlay's center label or the status icons (put
it on the opposite corner from the status pills, which are top-`right`/`left` mirrored —
so the role chip goes top-`left`/`right`). Keep the Tank "Prov." emphasis.

---

## Part 6 — Remove buff/debuff number pills

In `UnitBust`'s status-pill row, **stop rendering the buff/debuff stat pills** (the ones
showing "+10" / "-20%"). The stat bars already show the direction (▲ green up / ▼ red
down) and the live value, which is the clearer signal the user asked for.

Keep the pills for **control/over-time/shield** statuses (stun, freeze, silence, disarm,
dot/poison, regen, shield) — those convey turns/stacks the bars can't. Concretely: filter
the rendered `effects` to exclude `kind === 'buff'` and `kind === 'debuff'` from the pill
row. The control full-bust overlay (with turns) is unaffected.

The `magnitudeLabel`/`describeEffect` buff/debuff branches may become unused for the pill
row; keep them only if still referenced (e.g. tooltips) — otherwise the plan removes dead
code.

---

## Components touched

| File | Change |
|---|---|
| `components/battle/UnitBust.tsx` | fix spring/keyframe (Part 1); role badge over portrait (Part 5); drop buff/debuff pills (Part 6) |
| `components/screens/BattleScreen.tsx` | controls above arena (Part 2); render BattleEndModal (Part 3) |
| `components/battle/BattleEndModal.tsx` | NEW — outcome modal (Part 3) |
| `components/battle/InitiativeBar.tsx` | remove name (Part 4) |

## Testing

- `UnitBust`: no "spring two frames" — assert the impact case renders without throwing
  (render a targeted+float bust; it must not throw). Role badge present over the portrait
  (a `data-role-badge` hook positioned in the portrait area). Buff/debuff effects do NOT
  produce a pill; a control/dot effect still does.
- `BattleEndModal`: renders the outcome title + button; button calls `onConfirm`;
  `role="dialog"`.
- `BattleScreen`: controls appear above the arena (DOM order: header → controls → grid);
  when `r.done`, the modal renders with the right outcome; the inline duplicate
  Continua/Vedi-esito is gone from the controls row.
- `InitiativeBar`: the unit name is no longer rendered (assert the name text is absent),
  faces + spd remain.
- Full suite green (known playFlow/campaignRunner flakes pass isolated), tsc 0, build ok.

## Non-goals

- No engine/data/balance changes. The damage formula is documented, not modified.
- No change to which statuses exist or how control overlays work.
- No new "skip instantly on death" behavior — the modal waits for replay end.
