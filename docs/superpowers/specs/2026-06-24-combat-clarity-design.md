# Combat clarity & wound-display fixes — design

Date: 2026-06-24

## Problem

Players cannot read the battle: who acts, who is targeted, and the order are
unclear; combat stats (atk/def/spd) — including relic/synergy buffs — are not
shown during a fight; and wounded wizards appear to start the next battle at
full HP ("la vita si rigenera").

Investigation result: the **engine state is correct**. Wounds DO persist
(`run.ts` `applyBattleToRoster` writes `currentHp`; tests cover it). The
"regeneration" is a **display bug in the replay layer**.

## Scope (4 fixes, all approved)

### Fix A — Wounds show in replay (BUG, 1 line)

`game/engine/combat/replay.ts:71-72` seeds frame 0 from `u.maxHp`:

```ts
for (const u of units) hp[u.key] = u.maxHp
```

`toBattleUnits` already computes the wound-aware start HP into `u.hp`
(`= min(buffed.hp, currentHp ?? buffed.hp)`). Frame 0 must use that:

```ts
for (const u of units) hp[u.key] = u.hp
```

Effect: a wizard wounded last battle starts the replay with a partial HP bar.
Enemies are always fresh (`currentHp` undefined → `u.hp === maxHp`), so they
are unaffected. No engine/state change.

### Fix B — Combat stats always visible on each unit

Show atk/def/spd (post synergy + relic buffs) under every unit during battle.
Buffs already flow into `BattleUnit.buffedStats` via `toBattleUnits`; we only
need to carry those numbers to the UI.

Data plumbing:
- `ReplayUnit` (replay.ts): add `atk: number; def: number; spd: number`,
  sourced from each `BattleUnit.buffedStats` when building `units`.
- `UnitBust` (UnitBust.tsx): render a compact stat row beneath the HP bar:
  `⚔ atk · 🛡 def · ⚡ spd` (lucide icons Sword/Shield/Zap, `tabular-nums`,
  `text-[10px]`). Always visible per the user's choice.

No new computation — pure projection of already-buffed stats. Because the
numbers come from `buffedStats`, relic/synergy bonuses are reflected
automatically.

### Fix C — Attacker → target clarity

Strengthen the existing cues:
- **ActionBanner**: make the acting unit's name bold/colored and the target's
  name bold/colored within the narration line (currently plain text via
  `describeEntry`). Keep it one line.
- **Directional indicator**: in `BattleArena`, when there is an acting unit and
  a target, the acting bust keeps its green aura and the target keeps its red
  aura (already present) — add an explicit small arrow/caption above the arena
  ("nome-attaccante → nome-bersaglio") so direction is unambiguous even at a
  glance. Reuse `SpellFx` direction (`fromMirrored`) already encoding left/right.

Keep it minimal: no new combat concepts, only presentation. Exact arrow styling
decided during implementation; the contract is "the player can always tell who
is hitting whom."

### Fix D — Initiative bar readability

`InitiativeBar` already shows current + upcoming. Improve legibility:
- Label the first slot "Ora" and the rest as the upcoming queue (small caption).
- Add each unit's **name** (truncated) under its crest, not just the crest, so
  the queue is identifiable without hovering.
- Keep current scale/opacity emphasis for the acting unit.

## Architecture / data flow

```
toBattleUnits → BattleUnit.buffedStats (atk/def/spd, buffed)
        │
        ▼
buildReplay → ReplayUnit { ...maxHp, atk, def, spd }   ← Fix B plumbing
        │                  frame[0].hp = u.hp           ← Fix A
        ▼
BattleArena / UnitBust  → stat row (B), auras + arrow (C)
InitiativeBar           → named queue with "Ora" (D)
ActionBanner            → emphasized actor/target names (C)
```

All four fixes are presentation-only. The combat engine, run state, wound
persistence, and RNG are untouched.

## Testing

- `replay.test.ts`: add a case — a `DraftedWizard` with `currentHp < maxHp`
  produces `frames[0].hp[key] === currentHp` (fraction-correct), and a fresh
  unit produces `frames[0].hp[key] === maxHp`.
- `replay.test.ts`: `ReplayUnit` carries buffed atk/def/spd (assert a unit with
  a synergy/relic atk bonus exposes the buffed value, not the base).
- UI tests (`tests/ui/`): `UnitBust` renders the stat row; `InitiativeBar`
  renders unit names + an "Ora" label; `ActionBanner` emphasizes actor/target.
- Full suite + production build must stay green (currently 413 passing).

## Out of scope

- No between-battle healing / rest nodes (none exist; not requested).
- No change to in-battle regen (synergy/relic per-turn regen is intended; it can
  legitimately heal a wounded unit *during* a fight — that is not the bug).
- No combat-engine balance changes.
```