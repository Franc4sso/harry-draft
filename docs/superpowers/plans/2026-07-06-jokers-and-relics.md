# Joker espansi + reliquie ridisegnate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estendere i "joker" (reliquie scaling) con nuove forme (trigger di scaling, condizionali, drawback), aggiungere ~11 joker nuovi, ridisegnare alcune reliquie base a potenza costante, e renderli visibili nelle run tramite un canale d'offerta joker-vs-reliquia sul nodo reliquia.

**Architecture:** I joker restano `Relic` (nessun tipo nuovo). Il motore ha tre mondi: contatore run-cumulative (fine battaglia), bonus statici (inizio battaglia via `applyRelicBonuses`), trigger reattivi (durante la battaglia via `registerRelicTriggers`/bus). Ogni nuova forma va nel suo mondo. Tutte le estensioni sono chirurgiche e testabili in isolamento.

**Tech Stack:** TypeScript, Next.js, Vitest. Motore combattimento deterministico auto-simulato.

## Global Constraints

- **Copy di gioco in italiano** (nomi/desc reliquie).
- **Il bot di bilanciamento NON pesca i joker** → joker sono balance-safe; NON muovono l'harness.
- **Le reliquie base SÌ muovono l'harness** → ridisegno a **power budget costante**; ri-misurare `campaignBalanceB` E `campaignBalanceRestricted` dopo. Se una reliquia non si esprime pulita a budget costante, **lasciarla invariata**.
- **MAX 5 nemici**, mai fuoco amico, niente camera shake — non toccati qui.
- `npm run test` NON esegue typecheck → eseguire `npm run typecheck` a parte su ogni task con TS nuovo.
- Determinismo: offerte reliquia/joker deterministiche per (seed, node id) — mai consumare rng fuori dai `fork` esistenti.

---

### Task 1: Estendere i tipi (RelicScaling, RelicConditional, drawback, onlyTurn)

**Files:**
- Modify: `types/relic.ts`
- Test: `tests/data/relicTypes.test.ts` (create)

**Interfaces:**
- Produces:
  - `RelicScaling.trigger: 'kill' | 'battleWin' | 'turn' | 'allyDead'`
  - `RelicScaling.stat: 'attack' | 'maxHp' | 'velenoMult' | 'defense' | 'speed'`
  - `RelicConditional = { when: { kind: 'teamSizeBelow'; value: number }; then: SynergyBonus }`
  - `Relic.conditional?: RelicConditional`
  - `Relic.drawback?: SynergyBonus`
  - `RelicTrigger.onlyTurn?: number`

- [ ] **Step 1: Write the failing test**

`tests/data/relicTypes.test.ts` — type-level + shape assertions on a hand-built relic:

```ts
import { describe, it, expect } from 'vitest'
import type { Relic } from '@/types/relic'

describe('extended relic types', () => {
  it('accepts new scaling triggers and stats', () => {
    const r: Relic = {
      id: 'x', name: 'X', desc: 'd', rarity: 'epica',
      scaling: { trigger: 'turn', stat: 'defense', per: 5, cap: 50 },
    }
    expect(r.scaling?.trigger).toBe('turn')
    expect(r.scaling?.stat).toBe('defense')
  })
  it('accepts conditional and drawback', () => {
    const r: Relic = {
      id: 'y', name: 'Y', desc: 'd', rarity: 'epica',
      conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } },
      drawback: { hp: -60 },
    }
    expect(r.conditional?.when.kind).toBe('teamSizeBelow')
    expect(r.drawback?.hp).toBe(-60)
  })
  it('accepts onlyTurn on a trigger', () => {
    const r: Relic = {
      id: 'z', name: 'Z', desc: 'd', rarity: 'epica',
      triggers: [{ hook: 'onTurnStart', onlyTurn: 1, effects: [] }],
    }
    expect(r.triggers?.[0]?.onlyTurn).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (typecheck)**

Run: `npx tsc --noEmit` — Expected: FAIL (properties not assignable). `npm run test tests/data/relicTypes.test.ts` may pass (vitest skips typecheck) — the real gate here is tsc.

- [ ] **Step 3: Implement the type changes**

In `types/relic.ts`:

```ts
export interface RelicScaling {
  /** What event increments the run counter. Run-cumulative, reset each run. */
  trigger: 'kill' | 'battleWin' | 'turn' | 'allyDead'
  /** Which stat the counter feeds. */
  stat: 'attack' | 'maxHp' | 'velenoMult' | 'defense' | 'speed'
  per: number
  cap: number
}

/** Static "when X then Y" gate — team composition is fixed during a battle, so this
 *  is evaluated once at applyRelicBonuses time (not on the bus). */
export interface RelicConditional {
  when: { kind: 'teamSizeBelow'; value: number }
  then: SynergyBonus
}
```

Add to `RelicTrigger`:
```ts
  /** Reactive trigger fires only when ctx.turn === onlyTurn (e.g. 1 = opening turn). */
  onlyTurn?: number
```

Add to `Relic`:
```ts
  /** Static conditional bonus (see RelicConditional). */
  conditional?: RelicConditional
  /** Always-on malus (SynergyBonus with negative values). Risk/reward jokers. */
  drawback?: SynergyBonus
```

Ensure `SynergyBonus` is imported (already is, via `./synergy`).

- [ ] **Step 4: Run typecheck + test to verify pass**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run test tests/data/relicTypes.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add types/relic.ts tests/data/relicTypes.test.ts
git commit -m "feat(relic): extend types — scaling triggers/stats, conditional, drawback, onlyTurn"
```

---

### Task 2: scalingStatBonus per defense/speed

**Files:**
- Modify: `game/engine/relics.ts` (fn `applyRelicBonuses`, ~103-127; `scalingStatBonus` ~42-48)
- Test: `tests/engine/relicScaling.test.ts` (extend existing)

**Interfaces:**
- Consumes: `RelicScaling.stat` including `'defense' | 'speed'` (Task 1).
- Produces: `applyRelicBonuses` adds scaled def/spd from a `scaling` relic to the returned Stats.

Context: `scalingStatBonus(relic, runCounter, stat)` already handles `'attack'|'maxHp'|'velenoMult'`. It reads `relic.scaling`, returns `Math.min(runCounter*per, cap)` **only if `relic.scaling.stat === stat`** — verify this gate exists; if it returns for any stat, add `if (s.stat !== stat) return 0`. `applyRelicBonuses` currently sums `scaledHp`/`scaledAtk`; add `scaledDef`/`scaledSpd`.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine/relicScaling.test.ts`:

```ts
import { applyRelicBonuses } from '@/game/engine/relics'
import type { ActiveRelic } from '@/types'

it('scales defense and speed from scaling relics', () => {
  const defJoker: ActiveRelic = {
    relic: { id: 'dj', name: 'DJ', desc: '', rarity: 'epica',
      scaling: { trigger: 'battleWin', stat: 'defense', per: 5, cap: 50 } },
    stageObtained: 0, runCounter: 4,
  }
  const spdJoker: ActiveRelic = {
    relic: { id: 'sj', name: 'SJ', desc: '', rarity: 'epica',
      scaling: { trigger: 'battleWin', stat: 'speed', per: 8, cap: 64 } },
    stageObtained: 0, runCounter: 3,
  }
  const base = { hp: 100, atk: 10, def: 10, spd: 10 }
  const out = applyRelicBonuses(base, [], [defJoker, spdJoker])
  expect(out.def).toBe(10 + 20) // 4*5
  expect(out.spd).toBe(10 + 24) // 3*8
})

it('clamps scaled def/spd at cap', () => {
  const defJoker: ActiveRelic = {
    relic: { id: 'dj', name: 'DJ', desc: '', rarity: 'epica',
      scaling: { trigger: 'battleWin', stat: 'defense', per: 5, cap: 50 } },
    stageObtained: 0, runCounter: 100,
  }
  const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [], [defJoker])
  expect(out.def).toBe(10 + 50)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/engine/relicScaling.test.ts -- -t "scales defense and speed"`
Expected: FAIL (def/spd unchanged at 10).

- [ ] **Step 3: Implement**

In `scalingStatBonus`, confirm/add the stat gate:
```ts
export function scalingStatBonus(relic: Relic, runCounter: number | undefined, stat: RelicScaling['stat']): number {
  const s = relic.scaling
  if (!s || s.stat !== stat) return 0
  return Math.min((runCounter ?? 0) * s.per, s.cap)
}
```

In `applyRelicBonuses`, add accumulators and apply after the `* m` pct step (def/spd don't take the allPct multiplier — they're flat scaled bonuses, mirror how scaledAtk/scaledHp are added post-multiply):
```ts
  let scaledDef = 0
  let scaledSpd = 0
  // inside the loop:
    scaledDef += scalingStatBonus(relic, runCounter, 'defense')
    scaledSpd += scalingStatBonus(relic, runCounter, 'speed')
  // in the return:
    def: Math.round(def * m) + scaledDef,
    spd: Math.round(spd * m) + scaledSpd,
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm run test tests/engine/relicScaling.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add game/engine/relics.ts tests/engine/relicScaling.test.ts
git commit -m "feat(relic): scalingStatBonus supports defense/speed"
```

---

### Task 3: BattleResult.alliesLost — conteggio morti player in simulate

**Files:**
- Modify: `types/combat.ts` (`BattleResult`, ~103-115)
- Modify: `game/engine/combat/simulate.ts` (death paths ~286/299/332; return ~404)
- Test: `tests/engine/combat/alliesLost.test.ts` (create)

**Interfaces:**
- Produces: `BattleResult.alliesLost: number` — count of `side === 'left'` units that died this battle.

Context: deaths are handled at three spots where `fireReactive('onDeath', …)` is called (`simulate.ts:286`, `:299`, `:332`). At each, the dying unit is `realTarget` / `actor` / `u`. Increment a local `let alliesLost = 0` when the dying unit's `side === 'left'`. **Include recoil self-kills** if the actor is left-side (a dark-magic caster killing itself IS an ally loss). Add `alliesLost` to the returned object at `:404`.

- [ ] **Step 1: Write the failing test**

`tests/engine/combat/alliesLost.test.ts` — construct a battle where a left unit dies and assert the count. Reuse existing simulate test helpers (see other files in `tests/engine/combat/`; look at `simulate.test.ts` for the `simulateBattle` import and fixture builders). Skeleton:

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
// Build a lopsided fixture: 1 weak left unit vs a strong right team so the left unit dies.
// (Copy the fixture-building style from tests/engine/combat/simulate.test.ts.)

describe('BattleResult.alliesLost', () => {
  it('counts left-side deaths', () => {
    const result = simulateBattle(/* weak left, strong right */)
    expect(result.alliesLost).toBeGreaterThanOrEqual(1)
  })
  it('is 0 when no left unit dies', () => {
    const result = simulateBattle(/* strong left, trivial right */)
    expect(result.alliesLost).toBe(0)
  })
})
```

> Implementer: inspect `tests/engine/combat/simulate.test.ts` to copy the exact `simulateBattle` signature and fixture helpers rather than inventing them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/engine/combat/alliesLost.test.ts`
Expected: FAIL (`alliesLost` undefined / not a number).

- [ ] **Step 3: Implement**

In `types/combat.ts` `BattleResult`, add:
```ts
  /** Player-side (left) units that died this battle. Drives allyDead scaling jokers. */
  alliesLost: number
```

In `simulate.ts`: `let alliesLost = 0` near `const kills = { left: 0, right: 0 }` (~:104). At each death site (`:286`, `:299`, `:332`), after confirming the unit died, add:
```ts
if (<dyingUnit>.side === 'left') alliesLost++
```
(`<dyingUnit>` = `realTarget` at :286, `actor` at :299, `u` at :332 — match the variable already used for `fireReactive('onDeath', …)` at that site.)

In the return (`:404`): add `, alliesLost` to the returned object literal.

- [ ] **Step 4: Run test + full simulate suite**

Run: `npm run test tests/engine/combat/alliesLost.test.ts` — Expected: PASS.
Run: `npm run test tests/engine/combat/` — Expected: all PASS (no regression on kills/turns).
Run: `npx tsc --noEmit` — Expected: clean (all `BattleResult` literals now need `alliesLost`; fix any construction site the compiler flags by adding `alliesLost: 0` or the real count).

- [ ] **Step 5: Commit**

```bash
git add types/combat.ts game/engine/combat/simulate.ts tests/engine/combat/alliesLost.test.ts
git commit -m "feat(combat): BattleResult.alliesLost — count player-side deaths"
```

---

### Task 4: applyRelicScaling con deltas per-trigger

**Files:**
- Modify: `game/engine/relics.ts` (fn `applyRelicScaling`, ~31-39)
- Modify: `game/engine/resolvers/combat.ts` (call site ~114)
- Test: `tests/engine/relicScalingPersist.test.ts` (extend) or `tests/engine/relicScaling.test.ts`

**Interfaces:**
- Consumes: `BattleResult.turns`, `BattleResult.kills`, `BattleResult.alliesLost`, `winner` (Task 3).
- Produces: `applyRelicScaling(relics: ActiveRelic[], deltas: ScalingDeltas): ActiveRelic[]` where
  `ScalingDeltas = { kill: number; battleWin: number; turn: number; allyDead: number }`.
  Each scaling relic's `runCounter` increases by `deltas[relic.scaling.trigger]`.

Context: current signature is `applyRelicScaling(relics, killDelta: number)`. This is a **breaking signature change** — update the single caller (`combat.ts:114`).

- [ ] **Step 1: Write the failing test**

Append to `tests/engine/relicScaling.test.ts`:

```ts
import { applyRelicScaling } from '@/game/engine/relics'

it('routes each scaling relic to its own trigger delta', () => {
  const mk = (id: string, trigger: any): ActiveRelic => ({
    relic: { id, name: id, desc: '', rarity: 'epica', scaling: { trigger, stat: 'attack', per: 1, cap: 999 } },
    stageObtained: 0, runCounter: 0,
  })
  const relics = [mk('k', 'kill'), mk('w', 'battleWin'), mk('t', 'turn'), mk('a', 'allyDead')]
  const out = applyRelicScaling(relics, { kill: 3, battleWin: 1, turn: 7, allyDead: 2 })
  expect(out.find(r => r.relic.id === 'k')!.runCounter).toBe(3)
  expect(out.find(r => r.relic.id === 'w')!.runCounter).toBe(1)
  expect(out.find(r => r.relic.id === 't')!.runCounter).toBe(7)
  expect(out.find(r => r.relic.id === 'a')!.runCounter).toBe(2)
})

it('leaves non-scaling relics untouched', () => {
  const flat: ActiveRelic = { relic: { id: 'f', name: 'F', desc: '', rarity: 'comune', bonus: { atk: 5 } }, stageObtained: 0 }
  const out = applyRelicScaling([flat], { kill: 3, battleWin: 1, turn: 7, allyDead: 2 })
  expect(out[0]!.runCounter).toBeUndefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/engine/relicScaling.test.ts -- -t "routes each scaling"`
Expected: FAIL (old signature expects a number).

- [ ] **Step 3: Implement**

In `game/engine/relics.ts`:
```ts
export interface ScalingDeltas { kill: number; battleWin: number; turn: number; allyDead: number }

/** After a battle, add the per-trigger delta to the run counter of every scaling relic. Pure. */
export function applyRelicScaling(relics: ActiveRelic[], deltas: ScalingDeltas): ActiveRelic[] {
  return relics.map(ar => {
    const s = ar.relic.scaling
    if (!s) return ar
    const d = deltas[s.trigger]
    if (d <= 0) return ar
    return { ...ar, runCounter: (ar.runCounter ?? 0) + d }
  })
}
```
Export `ScalingDeltas` from the module.

In `game/engine/resolvers/combat.ts:114`:
```ts
    relics: applyRelicScaling(state.relics, {
      kill: out.result.kills.left,
      battleWin: out.result.winner === 'left' ? 1 : 0,
      turn: out.result.turns,
      allyDead: out.result.alliesLost,
    }),
```
(Verify `out.result.winner` is the field name — check `BattleResult`; it's `winner` per `simulate.ts:404`.)

- [ ] **Step 4: Run test + regression**

Run: `npm run test tests/engine/relicScaling.test.ts tests/engine/relicScalingPersist.test.ts` — Expected: PASS.
Run: `npm run test tests/engine/` — Expected: no regression.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add game/engine/relics.ts game/engine/resolvers/combat.ts tests/engine/relicScaling.test.ts
git commit -m "feat(relic): applyRelicScaling routes per-trigger deltas (kill/win/turn/allyDead)"
```

---

### Task 5: conditional (teamSizeBelow) + drawback in applyRelicBonuses

**Files:**
- Modify: `game/engine/relics.ts` (fn `applyRelicBonuses`)
- Test: `tests/engine/relicConditional.test.ts` (create)

**Interfaces:**
- Consumes: `Relic.conditional`, `Relic.drawback` (Task 1); `relicMatchesCondition` helper exists.
- Produces: `applyRelicBonuses` applies `conditional.then` when `livingTeamSize < value`, and always applies `drawback` (negative SynergyBonus).

Context: `applyRelicBonuses(stats, team, relics)` receives `team: DraftedWizard[]`. "Living team size" = count of team members alive. `DraftedWizard` has `currentHp`; a member is alive if `currentHp === undefined || currentHp > 0`. Reuse the same aliveness notion used elsewhere (`livingOf` in `roster.ts` operates on the team — check its predicate and mirror it; do NOT import combat state here, `applyRelicBonuses` runs pre-battle on drafted wizards).

- [ ] **Step 1: Write the failing test**

`tests/engine/relicConditional.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyRelicBonuses } from '@/game/engine/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

const dw = (id: string): DraftedWizard => ({
  wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
  stats: { hp: 100, atk: 10, def: 10, spd: 10 },
} as any)

describe('conditional + drawback', () => {
  it('applies teamSizeBelow bonus when team is small', () => {
    const relic: ActiveRelic = {
      relic: { id: 'c', name: 'C', desc: '', rarity: 'epica',
        conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } } },
      stageObtained: 0,
    }
    const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [dw('a')], [relic])
    expect(out.atk).toBe(15) // 10 * 1.5
  })
  it('does NOT apply when team is large enough', () => {
    const relic: ActiveRelic = {
      relic: { id: 'c', name: 'C', desc: '', rarity: 'epica',
        conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } } },
      stageObtained: 0,
    }
    const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [dw('a'), dw('b')], [relic])
    expect(out.atk).toBe(10)
  })
  it('applies drawback (negative bonus) always', () => {
    const relic: ActiveRelic = {
      relic: { id: 'd', name: 'D', desc: '', rarity: 'epica', bonus: { atk: 40 }, drawback: { hp: -60 } },
      stageObtained: 0,
    }
    const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [dw('a')], [relic])
    expect(out.atk).toBe(50)
    expect(out.hp).toBe(40)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/engine/relicConditional.test.ts`
Expected: FAIL (conditional/drawback ignored).

- [ ] **Step 3: Implement**

In `applyRelicBonuses`, inside the relic loop (after the existing `bonus` handling), fold in conditional + drawback into the same `hp/atk/def/spd/pct` accumulators BEFORE the `* m` multiply, so `allPct` composes correctly:

```ts
    // Conditional (static teamSizeBelow gate)
    const cond = relic.conditional
    if (cond && cond.when.kind === 'teamSizeBelow') {
      const living = team.filter(isAliveDrafted).length
      if (living < cond.when.value) {
        const t = cond.then
        hp += t.hp ?? 0; atk += t.atk ?? 0; def += t.def ?? 0; spd += t.spd ?? 0; pct += t.allPct ?? 0
      }
    }
    // Drawback (always-on negative)
    const dbk = relic.drawback
    if (dbk) {
      hp += dbk.hp ?? 0; atk += dbk.atk ?? 0; def += dbk.def ?? 0; spd += dbk.spd ?? 0; pct += dbk.allPct ?? 0
    }
```

Add a small helper (mirror `livingOf`'s predicate):
```ts
function isAliveDrafted(d: DraftedWizard): boolean {
  return d.currentHp === undefined || d.currentHp > 0
}
```
(Confirm the field name/predicate against `roster.ts` `livingOf`; if `livingOf` already takes a team and filters, you may call it: `livingOf(team).length`.)

- [ ] **Step 4: Run test to verify pass**

Run: `npm run test tests/engine/relicConditional.test.ts` — Expected: PASS.
Run: `npm run test tests/engine/relicScaling.test.ts` — Expected: still PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add game/engine/relics.ts tests/engine/relicConditional.test.ts
git commit -m "feat(relic): applyRelicBonuses handles teamSizeBelow conditional + drawback"
```

---

### Task 6: onlyTurn gate in registerRelicTriggers

**Files:**
- Modify: `game/engine/relics.ts` (fn `registerRelicTriggers`, ~74-101)
- Test: `tests/engine/relicOnlyTurn.test.ts` (create)

**Interfaces:**
- Consumes: `RelicTrigger.onlyTurn` (Task 1); `EventBus`, `HookCtx.turn`.
- Produces: a reactive relic trigger with `onlyTurn: N` fires only when `ctx.turn === N`.

Context: reactive triggers register via `bus.onReactive(trig.hook, (ctx) => (ctx.side === side ? specs : []))` (`relics.ts:87`). Add the `onlyTurn` gate inside that callback.

- [ ] **Step 1: Write the failing test**

`tests/engine/relicOnlyTurn.test.ts` — build an EventBus, register a relic with `onlyTurn: 1`, fire `onTurnStart` at turn 1 and turn 2, assert effects returned only at turn 1. Copy the bus-construction style from `tests/engine/combat/` bus tests (e.g. `eventBusWiring` or `effects.test.ts`).

```ts
import { describe, it, expect } from 'vitest'
import { EventBus } from '@/game/engine/combat/eventBus'
import { registerRelicTriggers } from '@/game/engine/relics'
import type { ActiveRelic } from '@/types'

describe('onlyTurn trigger gate', () => {
  it('fires only on the matching turn', () => {
    const bus = new EventBus()
    const relic: ActiveRelic = {
      relic: { id: 'op', name: 'Op', desc: '', rarity: 'epica',
        triggers: [{ hook: 'onTurnStart', onlyTurn: 1, effects: [{ kind: 'buff', stat: 'atk', amount: 40, target: 'ally' } as any] }] },
      stageObtained: 0,
    }
    registerRelicTriggers(bus, [], [relic], 'left')
    const at1 = bus.collectReactive('onTurnStart', { turn: 1, side: 'left' } as any)
    const at2 = bus.collectReactive('onTurnStart', { turn: 2, side: 'left' } as any)
    expect(at1.length).toBeGreaterThan(0)
    expect(at2.length).toBe(0)
  })
})
```

> Implementer: check `EventBus` for the exact reactive-collection method name (`collectReactive`/`fireReactive`/etc.) and the `HookCtx` shape — copy from an existing bus test. Adjust the test to the real API; the assertion (fires at 1, not at 2) is what matters.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/engine/relicOnlyTurn.test.ts`
Expected: FAIL (fires at both turns).

- [ ] **Step 3: Implement**

In `registerRelicTriggers`, the reactive registration becomes:
```ts
          const only = trig.onlyTurn
          bus.onReactive(trig.hook, (ctx) => {
            if (only != null && ctx.turn !== only) return []
            return ctx.side === side ? specs : []
          })
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm run test tests/engine/relicOnlyTurn.test.ts` — Expected: PASS.
Run: `npm run test tests/engine/combat/` — Expected: no regression on existing triggers.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add game/engine/relics.ts tests/engine/relicOnlyTurn.test.ts
git commit -m "feat(relic): onlyTurn gate for reactive triggers (opening-turn jokers)"
```

---

### Task 7: Split pool — offerRelics esclude joker, nuovo offerJokers

**Files:**
- Modify: `data/relics.ts` (add `JOKER_RELIC_IDS`)
- Modify: `game/engine/relics.ts` (fn `offerRelics`; add `offerJokers`)
- Test: `tests/engine/offerJokers.test.ts` (create)

**Interfaces:**
- Consumes: `JOKER_RELIC_IDS` (new, superset of `SCALING_RELIC_IDS` + new joker ids).
- Produces:
  - `offerRelics` never returns a relic whose id ∈ `JOKER_RELIC_IDS`.
  - `offerJokers(rng: Rng, owned: ActiveRelic[]): Relic[]` returns up to `BALANCE.relics.offerCount` distinct jokers not already owned, weighted uniformly (not by epica rarity).

Context: `offerRelics` currently pulls from `restrictedRelicPool(RELICS).filter(!owned)`. Add a joker exclusion. `offerJokers` mirrors the loop but over the joker pool, and does NOT apply `restrictedRelicPool` unlock-gating unless jokers participate in unlocks (they're in STARTER_RELICS per Task 8, so they're always available — offer all not-owned jokers).

- [ ] **Step 1: Write the failing test**

`tests/engine/offerJokers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { offerRelics, offerJokers } from '@/game/engine/relics'
import { JOKER_RELIC_IDS } from '@/data/relics'
import { makeRng } from '@/game/engine/rng' // confirm rng factory name

describe('pool split', () => {
  it('offerRelics never offers a joker', () => {
    const jokerSet = new Set(JOKER_RELIC_IDS)
    for (let seed = 0; seed < 50; seed++) {
      const offer = offerRelics(makeRng(seed), [], 0)
      expect(offer.every(r => !jokerSet.has(r.id))).toBe(true)
    }
  })
  it('offerJokers returns only jokers, distinct, not owned', () => {
    const offer = offerJokers(makeRng(1), [])
    expect(offer.length).toBeGreaterThan(0)
    expect(offer.every(r => JOKER_RELIC_IDS.includes(r.id))).toBe(true)
    expect(new Set(offer.map(r => r.id)).size).toBe(offer.length)
  })
})
```

> Implementer: confirm the rng factory (`makeRng`/`rngFrom`/`createRng`) from `game/engine/rng.ts` and match imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/engine/offerJokers.test.ts`
Expected: FAIL (`offerJokers`/`JOKER_RELIC_IDS` undefined).

- [ ] **Step 3: Implement**

In `data/relics.ts`, after `SCALING_RELIC_IDS`, add (ids finalized in Task 8; for now include the 3 existing + reserve the new ones):
```ts
export const JOKER_RELIC_IDS: string[] = [
  'fame-vorace', 'collezionista-anime', 'marchio-vorace',
  // + new joker ids added in Task 8
]
```

In `game/engine/relics.ts`:
```ts
import { RELICS, SCALING_RELIC_IDS, JOKER_RELIC_IDS } from '@/data/relics'

const JOKER_SET = new Set(JOKER_RELIC_IDS)

export function offerRelics(rng: Rng, owned: ActiveRelic[], _stage: number): Relic[] {
  const ownedIds = new Set(owned.map(o => o.relic.id))
  const available = restrictedRelicPool(RELICS).filter(r => !ownedIds.has(r.id) && !JOKER_SET.has(r.id))
  // ...existing weighted pick loop unchanged...
}

export function offerJokers(rng: Rng, owned: ActiveRelic[]): Relic[] {
  const ownedIds = new Set(owned.map(o => o.relic.id))
  const pool = RELICS.filter(r => JOKER_SET.has(r.id) && !ownedIds.has(r.id))
  const count = Math.min(BALANCE.relics.offerCount, pool.length)
  const remaining = [...pool]
  const chosen: Relic[] = []
  for (let i = 0; i < count; i++) {
    // uniform pick (not rarity-weighted) so all jokers are equally visible
    const idx = Math.floor(rng.next() * remaining.length)
    chosen.push(remaining[idx]!)
    remaining.splice(idx, 1)
  }
  return chosen
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm run test tests/engine/offerJokers.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add data/relics.ts game/engine/relics.ts tests/engine/offerJokers.test.ts
git commit -m "feat(relic): split joker pool — offerRelics excludes jokers, add offerJokers"
```

---

### Task 8: Roster joker (~11 nuovi) — dati

**Files:**
- Modify: `data/relics.ts` (RELICS array; `JOKER_RELIC_IDS`)
- Modify: `data/unlocks.ts` (`STARTER_RELICS` — add new joker ids)
- Test: `tests/data/jokerRoster.test.ts` (create)

**Interfaces:**
- Consumes: extended `Relic` shape (Task 1).
- Produces: 11 new joker relics with valid descriptors; all new ids ∈ `JOKER_RELIC_IDS` and ∈ `STARTER_RELICS`.

- [ ] **Step 1: Write the failing test**

`tests/data/jokerRoster.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RELICS, JOKER_RELIC_IDS } from '@/data/relics'
import { STARTER_RELICS } from '@/data/unlocks'

const NEW_JOKERS = [
  'marcia-di-guerra', 'fortezza-vivente', 'vento-crescente', 'eredita-dei-caduti',
  'ultimo-baluardo', 'branco-ristretto', 'furia-morente', 'canto-del-cigno',
  'assalto-d-apertura', 'patto-vorace', 'sete-di-sangue',
]

describe('joker roster', () => {
  it('all new jokers exist in RELICS', () => {
    for (const id of NEW_JOKERS) {
      expect(RELICS.find(r => r.id === id), id).toBeTruthy()
    }
  })
  it('all new jokers are in JOKER_RELIC_IDS and STARTER_RELICS', () => {
    for (const id of NEW_JOKERS) {
      expect(JOKER_RELIC_IDS.includes(id), `${id} joker set`).toBe(true)
      expect(STARTER_RELICS.includes(id), `${id} starter`).toBe(true)
    }
  })
  it('scaling jokers have valid trigger/stat/cap', () => {
    for (const r of RELICS.filter(r => JOKER_RELIC_IDS.includes(r.id) && r.scaling)) {
      expect(r.scaling!.cap).toBeGreaterThan(0)
      expect(r.scaling!.per).toBeGreaterThan(0)
    }
  })
  it('every joker has italian name and desc', () => {
    for (const id of JOKER_RELIC_IDS) {
      const r = RELICS.find(x => x.id === id)!
      expect(r.name.length).toBeGreaterThan(0)
      expect(r.desc.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/data/jokerRoster.test.ts`
Expected: FAIL (new jokers missing).

- [ ] **Step 3: Implement — add jokers to RELICS**

Append to `RELICS` in `data/relics.ts` (Italian copy; values are playtest starting points):

```ts
  // --- Joker: scaling (nuovi trigger/stat) ---
  { id: 'marcia-di-guerra', name: 'Marcia di Guerra', rarity: 'epica',
    desc: 'A ogni turno di battaglia, +6 attacco per il resto della run (max +90).',
    scaling: { trigger: 'turn', stat: 'attack', per: 6, cap: 90 } },
  { id: 'fortezza-vivente', name: 'Fortezza Vivente', rarity: 'epica',
    desc: 'A ogni battaglia vinta, +5 difesa per il resto della run (max +50).',
    scaling: { trigger: 'battleWin', stat: 'defense', per: 5, cap: 50 } },
  { id: 'vento-crescente', name: 'Vento Crescente', rarity: 'epica',
    desc: 'A ogni battaglia vinta, +8 velocità per il resto della run (max +64).',
    scaling: { trigger: 'battleWin', stat: 'speed', per: 8, cap: 64 } },
  { id: 'eredita-dei-caduti', name: 'Eredità dei Caduti', rarity: 'epica',
    desc: 'Per ogni mago caduto nella run, +18 attacco alla squadra (max +90).',
    scaling: { trigger: 'allyDead', stat: 'attack', per: 18, cap: 90 } },
  // --- Joker: condizionali (when X then Y) ---
  { id: 'ultimo-baluardo', name: 'Ultimo Baluardo', rarity: 'epica',
    desc: 'Se restano meno di 2 maghi vivi, +50% a tutte le statistiche.',
    conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } } },
  { id: 'branco-ristretto', name: 'Branco Ristretto', rarity: 'epica',
    desc: 'Se hai meno di 3 maghi vivi, +25 attacco e +25 difesa.',
    conditional: { when: { kind: 'teamSizeBelow', value: 3 }, then: { atk: 25, def: 25 } } },
  { id: 'furia-morente', name: 'Furia Morente', rarity: 'epica',
    desc: 'Quando un mago scende sotto il 40% di vita, guadagna +30 attacco.',
    triggers: [{ hook: 'onHpThreshold', threshold: 0.4,
      effects: [{ kind: 'buff', stat: 'atk', amount: 30, target: 'self' } as any] }] },
  { id: 'canto-del-cigno', name: 'Canto del Cigno', rarity: 'epica',
    desc: 'Quando un alleato cade, la squadra viva guadagna +20 attacco.',
    triggers: [{ hook: 'onAllyDeath',
      effects: [{ kind: 'buff', stat: 'atk', amount: 20, target: 'ally' } as any] }] },
  { id: 'assalto-d-apertura', name: "Assalto d'Apertura", rarity: 'epica',
    desc: 'Al primo turno, tutta la squadra guadagna +40 attacco.',
    triggers: [{ hook: 'onTurnStart', onlyTurn: 1,
      effects: [{ kind: 'buff', stat: 'atk', amount: 40, target: 'ally' } as any] }] },
  // --- Joker: drawback (rischio/ricompensa) ---
  { id: 'patto-vorace', name: 'Patto Vorace', rarity: 'epica',
    desc: '+40 attacco, ma -60 vita massima (cannone di vetro).',
    bonus: { atk: 40 }, drawback: { hp: -60 } },
  { id: 'sete-di-sangue', name: 'Sete di Sangue', rarity: 'epica',
    desc: '+50 attacco, ma -6 rigenerazione (ti logori).',
    bonus: { atk: 50 }, drawback: { regen: -6 } },
```

> Implementer: verify the reactive `effects` shape (`EffectSpec`) against `types/status.ts` and existing relic triggers (e.g. `pietra-resurrezione` uses `{ kind: 'shield', amount }`). Use the REAL `EffectSpec` variant for a stat buff — inspect `data/statuses.ts`/`effects.ts` for the correct `kind` (it may be `applyStatus` with a buff status rather than a raw `buff`). **If no clean "buff atk" EffectSpec exists**, model furia-morente / canto / assalto as an `applyStatus` referencing a buff status, OR (simpler) convert them to a `modifier` trigger (`modifyOutgoingDamage` mult). Pick whichever the engine already supports; do NOT invent a new EffectSpec kind. Adjust the test's expectation of "effects" accordingly — the roster test only checks existence/copy, not mechanics (mechanics are covered by Tasks 5/6 and the balance pass).

Update `JOKER_RELIC_IDS` to include all 11 new ids. Update `STARTER_RELICS` in `data/unlocks.ts` to include all 11 new ids.

- [ ] **Step 4: Run test + typecheck**

Run: `npm run test tests/data/jokerRoster.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean (fix any EffectSpec shape errors per the note above).

- [ ] **Step 5: Commit**

```bash
git add data/relics.ts data/unlocks.ts tests/data/jokerRoster.test.ts
git commit -m "feat(relic): 11 new jokers — scaling/conditional/drawback archetypes"
```

---

### Task 9: Canale d'offerta — nodo reliquia offre joker o reliquia

**Files:**
- Modify: `data/constants.ts` (`relics.jokerNodeChance`)
- Modify: `game/engine/resolvers/recruit.ts` (fn `relicOffer`, ~17-21)
- Test: `tests/engine/relicOfferChannel.test.ts` (create)

**Interfaces:**
- Consumes: `offerJokers` (Task 7), `BALANCE.relics.jokerNodeChance`.
- Produces: `relicOffer` returns 3 jokers with prob. `jokerNodeChance`, else 3 base relics — deterministic per (seed, node id).

Context: `relicOffer` forks rng at `2000 + area*100 + floor*10 + idx` then calls `offerRelics`. Add a leading roll from the SAME fork to decide joker-vs-relic, so it stays deterministic and doesn't disturb the downstream pick sequence (roll first, then pick).

- [ ] **Step 1: Write the failing test**

`tests/engine/relicOfferChannel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { JOKER_RELIC_IDS } from '@/data/relics'
// build a minimal RunState + RunNode; copy fixture style from tests/engine/nodeResolvers.test.ts

describe('relic node channel', () => {
  it('is deterministic per node id', () => {
    const a = relicOffer(state, node, rng())
    const b = relicOffer(state, node, rng())
    expect(a.map(r => r.id)).toEqual(b.map(r => r.id))
  })
  it('offers jokers on some nodes and relics on others across seeds', () => {
    const jokerSet = new Set(JOKER_RELIC_IDS)
    let sawJoker = false, sawRelic = false
    for (let i = 0; i < 40; i++) {
      const offer = relicOffer(stateFor(i), nodeFor(i), rng())
      const allJoker = offer.every(r => jokerSet.has(r.id))
      const noJoker = offer.every(r => !jokerSet.has(r.id))
      if (allJoker) sawJoker = true
      if (noJoker) sawRelic = true
    }
    expect(sawJoker).toBe(true)
    expect(sawRelic).toBe(true)
  })
})
```

> Implementer: copy the RunState/RunNode fixture from `tests/engine/nodeResolvers.test.ts` (it already exercises `relicOffer`/resolvers). Vary node id per iteration to change the fork seed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/engine/relicOfferChannel.test.ts`
Expected: FAIL (never offers jokers — `relicOffer` only calls `offerRelics`).

- [ ] **Step 3: Implement**

In `data/constants.ts`, under `relics:`:
```ts
    jokerNodeChance: 0.35,
```

In `game/engine/resolvers/recruit.ts`:
```ts
import { offerRelics, offerJokers } from '../relics'
import { BALANCE } from '@/data/constants'

export function relicOffer(state: RunState, node: RunNode, rng: Rng): Relic[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(2000 + area * 100 + floor * 10 + idx)
  const isJoker = r.next() < BALANCE.relics.jokerNodeChance
  return isJoker ? offerJokers(r, state.relics) : offerRelics(r, state.relics, 0)
}
```

> Note: this adds one `r.next()` before the pick. That shifts the base-relic pick sequence vs today, which may change WHICH relics are offered on a given seed — acceptable (offers are still deterministic; no test pins exact relic ids for a given seed except this new one). If an existing test DOES pin relic offer ids, update its expected values (don't weaken the determinism).

- [ ] **Step 4: Run test + regression**

Run: `npm run test tests/engine/relicOfferChannel.test.ts` — Expected: PASS.
Run: `npm run test tests/engine/ tests/screens/` — Expected: no regression (fix any offer-id-pinning test per note above).
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add data/constants.ts game/engine/resolvers/recruit.ts tests/engine/relicOfferChannel.test.ts
git commit -m "feat(run): relic node offers jokers (35%) or base relics — deterministic"
```

---

### Task 10: Reliquie ridisegnate a potenza costante (balance-guarded)

**Files:**
- Modify: `data/relics.ts` (redesign Giratempo / Mappa del Malandrino / Ricordella; +optional new relics)
- Test: `tests/data/relicRedesign.test.ts` (create) + balance re-measure

**Interfaces:**
- Consumes: extended `Relic` shape (Task 1); existing `grantsExecute`, trigger hooks.
- Produces: redesigned relics keeping ≈ same power budget; balance harness stays above floors.

Context: **This is the balance-sensitive task.** The redesigns must not increase the base-relic power the bot drafts. Per spec: if a redesign can't be expressed cleanly at constant budget, **leave the original relic unchanged**.

- [ ] **Step 1: Write the failing test (structural, not balance)**

`tests/data/relicRedesign.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RELICS } from '@/data/relics'

describe('redesigned relics remain well-formed', () => {
  it('giratempo still exists with a spd component', () => {
    const r = RELICS.find(x => x.id === 'giratempo')!
    expect(r).toBeTruthy()
    expect(r.desc).toMatch(/velocità/i)
  })
  // mappa-malandrino, ricordatutto similar existence/copy checks
})
```

- [ ] **Step 2: Run test to verify current state**

Run: `npm run test tests/data/relicRedesign.test.ts` — Expected: PASS on existing, then you redesign and keep it green.

- [ ] **Step 3: Implement redesigns (constant budget)**

Redesign in `data/relics.ts` (keep id; update name optional, desc Italian):
```ts
  { id: 'giratempo', name: 'Giratempo', desc: '+8 Velocità; +8 Velocità extra finché la squadra è a vita piena.', rarity: 'comune',
    bonus: { spd: 8 },
    triggers: [{ hook: 'onBattleStart', condition: undefined,
      effects: [/* +8 spd while full-hp — model via an onBattleStart buff status if the engine supports conditional; if not, keep simple: bonus spd 12 unchanged */] }] },
```

> Implementer reality check: if "condizionale a vita piena" can't be expressed with existing EffectSpecs cleanly, **revert giratempo to its original `{ spd: 12 }`** and skip its redesign. Same rule for the others. The goal is *interesting where clean, unchanged where risky.* Prioritize:
> - **mappa-malandrino** → `grantsExecute` (exists, clean): `{ atk: 6 }, keywords:['esecuzione'], grantsExecute:{ threshold:0.5, bonus:0.12 }` — verify power ≈ old +10 atk.
> - **ricordatutto** → onBattleStart shield (pietra-resurrezione pattern exists, clean): keep `{ def:8, spd:8 }`, add small `onBattleStart` shield.
> - **giratempo** → only if clean; else leave as `{ spd: 12 }`.

Optional new relics (only if time/clean): **clessidra-rotta** `{ spd: 20 }, drawback:{ hp: -... }`. Skip **specchio-delle-brame** unless trivially expressible (YAGNI — spec flags it as cut-if-complex).

- [ ] **Step 4: Run structural test + FULL balance re-measure**

Run: `npm run test tests/data/relicRedesign.test.ts` — Expected: PASS.
Run: `npm run test tests/engine/campaignBalanceB.test.ts tests/engine/campaignBalanceRestricted.test.ts` — Expected: **still above floors** (campaignBalanceB ~0.1583, restricted ~0.275 per handoff/memory). If BELOW floor, revert the offending redesign to constant/original budget until green. Document the measured numbers in the commit body.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add data/relics.ts tests/data/relicRedesign.test.ts
git commit -m "feat(relic): redesign base relics at constant power budget

campaignBalanceB=<measured> restricted=<measured> — above floors."
```

---

### Task 11: Full regression + typecheck + handoff update

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Full suite**

Run: `npm run test` — Expected: all green (1152 + new tests).
Run: `npm run typecheck` — Expected: clean.
Run: `npm run build` — Expected: success.

- [ ] **Step 2: If any red, fix before proceeding**

Systematic-debugging on any failure; do not paper over. Balance failures → Task 10 revert rule.

- [ ] **Step 3: Update HANDOFF.md**

Add a "Fatto di recente" bullet: joker espansi (scaling turn/battleWin/allyDead, conditional teamSizeBelow, drawback, onlyTurn), 11 joker nuovi, pool joker separato, nodo reliquia offre joker al 35%, reliquie ridisegnate a budget costante. Note the joker offer channel + `BALANCE.relics.jokerNodeChance` lever.

- [ ] **Step 4: Commit + push**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs(handoff): joker espansi + reliquie ridisegnate shipped"
git push origin master
```

---

## Self-Review notes

- **Spec coverage:** Sez.1 types → T1; Sez.2 flow → T2 (def/spd), T3 (alliesLost), T4 (deltas), T5 (conditional/drawback), T6 (onlyTurn); Sez.3 roster → T8 (jokers), T10 (relics); Sez.4 channel → T7 (split), T9 (relicOffer); Sez.5 testing → each task + T11. All covered.
- **Risk concentration:** T10 is the only balance-sensitive task; it has an explicit revert-to-constant rule and a hard balance gate.
- **Uncertainty flagged for implementers:** exact `EffectSpec` "buff" shape (T8) and `EventBus` reactive API (T6) — both instruct the implementer to inspect existing code and match, not invent. The roster test (T8) deliberately checks copy/existence, not mechanics, so an EffectSpec-shape pivot doesn't break the task.
- **Determinism:** T9 adds one rng draw; noted as acceptable + instructed to update any offer-id-pinning test rather than weaken determinism.
