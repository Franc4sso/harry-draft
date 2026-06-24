# Traits (Phase 2) — Design

**Date:** 2026-06-25
**Status:** Approved (direction B: engine foundation + varied symmetric traits)
**Builds on:** `2026-06-24-role-identity-design.md` (Phase 1 shipped)

## Goal

Add **traits**: an optional, hand-authored, per-wizard layer of signature
abilities on top of the role baseline. A wizard has 0, 1, or 2+ traits; a
trait-less wizard is still a full member of its role. Traits must work for
**both teams** (the player's wizards and enemy wizards), and must be **legible**
in the replay (an auto-battler — an invisible proc teaches the player nothing).

## Key constraint discovered (de-risks the whole phase)

Reactive hooks (`onHit`, `onHeal`, `onDeath`, …) currently fire **left-only**;
modifier hooks (`modifyOutgoingDamage`, …) fire both sides but relic listeners
self-gate to left. Firing reactive hooks for the right side is guarded by a
**listener-count check**: with no listeners, `collectReactive` returns `[]` and
the engine draws no RNG and logs nothing.

Therefore: making reactive hooks fire for **both** sides does **not** change any
existing battle, because (a) no current wizard has a trait → no right-side
listeners with effects, and (b) relic listeners return `[]` for the right side.
**Determinism and all snapshots are preserved for every trait-less battle.** Only
battles involving a trait-bearing wizard change — and none exist today.

---

## 1. Engine foundation — reactive symmetry

Three changes, all behaviour-preserving for trait-less content:

**1a. Relic reactive listeners become side-gated.** In
`game/engine/relics.ts`, change `bus.onReactive(hook, () => specs)` to
`bus.onReactive(hook, (ctx) => (ctx.side === 'left' ? specs : []))`. Relics stay
strictly a left-team mechanic even once reactive fires for the right.

**1b. Fire reactive hooks for both sides.** In
`game/engine/combat/simulate.ts`, remove the `actor.side === 'left'` /
left-target gates at the reactive fire sites (`onTurnStart`, `onTurnEnd`,
`onHit`, `onHeal`, `onDeath`, `onAllyDeath`, `onHpThreshold`). Each fire site is
already guarded by `collectReactive(...).length === 0 → skip`, so a side with no
listeners is a no-op (no RNG, no log) — preserving existing battles byte-for-byte.

**1c. Owner-gated trait listeners.** New
`registerTraitTriggers(bus, units)` (in `game/engine/traits.ts`) iterates every
`BattleUnit` (both L and R) and, for each of its wizard's traits, registers a
listener that fires only when the trait's owner is the unit the event is about.
Identity is by **reference equality** on the `BattleUnit` carried in `HookCtx`
(`ctx.actor` or `ctx.target`, per the trait's `owner` field). Relics gate by
side; traits gate by unit identity.

`simulateBattle` calls `registerTraitTriggers(bus, [...L, ...R])` alongside the
existing `registerRelicTriggers`.

---

## 2. Trait data model

Add to `types/wizard.ts`:

```ts
export interface Wizard {
  // …existing fields…
  traits?: string[]   // trait ids, hand-authored; 0..N
}
```

New `types/trait.ts`:

```ts
import type { EffectSpec, HookCtx, ModifierHook, ReactiveHook } from './…'

/** Which unit in the HookCtx owns/triggers the trait. */
export type TraitSubject = 'actor' | 'target'

export type TraitTrigger =
  | { kind: 'modifier'; hook: ModifierHook; owner: TraitSubject;
      apply: (value: number, ctx: HookCtx) => number }
  | { kind: 'reactive'; hook: ReactiveHook; owner: TraitSubject;
      effects: (ctx: HookCtx) => EffectSpec[] }

export interface Trait {
  id: string
  name: string          // short label for the chip, e.g. "Esecuzione"
  desc: string          // player-facing blurb for the tooltip
  trigger: TraitTrigger
}
```

Catalog in `data/traits.ts` as `TRAITS: Trait[]` + `TRAIT_BY_ID` map. Functions in
data are fine (this is TS data, mirroring how spells/relics carry behaviour).

`registerTraitTriggers` wraps each trigger with the owner gate:
- modifier: `bus.onModifier(hook, (v, ctx) => ctx[ownerField] === unit ? apply(v, ctx) : v)`
- reactive: `bus.onReactive(hook, (ctx) => ctx[ownerField] === unit ? effects(ctx) : [])`

where `ownerField` is `actor` or `target` per `trigger.owner`.

---

## 3. First slice — 5 traits (high-confidence hook mappings)

| Trait | Role | Hook | owner | Effect |
|-------|------|------|-------|--------|
| **Esecuzione** | Attaccante | modifyOutgoingDamage | actor | ×1.5 damage when `ctx.target` is below 30% HP |
| **Furia** | Attaccante | modifyOutgoingDamage | actor | ×(1 + missingHpFrac × 0.6) — up to +60% at 1 HP |
| **Roccia** | Tank | modifyIncomingDamage | target | ×0.8 damage taken |
| **Sifone** | Controllo | onHit | actor | applies a small SPD debuff to the unit it hit |
| **Benedizione** | Supporto | onHeal | actor | when this unit is healed, also gains a shield |

Notes:
- `onHeal` fires with `ctx.actor` = the healed unit, so *Benedizione* reads as
  "when healed, also shield" (owner = actor = the healed wizard).
- *Sifone* uses `onHit` (owner = the attacker) and returns an `EffectSpec`
  targeting the victim; the plan verifies the engine applies onHit specs to
  `ctx.target` and pins the exact `EffectSpec` (a short SPD debuff status).
- Tuning numbers (1.5, 0.6, 0.8, debuff size/duration, shield amount/duration)
  live as named constants near the catalog; they are starting values.

### Hand-authored assignment (thematic, a few wizards)

A small, curated set so the slice is testable and characterful — most wizards
stay trait-less:
- Voldemort → `Esecuzione`, `Furia`
- McGonagall → `Roccia`
- Bellatrix → `Sifone`
- Lupin → `Benedizione`

(Exact roster picks finalized in the plan; the point is several wizards across
roles and both potential teams.)

---

## 4. UI — trait chips on the card

Show a wizard's traits as small chips on `WizardCard`, near the role badge /
affiliation strip, styled like the existing synergy chips. Each chip uses the
**existing `Tooltip` component** so tapping/hovering reveals `trait.desc`
(works on mobile). A trait-less wizard shows no chips.

## 5. Legibility — traits in the replay

Every trait that visibly changes combat emits a flagged log entry so the replay
shows it (mirroring the regen/fatigue logging pattern):
- Reactive traits (Sifone, Benedizione) already produce log entries via the
  effects they apply; ensure the entry's `action` names the trait.
- Damage-modifier traits (Esecuzione, Furia) are harder to surface per-hit;
  at minimum tag the boosted hit with a flag (e.g. reuse/extend a flag) so the
  log can annotate it. The plan picks the lightest legible treatment.

## 6. Testing

- **Foundation parity:** an existing trait-less battle produces an identical
  result/log/snapshots after the reactive-symmetry change (determinism guard).
- **Symmetry:** a trait on a RIGHT-side wizard fires (proves both-side reactive).
- **Owner gating:** a trait on wizard A does not trigger from wizard B's actions.
- **Each trait:** a focused unit/integration test asserting its effect
  (Esecuzione boosts only sub-30% targets; Roccia reduces incoming; Sifone
  debuffs the victim's SPD; Benedizione shields on heal; Furia scales with HP).
- **UI:** trait chips render with a tooltip; trait-less wizard shows none.
- Full suite + `tsc` green.

---

## Non-goals (this slice)

- Victim-perspective / death-prevention traits (Riflesso, Vendetta, Tenacia,
  Sangue Freddo) — a second slice, once the onHit/onDeath effect-application
  perspective is confirmed.
- The cut traits from Phase 1 (Anticipo, Marchio) stay cut.
- Random/rolled trait assignment (hand-authored only).
- Reworking relic mechanics.
