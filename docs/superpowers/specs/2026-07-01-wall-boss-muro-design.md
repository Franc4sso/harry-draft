# Slice 1 — Wall-boss framework + Area-0 "Il Muro"

**Date:** 2026-07-01
**Scope:** Reusable "wall" boss archetype + one concrete boss (Area-0 Muro). Areas 1 & 2 are out of scope (Area 2 = Voldemort, already scripted).

## Goal

A boss whose units carry a high **`damageReduction`** ("the wall"), telegraphed before the fight, countered by **veleno** (poison). Poison ticks bypass `damageReduction` — they subtract HP directly in `tickStatuses`, never routing through the `dr` multiplier at `game/engine/combat/effects.ts:65`.

Intent is a **soft wall** at Area 0 (the opener boss):
- **Without veleno:** winnable but slow/costly (attrition, some deaths) — win-rate lower but **not zero**.
- **With veleno:** fast, clean clear.
- The gap between the two is the teaching moment. Veleno is the *strong* counter, but raw burst/penetration remain valid (the wall must not become a hidden hard-gate).

## Verified facts (recon, 2026-07-01)

- `game/engine/combat/effects.ts:64-65` — `const dr = ctx.target.damageReduction; if (dr && dr > 0) dmg = Math.round(dmg * (1 - dr))`. The wall primitive already exists; it reads a per-unit field.
- Today `damageReduction` is set **only** by the Tassorosso (Hufflepuff) house effect (`game/engine/houseEffects.ts:72`). No boss path yet.
- `game/engine/combat/simulate.ts:47` — each combat unit is built by spreading `...houseMap[unit.id]`. This is the single population point for `damageReduction`.
- Veleno ticks in `game/engine/status.ts` (`tickStatuses`) apply `flat + pct*maxHp` as pure end-of-turn HP loss — **do not** route through `effects.ts` and so bypass `damageReduction`. (Verified.)
- `game/engine/combat/battlePackage.ts:37-48` — boss selection: `isFinalBoss` (area ≥ areas-1, i.e. area 2) → scripted `BOSSES[0]` (Voldemort); every other boss → `themedEnemyTeam` (procedural). Insertion point for a scripted first-boss branch.
- `data/bosses.ts:3` — `interface BossDef` with optional `exclusiveSynergy?: Synergy`. `BOSSES[0]` = Voldemort.
- Draft loop exists (`game/engine/draftSession.ts`, `roster.ts`, `components/draft/DraftCandidateCard.tsx`). Veleno is draftable: spell `serpensortia`, relics `ampolla-veleno`/`pugnale-bellatrix`/`boccino-doro`, veleno-tagged wizards. Player can genuinely build toward the counter.

## Architecture — three touch points, all pure wiring

No combat-engine math changes. We only *populate* the existing `damageReduction` field from a new source.

### 1. `BossDef` gains two optional fields (`data/bosses.ts`)
- `unitDamageReduction?: number` — the wall value (0..1), applied to every boss team unit.
- `pinnedArea?: number` — which area this boss is scripted into (Muro → 0).

Voldemort is untouched: it keeps riding the existing `isFinalBoss`/area-2 logic. Do **not** add `pinnedArea` to Voldemort.

### 2. Boss selection (`game/engine/combat/battlePackage.ts`)
Add a first-boss branch parallel to the Voldemort branch:
- If `isBoss && area === 0`, select the Muro BossDef (scripted), exactly like the Voldemort branch: `generateBossTeam` + optional `exclusiveSynergy` → `bossSynergy`.
- Muro's `unitDamageReduction` must reach the built units (see touch point 3). Thread the selected BossDef (or its `unitDamageReduction`) through `NodeBattle`/into the unit build so `simulate` can apply it.
- `NodePreview` exposes the telegraph for Muro (see Telegraph below).

The final-boss branch (area 2 → Voldemort) is unchanged.

### 3. Wall application (`game/engine/combat/simulate.ts:47`)
Where each enemy boss unit is built with `...houseMap[unit.id]`, also apply the boss's `unitDamageReduction`. Because `damageReduction` is already a real unit field consumed at `effects.ts:65`, **no engine change is needed** — this is population only.

If a unit could receive `damageReduction` from *both* a house effect and the wall, define the combine rule explicitly (recommended: take the max, not additive — additive could push `dr` toward 1.0 and hard-gate). Boss units are enemy-side and won't carry player house effects in practice, but make the rule explicit to avoid future surprise.

## Telegraph — where the player sees the weakness

- Muro's node preview must be visible **before** entering the boss node, so the *preceding* draft can react by picking veleno.
- `NodePreview` already carries `bossName`/`synergyIds`. Add an optional `bossHint?: string` (data only, no new UI system) rendered wherever the boss preview renders.
- Muro copy (Italian): name **"Il Muro"**, hint e.g. *"Incassa i colpi diretti — il veleno lo ignora."*

## Muro BossDef content (`data/bosses.ts`)
- `id: 'muro_boss'`, `name: 'Il Muro'`, `pinnedArea: 0`.
- `unitDamageReduction`: **soft** starting value ~0.35–0.45 (calibrated, see below — NOT 0.7).
- Team flavor: tanky members (higher HP/DEF, medium ATK). Reuse existing boss team generation; only the wall value and identity are new.
- `exclusiveSynergy`: optional group DEF bonus **only if** it serves the fantasy. YAGNI if `unitDamageReduction` alone reads as a wall.

## Anti-hard-gate check (design-time, before shipping)
Confirm the wall is **soft**: raw burst/crit must still meaningfully dent the boss (else it's a hidden hard-gate). If `unitDamageReduction` is high enough that non-veleno play collapses to ~0 win-rate, lower it. Veleno should be the *fast* path, not the *only* path.

## Calibration — measure-driven

Starting `unitDamageReduction` ~0.35–0.45, then sweep `campaignBalanceB` under two profiles:
- **with-veleno:** high/clean win-rate (fast clear).
- **without-veleno:** winnable but costly — lower win-rate but **not zero**.

Tuning rules:
- without-veleno win-rate → ~0 ⇒ too hard ⇒ lower `unitDamageReduction`.
- with- and without-veleno win-rates equal ⇒ veleno doesn't matter ⇒ raise `unitDamageReduction`.

**Risk (from memory):** the `campaignBalanceB` gate runs near its 0.15 floor. Muro raises Area-0 enemy power, so **re-measure the whole band**, not just the Muro node. Overall `campaignBalanceB` win-rate must stay within [0.15, 0.45].

## Testing

1. **Unit** — Muro BossDef pinned to area 0; `unitDamageReduction` lands on the built boss units in `simulate`.
2. **Unit** — veleno bypasses `dr`: a poison tick on a walled unit deals full damage; a direct hit is reduced by `(1 - dr)`.
3. **Integration** — area 0 → always Muro; area 2 → always Voldemort (final boss not broken); combine rule (max) for `damageReduction` holds.
4. **Balance** — `campaignBalanceB` stays in [0.15, 0.45]; two-profile (with/without veleno) sweep shows the expected gap (with > without, without > ~0).

## Out of scope
- Areas 1 & 2 wall bosses (future slices).
- Any change to Voldemort or the final-boss branch.
- New UI systems (telegraph reuses existing preview rendering).
- In-combat player choice / sim AI changes (counter lever is pre-battle team-building).

## Non-goals / watch-items
- **Variety:** a wall entertains once. This slice is fine, but the 3 bosses must not all become "wall + weakness" or they become predictable. Noted for future slices.
