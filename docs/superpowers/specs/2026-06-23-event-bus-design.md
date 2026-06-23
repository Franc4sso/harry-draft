# Event Bus + Run Map Data — Design

**Date:** 2026-06-23
**Status:** Approved design, pre-implementation
**Scope:** Build the combat Event Bus in full. Add Run Map data shape to `RunState` only — no map generation, no balancing (separate spec, later).

---

## 1. Motivation

The Effect System already exists and is good: `Spell.spec: EffectSpec[]` interpreted by `EFFECT_HANDLERS` keyed by `kind`. No `if (spell.name === ...)`.

The pain is **trigger dispatch**. Relic triggers are hardcoded inline in `simulateBattle`:

- `startOfBattle` — inline loop (`simulate.ts:58-71`)
- `onHit` — inline loop (`simulate.ts:101-110`)

Every new trigger (`onHeal`, `onAllyDeath`, `onTurnStart`, low-HP, ...) means another nested `if` block inside the combat loop. This is the "if everywhere" problem the Effect System was meant to avoid — solved for *what* an effect does, but not for *when* it fires.

The Event Bus decouples *when* from *what*: the engine emits lifecycle events; relics (and later: statuses, characters, map events) register as listeners. Adding a trigger = registering a listener, not editing the combat loop.

## 2. Two kinds of hook

A single return-`EffectSpec[]` model is insufficient. Triggers split into two categories:

### Reactive hooks — listener returns `EffectSpec[]`
Fire *after* something happened; add effects to a unit. Consistent with the existing Effect System. The bus collects returned `EffectSpec[]` and runs each through `EFFECT_HANDLERS` against the relevant unit, consuming the shared RNG in a fixed order (preserving determinism — the existing 251 seed-dependent tests must stay green).

```
onBattleStart  onTurnStart  onTurnEnd  onHit  onHeal  onDeath  onAllyDeath  onHpThreshold
```

### Modifier hooks — listener is a pure value transform
Fire *before* a value is committed; transform a number in flight (e.g. "double this spell's damage", "take 20% less damage"). A reactive `EffectSpec` cannot do this — the value is already applied by the time a reactive hook runs. Modeled as a pipeline:

```
value = listeners.reduce((v, fn) => fn(v, ctx), baseValue)
```

Each modifier listener is `(value: number, ctx) => number` — pure, deterministic, no RNG, no mutation.

```
modifyOutgoingDamage  modifyIncomingDamage  modifyHealing
```

### Reserved in the enum, NOT implemented now (YAGNI)
Kept in the type so the design doesn't close doors; no dispatch site until a consumer needs them:

```
beforeSpell  afterSpell  onRoundStart  onRoundEnd
```
(The model is turn-based per-unit, not round-based; `onTurnStart/End` already cover the round-ish cases.)

## 3. Architecture

### 3.1 Event types

```ts
// types/events.ts (new)
export type ReactiveHook =
  | 'onBattleStart' | 'onTurnStart' | 'onTurnEnd'
  | 'onHit' | 'onHeal' | 'onDeath' | 'onAllyDeath' | 'onHpThreshold'
export type ModifierHook =
  | 'modifyOutgoingDamage' | 'modifyIncomingDamage' | 'modifyHealing'
export type ReservedHook =
  | 'beforeSpell' | 'afterSpell' | 'onRoundStart' | 'onRoundEnd'
export type BattleHook = ReactiveHook | ModifierHook | ReservedHook
```

### 3.2 Context

Listeners receive a context describing what fired. It carries the existing `EffectCtx` shape plus event-specific fields. Reuses `EffectCtx` (`rng, turn, actor, target, flags`) so reactive listeners can hand their returned specs straight to `EFFECT_HANDLERS`.

```ts
export interface HookCtx {
  rng: Rng; turn: number
  actor: BattleUnit          // the unit the event is "about" (self for onTurnStart, attacker for onHit)
  target?: BattleUnit        // counterpart when meaningful (victim for onHit)
  side: Side                 // owning side of the listener being evaluated
  flags: LogFlag[]
}
```

`onHpThreshold` additionally carries `{ unit, hpPct }`; `onAllyDeath`/`onDeath` carry `{ dead }`. These are optional fields on `HookCtx` (one struct, optional members) rather than per-hook structs — keeps dispatch uniform.

### 3.3 The bus

```ts
// game/engine/combat/eventBus.ts (new)
export interface EventBus {
  onReactive(hook: ReactiveHook, fn: (ctx: HookCtx) => EffectSpec[]): void
  onModifier(hook: ModifierHook, fn: (value: number, ctx: HookCtx) => number): void

  // Engine emits. Reactive: collect specs, apply via EFFECT_HANDLERS in registration order.
  emitReactive(hook: ReactiveHook, ctx: HookCtx): void
  // Modifier: fold value through listeners in registration order.
  emitModifier(hook: ModifierHook, value: number, ctx: HookCtx): number
}
export function createEventBus(): EventBus
```

**Determinism contract:** listeners run in registration order. The bus consumes the shared `Rng` only inside `EFFECT_HANDLERS` (reactive path); modifier listeners never touch RNG. Registration order is fixed (relics registered in `ActiveRelic` array order, which is `stageObtained` order). This preserves the current determinism guarantee.

### 3.4 Relic → listener

`Relic` migrates from named trigger fields to a generic `triggers` array. Each trigger is pure data, registered as a listener at battle start.

```ts
// types/relic.ts — replaces startOfBattle / onHit
export interface RelicTrigger {
  hook: BattleHook
  effects?: EffectSpec[]   // reactive: applied when hook fires
  modifier?: { mult?: number; flat?: number }  // modifier: how to transform the value
  condition?: RelicCondition   // existing team-composition gate, reused
  threshold?: number       // for onHpThreshold (e.g. 0.5)
}
export interface Relic {
  id: string; name: string; desc: string; rarity: RelicRarity
  bonus?: SynergyBonus; condition?: RelicCondition
  triggers?: RelicTrigger[]   // NEW — replaces startOfBattle/onHit
}
```

Migration: `startOfBattle: X` → `{ hook: 'onBattleStart', effects: X }`; `onHit: X` → `{ hook: 'onHit', effects: X }`. All 18 existing relics convert mechanically; data-level change, behavior identical.

### 3.5 Wiring in `simulateBattle`

The inline trigger loops (`simulate.ts:58-71`, `101-110`) are deleted. Instead:

1. **Setup:** build the bus, register every left-relic trigger as a listener (respecting `condition`).
2. **Emit at lifecycle points** in the combat loop:
   - before the turn loop → `emitReactive('onBattleStart', ...)` per left unit
   - top of each unit's turn → `onTurnStart`
   - inside `resolveAction` damage path → `emitModifier('modifyOutgoingDamage'/'modifyIncomingDamage', dmg, ...)`, `emitReactive('onHit', ...)`
   - heal path → `emitModifier('modifyHealing', ...)`, `emitReactive('onHeal', ...)`
   - after any HP change → check `onHpThreshold` (fire once per crossing, not every tick — track a `belowThreshold` flag per unit/threshold)
   - on KO → `emitReactive('onDeath', ...)` for the dead unit, `onAllyDeath` for its living allies
   - end of unit turn → `onTurnEnd`

`resolveAction` / `EFFECT_HANDLERS` gain an optional `bus` in their ctx so the damage/heal handlers can call `emitModifier` at the point the value is computed. When no bus is passed (existing direct callers in tests), behavior is unchanged (modifiers default to identity).

## 4. Run Map data shape (data only — no generation, no balancing)

Extend `RunState` so a future map spec has a home, without committing to generation or balance numbers now.

```ts
// types/run.ts
export type RunNodeType = 'battle' | 'elite' | 'boss' | 'event' | 'shop' | 'relic'
export interface RunNode {
  id: string
  type: RunNodeType
  next: string[]          // ids of reachable nodes (branching graph)
}
export interface RunState {
  // ... existing fields (seed, phase, team, activeSynergies, stage, relics, lastBattle)
  map?: RunNode[]         // NEW, optional — absent today, populated by future map gen
  currentNodeId?: string  // NEW, optional — where the player is on the map
}
```

`map`/`currentNodeId` are **optional and unused by current code paths**. `nextBattle`/`startRun` keep working on `stage` exactly as today. This is purely "don't close the door": the shape exists, generation/traversal is a separate spec. No behavior change.

## 5. Testing

- **eventBus.test.ts** (new): registration order, reactive collect→apply, modifier fold, empty-bus identity, determinism (same seed → same dispatch sequence).
- **Migration safety:** the existing relic suites (`relicCombat`, `relicBonuses`, `replayRelics`, `relicOffer`, `runRelics`) must stay green unchanged — the relic *data* migrates but *behavior* is identical. This is the key regression gate: 18 relics, full suite (251 tests) green before and after.
- **New-hook coverage:** one test per newly-wired hook (`onHeal`, `onDeath`, `onAllyDeath`, `onHpThreshold`, modifier hooks) proving a relic using it fires correctly and deterministically.
- **Replay parity:** `replayRelics` proves combat and replay produce identical HP bars; must hold after refactor.

## 6. Out of scope (explicit)

- Map generation algorithm, node counts, branching probabilities.
- Event/shop/relic-node gameplay, prices, balancing.
- Reserved hooks (`beforeSpell`, `afterSpell`, `onRoundStart`, `onRoundEnd`) — enum only, no dispatch.
- Enemy relics (relics remain left-team only, as today).

## 7. Risks

- **Determinism regression** — highest risk. Mitigation: fixed registration order, RNG only in reactive `EFFECT_HANDLERS`, full seed-suite as regression gate.
- **Over-abstraction** — bus must stay a thin dispatcher; if a hook has no consumer it stays in the enum, not in the loop. YAGNI enforced by the reserved-hook list.
