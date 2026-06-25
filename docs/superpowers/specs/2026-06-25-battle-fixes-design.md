# Battle Fixes — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Goal

Two engine bug fixes (no self-revive; don't waste control on already-controlled targets)
plus two UI/clarity fixes (initiative still clipped; surface failed attacks in the log).

---

## Fix 1 — Dead units can never be healed/revived (BUG, critical)

### Root cause (verified by reproduction)
- `game/engine/combat/effects.ts:50-61` — the `heal` handler does
  `target.hp = min(maxHp, hp + amount)` with **no `target.alive` guard**. Reproduction test
  confirmed: healing a dead unit (hp 0, alive false) set hp to 28.
- `game/engine/combat/targeting.ts:9-14` — `mostWounded` filters `u.hp < u.maxHp` only, so a
  dead unit (hp 0 < maxHp) qualifies as "most wounded". Reproduction confirmed it returns the
  dead unit.

A healer can thus end up healing a dead ally — or, via the `?? actor` fallback or a future
path, itself — bringing hp above 0. (Note: `sync` never flips `alive` back to true, but hp
goes positive, which both looks wrong and can interact with other checks.) The user's rule:
**absolutely no resurrection by healing.**

### Fix (defense in depth — two layers)
1. `mostWounded`: only consider **alive** wounded units → filter `u.alive && u.hp < u.maxHp`.
2. `heal` handler: if the target is dead (`!ctx.target.alive`), **no-op** — return `{ value: 0 }`
   without mutating hp and without pushing the `heal` flag. This is the hard guard so NO path
   (current or future) can revive.

Both layers are pure/deterministic (no RNG). The "Rennervate — Rianima e cura" spell is
treated like any heal: it will not revive a dead unit. A deliberate revive mechanic is
explicitly out of scope.

### Determinism caveat
This changes which unit a healer targets in some battles (dead allies no longer selected) and
makes dead-target heals no-ops. That shifts combat outcomes → `campaignBalance` and any
seed-pinned battle fixtures may move. Re-measure `campaignBalance` deterministically and
re-base its floor with documented margin if needed; update any seed-coupled battle test.

---

## Fix 2 — Don't re-apply control to an already-controlled enemy

### Root cause
`selectTarget` (`targeting.ts:40-59`) chooses targets purely by role/threat/wounded; it has no
knowledge of the chosen spell's effects, so two allies whose spells both stun will both target
the same enemy, wasting the second stun on a unit already stunned.

### Fix
When the actor's selected spell would apply a **control** status (stun / freeze / silence /
disarm), prefer enemies **not already under that same control family**:
- Add a helper `appliesControl(spell): Set<ControlKind>` deriving the control kinds a spell
  applies, from `normalizeSpell(spell)` (the `applyStatus` effects whose kind/statusId is a
  control). Control kinds: `stun`, `freeze`, `silence`, `disarm`.
- A unit "is already under control K" if it has an active status effect of kind K (or a
  statusId whose def kind is K).
- In target selection, when the spell applies control, filter the candidate enemy pool to those
  NOT already under ANY of the spell's control kinds; if that filtered pool is non-empty, select
  within it using the existing role logic; if it's empty (everyone already controlled), fall back
  to the unfiltered pool (still attack — just no better choice).
- Stun naturally becomes re-targetable once it expires (the status is gone → the enemy is no
  longer "already controlled"). No timer logic needed.

Threading: `selectTarget` gains the `spell` so it can branch. The call site
(`simulate.ts:166`) already has `spell` in scope. Deterministic (no RNG); the filter is applied
before the existing deterministic sort, so the rng stream is unchanged for non-control spells
and for the in-pool ordering.

### Determinism caveat
Same as Fix 1 — control-spell targeting changes can move outcomes; re-measure balance and update
seed-coupled fixtures.

---

## Fix 3 — Initiative rail still clipped at the side (UI)

### Root cause (to confirm during implementation)
The earlier fix made the rail `w-full`, but the rail lives in the grid's first column
(`lg:grid-cols-[7rem_1fr_13rem]` → 7rem ≈ 112px) and each slot lays the face + a text column
(spd + ▲/▼) in a row that can exceed 112px, OR an ancestor clips. Symptom: content cut on the
side.

### Fix
Make the rail fit its column without clipping:
- Widen the first grid column enough for the slot content (e.g. `8rem`), OR make each slot a
  vertical stack (face on top, spd under it) so the slot's intrinsic width ≤ the column.
- Ensure no ancestor between the grid cell and the rail has `overflow-x` clipping; the rail's
  own `overflow-y-auto` must not pair with an `overflow-x: hidden` that cuts content.
- Verify at common desktop widths that face + spd + the ▲/▼ glyph are fully visible.

Chosen approach: **vertical slot** (face centered on top, a compact `⚡spd` + ▲/▼ line under it),
which is robust to the narrow column and reads cleanly. Keep the side ring + "Ora" label.

---

## Fix 4 — Surface failed attacks in the log

### Root cause
`hitChance` exists in spell data but the engine never rolls it — the only "failure" is the
spd-based `dodge` (`effects.ts:36`), already narrated as "schiva". So a player sees no explicit
"the attack failed" line for the cases that read as failures: a **dodge** (already covered) and
a **control/effect spell that lands but does nothing** because the target is already under that
control (after Fix 2 this is rarer, but can still happen when all enemies are controlled).

This fix does **not** introduce a new hitChance miss roll (that would change balance and the rng
stream). It makes the existing failure outcomes explicit:
- Dodge: already "X lancia … ma Y schiva" — keep, ensure it always renders.
- A control spell whose only effect is an already-active control on the target (no damage, no new
  status) → log "X lancia … ma non ha effetto su Y" (no-op). Detection: the action applied a
  control the target already had and dealt no damage.

Implementation: presentational/log-copy in `describeEntry` + the engine flagging a no-op control
application. The cleanest low-risk approach: when an `applyStatus` for a control kind is skipped
because the target already has it (the `applyStatus` handler's stack policy already ignores
duplicates for `stun` via `refresh`/`ignore`), surface that as a flag the log can read. Since
the engine's `applyStatus` uses `refresh` for stun (re-applies), the precise "no effect" case is
narrow; the primary, reliable failure to surface is the **dodge**, which is already logged.

Given the above, Fix 4 scope is: **ensure dodge/miss is always clearly logged** (verify the
dodge copy fires for attack spells that dodge) and add a `flags: ['fail']` + log line for a
genuinely wasted action (an attack that deals 0 and applies no new status), narrated as
"X lancia … ma l'attacco fallisce". This covers "se un attacco fallisce, scrivilo" without a new
RNG mechanic.

---

## Components / files touched

| File | Change |
|---|---|
| `game/engine/combat/targeting.ts` | `mostWounded` alive-filter (Fix 1); control-aware `selectTarget` (Fix 2) |
| `game/engine/combat/effects.ts` | `heal` no-op on dead target (Fix 1) |
| `game/engine/combat/simulate.ts` | pass `spell` to `selectTarget` (Fix 2) |
| `components/battle/BattleLog.tsx` | `describeEntry` "non ha effetto / l'attacco fallisce" copy (Fix 4) |
| `components/battle/InitiativeBar.tsx` | vertical slot, no clip (Fix 3) |
| `data/constants.ts` (test) / `tests/engine/campaignBalance.test.ts` | re-base floor if balance moved (Fix 1/2) |

## Testing

- Fix 1: unit test — `mostWounded` never returns a dead unit; `heal` handler is a no-op on a dead
  target (hp stays 0, no `heal` flag). An engine-level test: a healer with a dead ally does not
  bring it back; a battle never logs a heal onto a dead unit.
- Fix 2: unit test — `appliesControl(stupeficium)` includes `stun`; `selectTarget` for a control
  spell skips an enemy already stunned when another valid enemy exists, and falls back when all are
  controlled.
- Fix 3: `InitiativeBar` renders faces + spd with the rail not horizontally clipped (assert the
  slot is a vertical stack / the rail has no `overflow-x` clip). Visual desktop check.
- Fix 4: `describeEntry` produces the "fallisce / non ha effetto" copy for a 0-value no-new-status
  attack; dodge still reads "schiva".
- Balance: re-run `campaignBalance` deterministically (n≥300); re-base the floor with a documented
  margin if it moved; update any seed-coupled battle fixture.
- Full suite green (known playFlow/campaignRunner flakes pass isolated), tsc 0, build ok.

## Non-goals

- No new hitChance miss RNG roll (would change balance + rng stream).
- No deliberate revive mechanic (Rennervate stays a plain heal that cannot revive).
- No change to which control statuses exist or their durations/stack policies.
