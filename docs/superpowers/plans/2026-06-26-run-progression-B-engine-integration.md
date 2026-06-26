# Run Progression — Piano B: Integrazione Motore + Bilanciamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Plan A's pure modules into a playable-headless run loop — House + 2 starters growing to 5, an area atlas you route through, fights granting EXP/levels, dedicated recruit/relic nodes — and recalibrate the difficulty so it is genuinely balanced, all without any UI.

**Architecture:** ADDITIVE alongside the existing `nextBattle`/`useRun` loop. New `RunState` fields are optional and the `RunPhase` union is extended, so the old loop keeps compiling and the suite stays green at every commit. A new pure run engine (`runEngine.ts`) + a resolver registry orchestrate the new loop; the combat engine stays untouched (levels apply as a stat map *before* `simulateBattle`). Plan C (UI) consumes this engine and deletes the old loop.

**Tech Stack:** TypeScript, Vitest, existing deterministic `Rng` (forked channels).

## Global Constraints

- **ADDITIVE / suite green:** never break the existing `game/engine/run.ts` (`nextBattle`, `confirmTeam`), `hooks/useRun.ts`, or any current test. New `RunState` fields are OPTIONAL; `RunPhase` is only EXTENDED (no member removed). `npx tsc --noEmit` clean and full `npx vitest run` green after every task.
- **Combat boundary:** do NOT modify `game/engine/combat/*`. Levels reach combat only as `DraftedWizard.stats` already mapped through `leveledStats` BEFORE `simulateBattle`.
- **Determinism:** all generation uses the passed/forked `Rng`. No `Math.random`/`Date.now`. RNG channels forked per `(seed, channel, area, …)` so same seed + same player choices = same run. Per Plan A's note, the run engine forks the map rng per area: `mapRoot.fork(area)`.
- **Balance numbers** live only in `data/constants.ts` (`BALANCE`). Calibration changes touch only `BALANCE`, never test thresholds to fit noise.
- **Single stat-derivation source:** combat-prep and the (future) UI both derive effective stats through `statBreakdown`/`leveledStats` — never two formulas.
- **Reuse, don't duplicate:** reuse `simulateBattle`, `generateEnemyTeam`/`generateBossTeam`/`budgetForStage`, `detectSynergies`, `offerRelics`/`selectEnemyRelics`, `menacePctFor`, `applyBonuses`/`applyRelicBonuses`, `offerRecruits`/`recruitVia`/`replaceMember`, `addExp`/`leveledStats`/`isMilestone`/`applyGrowthChoice`, `generateArea`/`parseAreaNodeId`, `NODE_CATALOG`.
- **Test runner:** `npx vitest run <path>` from repo root (Windows; use the Bash tool for `npx`).
- **Initial numbers** in `BALANCE.leveling`/`map`/`campaign` are starting points; Task 9 calibrates them empirically against the harness bands.

## Existing signatures this plan integrates with (verbatim)

- `simulateBattle(left: DraftedWizard[], right: DraftedWizard[], rng: Rng, opts?: { leftSyn?; rightSyn?; leftRelics?; rightRelics?; rightMenace?: number }): BattleResult` — reads each `dw.stats`.
- `generateEnemyTeam(rng, targetBudget): DraftedWizard[]`; `generateBossTeam(rng, boss): DraftedWizard[]`; `budgetForStage(stage): number`; `powerOf(dw): number` — all in `combat/teamGen.ts`.
- `detectSynergies(team): ActiveSynergy[]` (`synergy.ts`); `applyBonuses(stats, synergies): Stats` (`synergy.ts`); `applyRelicBonuses(stats, team, relics): Stats` (`relics.ts`).
- `offerRelics(rng, owned, _stage): Relic[]`; `selectEnemyRelics(rng, count): ActiveRelic[]` (`relics.ts`).
- `menacePctFor(depth, 'normal'|'elite'|'boss'): number`; channel consts `draftRngChannel=1, combatRngChannel=2, relicOfferRngChannel=3` and `mapRngChannel=4` (`run.ts`/`map.ts`).
- Plan A: `leveledStats(dw): Stats`, `addExp(dw, amount): { dw, milestones: number[] }`, `isMilestone(level): boolean`, `applyGrowthChoice(dw, choice): DraftedWizard` (`leveling.ts`); `offerRecruits(rng, { house, exclude }): DraftedWizard[]`, `recruitVia(dw, via): DraftedWizard`, `replaceMember(team, outId, incoming): DraftedWizard[]` (`recruit.ts`); `generateArea(rng, area, bias): RunNode[]`, `parseAreaNodeId(id): { area, floor, idx }` (`map.ts`); `NODE_CATALOG`, `nodeKind(type)` (`nodeCatalog.ts`); `BALANCE.leveling/map/recruit`.
- `BOSSES` from `@/data/bosses`; `BOSSES[0]` is the final boss; `BOSSES[0].exclusiveSynergy` exists.

---

## File Structure

| File | Responsibility |
|---|---|
| `types/run.ts` (modify) | Add OPTIONAL `house?/area?/log?/pendingLevelUps?/gold?`-free fields to `RunState`; extend `RunPhase` union with `'house'|'starter'|'levelup'|'recruit-node'|'relic-node'|'area-cleared'` |
| `lib/statBreakdown.ts` (new) | Single source for layered effective stats (base→level→synergy→relics) for combat-prep + UI |
| `game/engine/battlePrep.ts` (new) | `battleReadyTeam(team)`: map roster to leveled stats for combat; proportional currentHp |
| `game/engine/resolvers/types.ts` (new) | `NodeResolver`, `ResolverEntry`, `ResolverChoice` interfaces |
| `game/engine/resolvers/combat.ts` (new) | battle/elite/boss resolver: prepares + simulates a fight, returns outcome (reuses nextBattle logic, area-aware) |
| `game/engine/resolvers/recruit.ts` (new) | recruit-node resolver (offer 3, apply pick/replace, log provenance) |
| `game/engine/resolvers/relic.ts` (new) | relic-node resolver (offer 3, apply pick, log) |
| `game/engine/resolvers/index.ts` (new) | `resolverFor(type)` registry mapping `NODE_CATALOG[type].resolverId` → resolver |
| `game/engine/runEngine.ts` (new) | `startRunB`/`confirmStart`/`enterArea`/`resolveCombatNode`/`awardExp`/`applyLevelUp`/`advance`/`clearArea` over the new RunState |
| `lib/runStore.ts` (new) | `saveRun`/`loadRun`/`clearRun` (localStorage, versioned key) |
| `data/constants.ts` (modify) | Per-area budget/menace + EXP calibration (Task 9 only) |
| `tests/engine/*`, `tests/lib/*` (new) | One test file per module + a rewritten `tests/engine/campaignBalanceB.test.ts` |

> The new `RunState` keeps ALL existing fields; new state is added as optional fields so `nextBattle`/`useRun` keep compiling. `confirmStart` sets `phase:'starter'→'map'` via the new engine; the old `confirmTeam`/`nextBattle` remain until Plan C removes them.

---

## Task 1: RunState additive fields + RunPhase extension

**Files:**
- Modify: `types/run.ts`
- Test: `tests/data/runStateShape.test.ts` (new)

**Interfaces:**
- Consumes: existing `RunState`, `RunEvent`, `PendingLevelUp` (from Plan A), `House`.
- Produces: `RunState` with optional `house?: House`, `area?: number`, `log?: RunEvent[]`, `pendingLevelUps?: PendingLevelUp[]`, `teamMax?: number`; `RunPhase` union extended with `'house' | 'starter' | 'levelup' | 'recruit-node' | 'relic-node' | 'area-cleared'`.

- [ ] **Step 1: Write the failing test**

Create `tests/data/runStateShape.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { RunState, RunPhase } from '@/types'

describe('RunState additive shape', () => {
  it('accepts the new optional fields without requiring them', () => {
    const minimal: RunState = {
      seed: 's', phase: 'menu', team: [], activeSynergies: [], stage: 0, relics: [],
    }
    expect(minimal.house).toBeUndefined()
    const full: RunState = {
      ...minimal, house: 'Tassorosso', area: 0, log: [], pendingLevelUps: [], teamMax: 5,
    }
    expect(full.area).toBe(0)
  })
  it('RunPhase includes the new phases', () => {
    const phases: RunPhase[] = ['house', 'starter', 'levelup', 'recruit-node', 'relic-node', 'area-cleared']
    expect(phases).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/runStateShape.test.ts`
Expected: FAIL (tsc error — `house`/new phases not on the types)

- [ ] **Step 3: Edit `types/run.ts`**

Extend `RunPhase` and `RunState` (keep every existing field):

```ts
export type RunPhase =
  | 'menu' | 'draft' | 'team' | 'battle'
  | 'victory' | 'defeat' | 'win'
  // Fase 1 redesign (Plan B):
  | 'house' | 'starter' | 'levelup' | 'recruit-node' | 'relic-node' | 'area-cleared'
```

In `RunState`, add after `currentNodeId?: string`:

```ts
  // Fase 1 redesign (Plan B) — all optional so the legacy loop keeps compiling.
  house?: House
  area?: number
  teamMax?: number
  log?: RunEvent[]
  pendingLevelUps?: PendingLevelUp[]
```

Add `House` to the import from `./index` (or `./wizard`) at the top of `types/run.ts` if not already imported.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/runStateShape.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: tsc + full suite**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all green (legacy loop unaffected)

- [ ] **Step 6: Commit**

```bash
git add types/run.ts tests/data/runStateShape.test.ts
git commit -m "feat(run): additive RunState fields + RunPhase extension for new loop"
```

---

## Task 2: statBreakdown — single layered stat source

**Files:**
- Create: `lib/statBreakdown.ts`
- Test: `tests/lib/statBreakdown.test.ts`

**Interfaces:**
- Consumes: `leveledStats` (`game/engine/leveling`), `applyBonuses` (`game/engine/synergy`), `applyRelicBonuses` (`game/engine/relics`); types `DraftedWizard`, `Stats`, `ActiveSynergy`, `ActiveRelic`.
- Produces:
  - `interface StatBreakdown { base: Stats; afterLevel: Stats; afterSynergy: Stats; total: Stats }`
  - `statBreakdown(dw: DraftedWizard, team: DraftedWizard[], synergies: ActiveSynergy[], relics: ActiveRelic[]): StatBreakdown` — layering order EXACTLY matches combat: base → level → synergy → relics.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/statBreakdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statBreakdown } from '@/lib/statBreakdown'
import { leveledStats } from '@/game/engine/leveling'
import type { DraftedWizard } from '@/types'

function dw(level = 1): DraftedWizard {
  return {
    wizard: { id: 'h', name: 'H', house: 'Grifondoro', role: 'Attaccante', tier: 4, gender: 'm',
      ranges: { hp: [100,100], atk: [50,50], def: [40,40], spd: [30,30] }, spellPool: ['s'] },
    stats: { hp: 100, atk: 50, def: 40, spd: 30 }, maxHp: 100,
    spell: { id: 's' } as DraftedWizard['spell'], level, exp: 0, growthChoices: [],
  }
}

describe('statBreakdown', () => {
  it('base layer equals the wizard base stats', () => {
    expect(statBreakdown(dw(1), [dw(1)], [], []).base).toEqual({ hp: 100, atk: 50, def: 40, spd: 30 })
  })
  it('afterLevel equals leveledStats', () => {
    const w = dw(5)
    expect(statBreakdown(w, [w], [], []).afterLevel).toEqual(leveledStats(w))
  })
  it('with no synergies/relics, total equals afterLevel', () => {
    const w = dw(3)
    const b = statBreakdown(w, [w], [], [])
    expect(b.total).toEqual(b.afterLevel)
  })
  it('layers are monotonic when synergy adds positive bonuses', () => {
    const w = dw(1)
    const syn = [{ synergy: { id: 'x', name: 'x', kind: 'house', family: 'house:Grifondoro',
      requires: { house: 'Grifondoro', count: 1 }, bonus: { def: 20 } }, memberIds: ['h'] }] as any
    const b = statBreakdown(w, [w], syn, [])
    expect(b.afterSynergy.def).toBeGreaterThan(b.afterLevel.def)
    expect(b.total.def).toBe(b.afterSynergy.def) // no relics → relic layer is identity
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/statBreakdown.test.ts`
Expected: FAIL ("does not provide an export named 'statBreakdown'")

- [ ] **Step 3: Implement `lib/statBreakdown.ts`**

```ts
import type { ActiveRelic, ActiveSynergy, DraftedWizard, Stats } from '@/types'
import { leveledStats } from '@/game/engine/leveling'
import { applyBonuses } from '@/game/engine/synergy'
import { applyRelicBonuses } from '@/game/engine/relics'

export interface StatBreakdown {
  base: Stats
  afterLevel: Stats
  afterSynergy: Stats
  total: Stats
}

/**
 * Layered effective stats in the SAME order combat applies them:
 * base → level (leveledStats) → synergy (applyBonuses) → relics (applyRelicBonuses).
 * This is the single source of truth shared by combat-prep and the UI.
 */
export function statBreakdown(
  dw: DraftedWizard, team: DraftedWizard[], synergies: ActiveSynergy[], relics: ActiveRelic[],
): StatBreakdown {
  const base = dw.stats
  const afterLevel = leveledStats(dw)
  const afterSynergy = applyBonuses(afterLevel, synergies)
  const total = applyRelicBonuses(afterSynergy, team, relics)
  return { base, afterLevel, afterSynergy, total }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/statBreakdown.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: tsc + full suite**

Run: `npx tsc --noEmit` → exit 0; `npx vitest run` → green

- [ ] **Step 6: Commit**

```bash
git add lib/statBreakdown.ts tests/lib/statBreakdown.test.ts
git commit -m "feat(run): statBreakdown — single layered stat source (combat+UI)"
```

---

## Task 3: battlePrep — leveled team for combat

**Files:**
- Create: `game/engine/battlePrep.ts`
- Test: `tests/engine/battlePrep.test.ts`

**Interfaces:**
- Consumes: `leveledStats` (`./leveling`); `DraftedWizard`.
- Produces: `battleReadyTeam(team: DraftedWizard[]): DraftedWizard[]` — each member's `stats` replaced by `leveledStats(dw)`, `maxHp` set to the leveled hp, and `currentHp` (if present) scaled by the same hp growth so the wound FRACTION is preserved (clamped to the leveled maxHp). `level`/`exp`/etc are carried through unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/battlePrep.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { leveledStats } from '@/game/engine/leveling'
import type { DraftedWizard } from '@/types'

function dw(level: number, currentHp?: number): DraftedWizard {
  return {
    wizard: { id: 'w'+level, name: 'W', house: 'Corvonero', role: 'Tank', tier: 3, gender: 'f',
      ranges: { hp: [200,200], atk: [40,40], def: [60,60], spd: [20,20] }, spellPool: ['s'] },
    stats: { hp: 200, atk: 40, def: 60, spd: 20 }, maxHp: 200,
    spell: { id: 's' } as DraftedWizard['spell'], level, exp: 0, growthChoices: [], currentHp,
  }
}

describe('battleReadyTeam', () => {
  it('replaces stats with leveledStats and maxHp with leveled hp', () => {
    const out = battleReadyTeam([dw(5)])[0]!
    const ls = leveledStats(dw(5))
    expect(out.stats).toEqual(ls)
    expect(out.maxHp).toBe(ls.hp)
  })
  it('preserves wound fraction when scaling currentHp to the leveled pool', () => {
    // base maxHp 200, currentHp 100 → 50% wounded. Leveled hp scales; currentHp stays ~50%.
    const out = battleReadyTeam([dw(5, 100)])[0]!
    const frac = out.currentHp! / out.maxHp
    expect(frac).toBeGreaterThan(0.49)
    expect(frac).toBeLessThan(0.51)
  })
  it('leaves a full (no currentHp) wizard at full leveled hp', () => {
    const out = battleReadyTeam([dw(3)])[0]!
    expect(out.currentHp).toBeUndefined()
  })
  it('does not mutate the input', () => {
    const team = [dw(4, 80)]
    battleReadyTeam(team)
    expect(team[0]!.stats.hp).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/battlePrep.test.ts`
Expected: FAIL ("does not provide an export named 'battleReadyTeam'")

- [ ] **Step 3: Implement `game/engine/battlePrep.ts`**

```ts
import type { DraftedWizard } from '@/types'
import { leveledStats } from './leveling'

/**
 * Map a run roster to combat-ready units: stats/maxHp reflect levels, and any
 * carried wound is preserved as a FRACTION of the new (leveled) hp pool. The
 * combat engine reads only `stats`/`maxHp`/`currentHp`, so this keeps levels
 * entirely outside the engine. Pure; never mutates the input.
 */
export function battleReadyTeam(team: DraftedWizard[]): DraftedWizard[] {
  return team.map(dw => {
    const ls = leveledStats(dw)
    const baseHp = dw.maxHp > 0 ? dw.maxHp : 1
    const next: DraftedWizard = { ...dw, stats: ls, maxHp: ls.hp }
    if (dw.currentHp !== undefined) {
      const frac = Math.max(0, Math.min(1, dw.currentHp / baseHp))
      next.currentHp = Math.round(ls.hp * frac)
    }
    return next
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/battlePrep.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: tsc + full suite** → both green

- [ ] **Step 6: Commit**

```bash
git add game/engine/battlePrep.ts tests/engine/battlePrep.test.ts
git commit -m "feat(run): battleReadyTeam — apply levels to stats before combat"
```

---

## Task 4: Resolver interfaces + registry

**Files:**
- Create: `game/engine/resolvers/types.ts`
- Create: `game/engine/resolvers/index.ts`
- Test: `tests/engine/resolverRegistry.test.ts`

**Interfaces:**
- Consumes: `RunState`, `RunNode`, `RunNodeType`; `NODE_CATALOG`/`nodeKind` (`../nodeCatalog`).
- Produces:
  - In `types.ts`:
    ```ts
    export type ResolverChoice =
      | { kind: 'recruit-pick'; wizardId: string; replaceId?: string }
      | { kind: 'relic-pick'; relicId: string }
      | { kind: 'combat-ack' }      // combat resolves automatically; ack advances
      | { kind: 'skip' }
    export interface ResolverEntry {
      /** Non-combat: ids the player chooses among; combat: empty. */
      offers: { wizardIds?: string[]; relicIds?: string[] }
      isCombat: boolean
    }
    export interface NodeResolver {
      id: string
      enter(state: RunState, node: RunNode, rng: Rng): ResolverEntry
      resolve(state: RunState, node: RunNode, choice: ResolverChoice, rng: Rng): RunState
    }
    ```
  - In `index.ts`: `registerResolver(r: NodeResolver): void`, `resolverFor(type: RunNodeType): NodeResolver` (throws if none registered), `resolverIds(): string[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/resolverRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { registerResolver, resolverFor, resolverIds } from '@/game/engine/resolvers'
import type { NodeResolver } from '@/game/engine/resolvers/types'
import { nodeKind } from '@/game/engine/nodeCatalog'

const stub: NodeResolver = {
  id: 'battle',
  enter: () => ({ offers: {}, isCombat: true }),
  resolve: (s) => s,
}

describe('resolver registry', () => {
  it('registers and looks up a resolver by node type via the catalog resolverId', () => {
    registerResolver(stub)
    expect(resolverFor('battle').id).toBe(nodeKind('battle').resolverId)
  })
  it('throws for an unregistered node type', () => {
    expect(() => resolverFor('library')).toThrow(/no resolver/i)
  })
  it('lists registered ids', () => {
    expect(resolverIds()).toContain('battle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/resolverRegistry.test.ts`
Expected: FAIL ("does not provide an export named 'registerResolver'")

- [ ] **Step 3: Implement `types.ts` then `index.ts`**

`game/engine/resolvers/types.ts`:

```ts
import type { RunNode, RunNodeType, RunState } from '@/types'
import type { Rng } from '../rng'

export type ResolverChoice =
  | { kind: 'recruit-pick'; wizardId: string; replaceId?: string }
  | { kind: 'relic-pick'; relicId: string }
  | { kind: 'combat-ack' }
  | { kind: 'skip' }

export interface ResolverEntry {
  offers: { wizardIds?: string[]; relicIds?: string[] }
  isCombat: boolean
}

export interface NodeResolver {
  id: string
  enter(state: RunState, node: RunNode, rng: Rng): ResolverEntry
  resolve(state: RunState, node: RunNode, choice: ResolverChoice, rng: Rng): RunState
}

export type { RunNodeType }
```

`game/engine/resolvers/index.ts`:

```ts
import type { RunNodeType } from '@/types'
import { nodeKind } from '../nodeCatalog'
import type { NodeResolver } from './types'

const REGISTRY = new Map<string, NodeResolver>()

export function registerResolver(r: NodeResolver): void {
  REGISTRY.set(r.id, r)
}

export function resolverFor(type: RunNodeType): NodeResolver {
  const id = nodeKind(type).resolverId
  const r = REGISTRY.get(id)
  if (!r) throw new Error(`no resolver registered for node type '${type}' (resolverId '${id}')`)
  return r
}

export function resolverIds(): string[] {
  return [...REGISTRY.keys()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/resolverRegistry.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: tsc + full suite** → green

- [ ] **Step 6: Commit**

```bash
git add game/engine/resolvers/types.ts game/engine/resolvers/index.ts tests/engine/resolverRegistry.test.ts
git commit -m "feat(run): resolver interfaces + registry (catalog-driven dispatch)"
```

---

## Task 5: Combat resolver (battle/elite/boss) + EXP award

**Files:**
- Create: `game/engine/resolvers/combat.ts`
- Test: `tests/engine/combatResolver.test.ts`

**Interfaces:**
- Consumes: `battleReadyTeam` (`../battlePrep`); `simulateBattle` (`../combat/simulate`); `generateEnemyTeam`/`generateBossTeam`/`budgetForStage` (`../combat/teamGen`); `detectSynergies` (`../synergy`); `selectEnemyRelics` (`../relics`); `menacePctFor`, `combatRngChannel`, `applyBattleToRoster` (`../run`); `addExp` (`../leveling`); `BALANCE`; `BOSSES`; `parseAreaNodeId` (`../map`); `NodeResolver`/`ResolverEntry`.
- Produces:
  - `interface CombatResult { result: BattleResult; enemy: DraftedWizard[]; enemySyn: ActiveSynergy[]; isBoss: boolean; survivors: DraftedWizard[]; expEach: number; milestones: { wizardId: string; level: number }[] }`
  - `resolveCombat(state: RunState, node: RunNode, rng: Rng): CombatResult` — pure: prepares leveled team, sims the fight at the node's area-depth difficulty, returns survivors (HP persisted) with EXP applied and any new milestones.
  - `combatResolver: NodeResolver` (registered for battle/elite/boss; `enter` → `{ offers:{}, isCombat:true }`; `resolve` runs `resolveCombat`, writes survivors/exp/log/pendingLevelUps into state).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/combatResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveCombat } from '@/game/engine/resolvers/combat'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import type { RunState, RunNode } from '@/types'

function starterState(): RunState {
  const team = offerRecruits(createRng(1), { house: 'Serpeverde', exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(createRng(1).fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
  return { seed: 's', phase: 'map', team, activeSynergies: [], stage: 0, relics: [],
    map, currentNodeId: map[0]!.id, house: 'Serpeverde', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}
const firstBattleNode = (s: RunState): RunNode =>
  s.map!.find(n => n.type === 'battle' && n.id !== s.currentNodeId) ?? s.map!.find(n => n.type === 'battle')!

describe('resolveCombat', () => {
  it('returns a battle result and awards positive EXP to survivors', () => {
    const s = starterState()
    const node = firstBattleNode(s)
    const out = resolveCombat(s, node, createRng('s').fork(2))
    expect(out.result.winner === 'left' || out.result.winner === 'right').toBe(true)
    expect(out.expEach).toBeGreaterThan(0)
    // survivors carry incremented exp
    for (const dw of out.survivors) expect(dw.exp ?? 0).toBeGreaterThan(0)
  })
  it('is deterministic per (seed, node)', () => {
    const s = starterState()
    const node = firstBattleNode(s)
    const a = resolveCombat(s, node, createRng('s').fork(2)).result.winner
    const b = resolveCombat(s, node, createRng('s').fork(2)).result.winner
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/combatResolver.test.ts`
Expected: FAIL ("does not provide an export named 'resolveCombat'")

- [ ] **Step 3: Implement `game/engine/resolvers/combat.ts`**

```ts
import type { ActiveSynergy, BattleResult, DraftedWizard, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { battleReadyTeam } from '../battlePrep'
import { simulateBattle } from '../combat/simulate'
import { generateEnemyTeam, generateBossTeam, budgetForStage } from '../combat/teamGen'
import { detectSynergies } from '../synergy'
import { selectEnemyRelics } from '../relics'
import { menacePctFor, applyBattleToRoster } from '../run'
import { addExp } from '../leveling'
import { parseAreaNodeId } from '../map'
import { BALANCE } from '@/data/constants'
import { BOSSES } from '@/data/bosses'
import type { NodeResolver } from './types'

export interface CombatResult {
  result: BattleResult
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  isBoss: boolean
  survivors: DraftedWizard[]
  expEach: number
  milestones: { wizardId: string; level: number }[]
}

/** Global progression depth across areas: area * (floors-1) + floor. */
function globalDepth(area: number, floor: number): number {
  return area * (BALANCE.map.floorsPerArea - 1) + floor
}

export function resolveCombat(state: RunState, node: RunNode, rng: Rng): CombatResult {
  const { area, floor } = parseAreaNodeId(node.id)
  const isBoss = node.type === 'boss'
  const depth = globalDepth(area, floor)
  const enemyRng = rng.fork(depth + 1)
  const battleRng = rng.fork(depth + 100)

  const eliteMult = node.type === 'elite' ? BALANCE.map.eliteBudgetMult : 1
  const enemy = isBoss
    ? generateBossTeam(enemyRng, BOSSES[0]!)
    : generateEnemyTeam(enemyRng, Math.round(budgetForStage(depth) * eliteMult))
  const nodeType: 'normal' | 'elite' | 'boss' = isBoss ? 'boss' : (node.type === 'elite' ? 'elite' : 'normal')

  const bossSyn = isBoss ? BOSSES[0]!.exclusiveSynergy : undefined
  const enemySyn = bossSyn
    ? [...detectSynergies(enemy), { synergy: bossSyn, memberIds: enemy.map(d => d.wizard.id) }]
    : detectSynergies(enemy)

  const relicCount = nodeType === 'boss' ? BALANCE.campaign.enemyRelicsBoss
    : nodeType === 'elite' ? BALANCE.campaign.enemyRelicsElite : 0
  const rightRelics = relicCount > 0 ? selectEnemyRelics(rng.fork(depth + 200), relicCount) : []

  // Levels apply HERE, before combat — engine stays pure.
  const ready = battleReadyTeam(state.team)
  const playerSyn = detectSynergies(ready)
  const result = simulateBattle(ready, enemy, battleRng, {
    leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace: menacePctFor(depth, nodeType),
  })

  // Persist HP onto the ORIGINAL (unleveled) roster via the existing helper,
  // then award EXP to survivors.
  const persisted = applyBattleToRoster(state.team, result.finalSnapshot)
  const expEach = isBoss ? BALANCE.leveling.expBoss
    : node.type === 'elite' ? BALANCE.leveling.expElite : BALANCE.leveling.expBattle
  const milestones: { wizardId: string; level: number }[] = []
  const survivors = persisted.map(dw => {
    const { dw: leveled, milestones: ms } = addExp(dw, expEach)
    for (const lv of ms) milestones.push({ wizardId: dw.wizard.id, level: lv })
    return leveled
  })

  return { result, enemy, enemySyn, isBoss, survivors, expEach, milestones }
}

export const combatResolver: NodeResolver = {
  id: 'battle', // registered for battle/elite/boss (they share this resolver id via aliases — see index registration)
  enter: () => ({ offers: {}, isCombat: true }),
  resolve: (state, node, _choice, rng) => {
    const out = resolveCombat(state, node, rng)
    const newLog = [...(state.log ?? []), ...out.milestones.map(m => ({
      area: state.area ?? 0, nodeId: node.id, kind: 'levelMilestone' as const,
      summary: `${m.wizardId} raggiunge il livello ${m.level}`,
    }))]
    const pending = [...(state.pendingLevelUps ?? []), ...out.milestones.map(m => ({ wizardId: m.wizardId, atLevel: m.level }))]
    return {
      ...state,
      team: out.survivors,
      activeSynergies: detectSynergies(out.survivors),
      lastBattle: out.result,
      log: newLog,
      pendingLevelUps: pending,
    }
  },
}
```

> Note on resolver ids: battle/elite/boss all map to `resolverId: 'battle'`? No — the catalog gives them distinct resolverIds (`battle`/`elite`/`boss`). Register the SAME `combatResolver` instance under all three ids in Task 7's engine wiring by creating thin aliases: `registerResolver({ ...combatResolver, id: 'elite' })` and `{ ...combatResolver, id: 'boss' }`. (Done in Task 7, not here.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/combatResolver.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: tsc + full suite** → green

- [ ] **Step 6: Commit**

```bash
git add game/engine/resolvers/combat.ts tests/engine/combatResolver.test.ts
git commit -m "feat(run): combat resolver — leveled team, area-depth difficulty, EXP award"
```

---

## Task 6: Recruit & relic resolvers

**Files:**
- Create: `game/engine/resolvers/recruit.ts`
- Create: `game/engine/resolvers/relic.ts`
- Test: `tests/engine/nodeResolvers.test.ts`

**Interfaces:**
- Consumes: `offerRecruits`/`recruitVia`/`replaceMember` (`../recruit`); `offerRelics` (`../relics`); `detectSynergies` (`../synergy`); `BALANCE`; `NodeResolver`/`ResolverChoice`.
- Produces:
  - `recruitResolver: NodeResolver` (id `'recruit'`): `enter` offers 3 wizard ids (stashed on a per-run cache keyed by node id so `resolve` rebuilds the same trio deterministically); `resolve` with `{kind:'recruit-pick', wizardId, replaceId?}` adds/replaces the picked wizard (via `recruitVia(_, 'Reclutamento')`), updates synergies + log.
  - `relicResolver: NodeResolver` (id `'relic'`): `enter` offers 3 relic ids; `resolve` with `{kind:'relic-pick', relicId}` appends the relic + log.
  - Helper (exported for tests): `recruitOffer(state, node, rng): DraftedWizard[]` and `relicOffer(state, node, rng): Relic[]` — deterministic per `(seed, node.id)`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/nodeResolvers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { recruitResolver, recruitOffer, relicResolver, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { generateArea } from '@/game/engine/map'
import type { RunState } from '@/types'

function baseState(): RunState {
  const team = offerRecruits(createRng(1), { house: 'Tassorosso', exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(createRng(2).fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
  const recruitNode = map.find(n => n.type === 'recruit')!
  return { seed: 's', phase: 'recruit-node', team, activeSynergies: [], stage: 0, relics: [],
    map, currentNodeId: recruitNode.id, house: 'Tassorosso', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}

describe('recruit resolver', () => {
  it('offers 3 distinct candidates, none already on the team', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = recruitOffer(s, node, createRng(s.seed))
    expect(offer).toHaveLength(3)
    const teamIds = new Set(s.team.map(t => t.wizard.id))
    expect(offer.every(o => !teamIds.has(o.wizard.id))).toBe(true)
  })
  it('adds the picked wizard when the team has room, with provenance', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = recruitOffer(s, node, createRng(s.seed))
    const next = recruitResolver.resolve(s, node, { kind: 'recruit-pick', wizardId: offer[0]!.wizard.id }, createRng(s.seed))
    expect(next.team).toHaveLength(3)
    expect(next.team.find(t => t.wizard.id === offer[0]!.wizard.id)?.recruitedVia).toBe('Reclutamento')
  })
  it('replaces a member when the team is full', () => {
    const s = baseState()
    // pad team to teamMax
    const filler = offerRecruits(createRng(9), { house: 'Grifondoro', exclude: new Set(s.team.map(t => t.wizard.id)) })
    s.team = [...s.team, ...filler].slice(0, 5)
    const node = s.map!.find(n => n.type === 'recruit')!
    const offer = recruitOffer(s, node, createRng(s.seed))
    const outId = s.team[0]!.wizard.id
    const next = recruitResolver.resolve(s, node, { kind: 'recruit-pick', wizardId: offer[0]!.wizard.id, replaceId: outId }, createRng(s.seed))
    expect(next.team).toHaveLength(5)
    expect(next.team.some(t => t.wizard.id === outId)).toBe(false)
  })
})

describe('relic resolver', () => {
  it('offers relics and appends the picked one', () => {
    const s = baseState()
    const node = s.map!.find(n => n.type === 'recruit')! // any node id works for determinism here
    const offer = relicOffer(s, node, createRng(s.seed))
    expect(offer.length).toBeGreaterThan(0)
    const next = relicResolver.resolve(s, node, { kind: 'relic-pick', relicId: offer[0]!.id }, createRng(s.seed))
    expect(next.relics).toHaveLength(s.relics.length + 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/nodeResolvers.test.ts`
Expected: FAIL ("does not provide an export named 'recruitResolver'")

- [ ] **Step 3: Implement `recruit.ts` then `relic.ts`**

`game/engine/resolvers/recruit.ts`:

```ts
import type { DraftedWizard, Relic, RunEvent, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { offerRecruits, recruitVia, replaceMember } from '../recruit'
import { offerRelics } from '../relics'
import { detectSynergies } from '../synergy'
import { parseAreaNodeId } from '../map'
import type { NodeResolver, ResolverChoice } from './types'

/** Deterministic per (seed, node id): the same trio every time the node is entered. */
export function recruitOffer(state: RunState, node: RunNode, rng: Rng): DraftedWizard[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(1000 + area * 100 + floor * 10 + idx)
  return offerRecruits(r, { house: state.house!, exclude: new Set(state.team.map(t => t.wizard.id)) })
}

export function relicOffer(state: RunState, node: RunNode, rng: Rng): Relic[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(2000 + area * 100 + floor * 10 + idx)
  return offerRelics(r, state.relics, 0)
}

export const recruitResolver: NodeResolver = {
  id: 'recruit',
  enter: (state, node, rng) => ({ offers: { wizardIds: recruitOffer(state, node, rng).map(d => d.wizard.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'recruit-pick') return state
    const offer = recruitOffer(state, node, rng)
    const picked = offer.find(d => d.wizard.id === choice.wizardId)
    if (!picked) return state
    const recruit = recruitVia(picked, 'Reclutamento')
    const team = choice.replaceId
      ? replaceMember(state.team, choice.replaceId, recruit)
      : [...state.team, recruit]
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'recruit',
      summary: `Recluti ${recruit.wizard.name} (${recruit.wizard.house})` }
    return { ...state, team, activeSynergies: detectSynergies(team), log: [...(state.log ?? []), ev] }
  },
}

export const relicResolver: NodeResolver = {
  id: 'relic',
  enter: (state, node, rng) => ({ offers: { relicIds: relicOffer(state, node, rng).map(r => r.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'relic-pick') return state
    const offer = relicOffer(state, node, rng)
    const relic = offer.find(r => r.id === choice.relicId)
    if (!relic) return state
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'relic',
      summary: `Ottieni la reliquia ${relic.name ?? relic.id}` }
    return { ...state, relics: [...state.relics, { relic, stageObtained: state.stage }], log: [...(state.log ?? []), ev] }
  },
}
```

> `relic.ts` is intentionally re-exported through `recruit.ts` above to keep one import for tests; create `game/engine/resolvers/relic.ts` re-exporting for symmetry:
> ```ts
> export { relicResolver, relicOffer } from './recruit'
> ```
> (Both live in `recruit.ts` to share `parseAreaNodeId`; the `relic.ts` file is a thin re-export so the registry import reads naturally.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/nodeResolvers.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: tsc + full suite** → green

- [ ] **Step 6: Commit**

```bash
git add game/engine/resolvers/recruit.ts game/engine/resolvers/relic.ts tests/engine/nodeResolvers.test.ts
git commit -m "feat(run): recruit + relic node resolvers (deterministic offers, provenance)"
```

---

## Task 7: Run engine — start, dispatch, level-up, area transition

**Files:**
- Create: `game/engine/runEngine.ts`
- Test: `tests/engine/runEngine.test.ts`

**Interfaces:**
- Consumes: `generateArea` (`./map`); `offerRecruits`/`recruitVia` (`./recruit`); `detectSynergies` (`./synergy`); `applyGrowthChoice` (`./leveling`); `combatResolver`/`resolveCombat` (`./resolvers/combat`); `recruitResolver`/`relicResolver` (`./resolvers/recruit`/`relic`); `registerResolver`/`resolverFor` (`./resolvers`); `reachableFrom` logic (replicate from `useRun`); `mapRngChannel`; `BALANCE`; `RunState`, `RunNode`, `GrowthChoice`.
- Produces:
  - `startRunB(seed: string): RunState` — `phase:'house'`, empty team, `teamMax: BALANCE.draft.teamSize`, `area:0`, `log:[]`, `pendingLevelUps:[]`.
  - `chooseStarters(state, house: House, starterIds: string[], rng): RunState` — sets house, builds the 2 starters (level 1, `recruitedVia:'iniziale'`), generates area 0, `phase:'map'`, positions at entry node.
  - `starterOffer(seed: string, house: House): DraftedWizard[]` — the house pool the UI picks 2 from (deterministic).
  - `reachable(state): RunNode[]` — legal next nodes from `currentNodeId`.
  - `moveTo(state, nodeId): RunState` — validates edge, sets `currentNodeId`, sets `phase` from node type (combat→`battle`, recruit→`recruit-node`, relic→`relic-node`, boss→`battle`).
  - `resolveCurrent(state, choice, rng): RunState` — dispatches via `resolverFor(node.type)`, marks node resolved; after a combat node sets phase to `levelup` if `pendingLevelUps` non-empty else `victory`/`area-cleared`/`win`.
  - `applyLevelUp(state, wizardId, choice: GrowthChoice): RunState` — pops one `pendingLevelUp`, applies the growth, returns to `levelup` (more pending) or `victory`.
  - `clearAreaAndAdvance(state, rng): RunState` — on area boss win, if more areas: generate next area (bias from team size) `phase:'map'`; else `phase:'win'`.
  - `registerCoreResolvers()` — idempotently registers battle/elite/boss (aliased combatResolver) + recruit + relic.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/runEngine.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  applyLevelUp, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

beforeAll(() => registerCoreResolvers())

describe('run engine — start & map', () => {
  it('startRunB begins at house selection with an empty team', () => {
    const s = startRunB('seed-1')
    expect(s.phase).toBe('house')
    expect(s.team).toHaveLength(0)
    expect(s.teamMax).toBe(BALANCE.draft.teamSize)
  })
  it('chooseStarters builds a 2-wizard team and an area-0 map', () => {
    const offer = starterOffer('seed-1', 'Grifondoro')
    expect(offer.every(d => d.wizard.house === 'Grifondoro')).toBe(true)
    const s = chooseStarters(startRunB('seed-1'), 'Grifondoro', [offer[0]!.wizard.id, offer[1]!.wizard.id], createRng('seed-1'))
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(2)
    expect(s.team.every(d => d.level === 1 && d.recruitedVia === 'iniziale')).toBe(true)
    expect(s.map!.length).toBeGreaterThan(0)
    expect(s.currentNodeId).toBe(s.map!.find(n => n.id.endsWith('f0n0'))!.id)
  })
  it('reachable returns the entry node neighbors', () => {
    const offer = starterOffer('seed-1', 'Grifondoro')
    const s = chooseStarters(startRunB('seed-1'), 'Grifondoro', offer.slice(0, 2).map(d => d.wizard.id), createRng('seed-1'))
    expect(reachable(s).length).toBeGreaterThan(0)
  })
})

describe('run engine — node resolution', () => {
  it('moving to a battle node and resolving advances to victory or levelup', () => {
    const offer = starterOffer('seed-7', 'Serpeverde')
    let s = chooseStarters(startRunB('seed-7'), 'Serpeverde', offer.slice(0, 2).map(d => d.wizard.id), createRng('seed-7'))
    const target = reachable(s).find(n => n.type === 'battle') ?? reachable(s)[0]!
    s = moveTo(s, target.id)
    expect(['battle']).toContain(s.phase)
    s = resolveCurrent(s, { kind: 'combat-ack' }, createRng('seed-7').fork(2))
    expect(['victory', 'levelup', 'defeat']).toContain(s.phase)
    // resolved flag set
    expect(s.map!.find(n => n.id === target.id)!.resolved).toBe(true)
  })
})

describe('run engine — level up', () => {
  it('applyLevelUp drains the pending queue and boosts the chosen stat', () => {
    // force a milestone by handing a wizard enough exp via repeated battles is slow;
    // instead seed a pendingLevelUp directly and assert the drain + growth.
    const offer = starterOffer('seed-3', 'Corvonero')
    let s = chooseStarters(startRunB('seed-3'), 'Corvonero', offer.slice(0, 2).map(d => d.wizard.id), createRng('seed-3'))
    const wizId = s.team[0]!.wizard.id
    s = { ...s, phase: 'levelup', pendingLevelUps: [{ wizardId: wizId, atLevel: 3 }] }
    const before = s.team[0]!.growthChoices?.length ?? 0
    s = applyLevelUp(s, wizId, { atLevel: 3, kind: 'atk' })
    expect(s.pendingLevelUps).toHaveLength(0)
    expect(s.team.find(t => t.wizard.id === wizId)!.growthChoices!.length).toBe(before + 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/runEngine.test.ts`
Expected: FAIL ("does not provide an export named 'startRunB'")

- [ ] **Step 3: Implement `game/engine/runEngine.ts`**

```ts
import type { DraftedWizard, GrowthChoice, House, RunNode, RunState } from '@/types'
import type { Rng } from './rng'
import { createRng } from './rng'
import { mapRngChannel } from './map'
import { generateArea, parseAreaNodeId } from './map'
import { createDraftPool } from './draft'
import { draftWizard } from './statRoll'
import { offerRecruits, recruitVia } from './recruit'
import { detectSynergies } from './synergy'
import { applyGrowthChoice } from './leveling'
import { combatResolver } from './resolvers/combat'
import { recruitResolver, relicResolver } from './resolvers/recruit'
import { registerResolver, resolverFor } from './resolvers'
import type { ResolverChoice } from './resolvers/types'
import { BALANCE } from '@/data/constants'

let registered = false
export function registerCoreResolvers(): void {
  if (registered) return
  registerResolver(combatResolver)                 // id 'battle'
  registerResolver({ ...combatResolver, id: 'elite' })
  registerResolver({ ...combatResolver, id: 'boss' })
  registerResolver(recruitResolver)                // id 'recruit'
  registerResolver(relicResolver)                  // id 'relic'
  registered = true
}

export function startRunB(seed: string): RunState {
  return { seed, phase: 'house', team: [], activeSynergies: [], stage: 0, relics: [],
    area: 0, teamMax: BALANCE.draft.teamSize, log: [], pendingLevelUps: [] }
}

/** Deterministic house pool the player picks 2 starters from. */
export function starterOffer(seed: string, house: House): DraftedWizard[] {
  const rng = createRng(seed).fork(draftChannelForStarters)
  const pool = createDraftPool().filter(w => w.house === house)
  return pool.map(w => draftWizard(rng, w, true))
}
const draftChannelForStarters = 11

function areaRng(seed: string, area: number): Rng {
  return createRng(seed).fork(mapRngChannel).fork(area)
}

export function chooseStarters(state: RunState, house: House, starterIds: string[], _rng: Rng): RunState {
  const offer = starterOffer(state.seed, house)
  const starters = starterIds
    .map(id => offer.find(d => d.wizard.id === id))
    .filter((d): d is DraftedWizard => !!d)
    .map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(areaRng(state.seed, 0), 0, { teamSize: starters.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  return { ...state, house, area: 0, team: starters, activeSynergies: detectSynergies(starters),
    map, currentNodeId: entry.id, phase: 'map' }
}

export function reachable(state: RunState): RunNode[] {
  const cur = state.map?.find(n => n.id === state.currentNodeId)
  if (!cur) return []
  return cur.next.map(id => state.map!.find(n => n.id === id)).filter((n): n is RunNode => !!n)
}

const phaseForNode = (t: RunNode['type']): RunState['phase'] =>
  t === 'recruit' ? 'recruit-node' : t === 'relic' ? 'relic-node' : 'battle'

export function moveTo(state: RunState, nodeId: string): RunState {
  const cur = state.map?.find(n => n.id === state.currentNodeId)
  if (!cur || !cur.next.includes(nodeId)) throw new Error(`illegal move ${state.currentNodeId} -> ${nodeId}`)
  const target = state.map!.find(n => n.id === nodeId)!
  return { ...state, currentNodeId: nodeId, phase: phaseForNode(target.type) }
}

function markResolved(state: RunState, nodeId: string): RunNode[] {
  return state.map!.map(n => (n.id === nodeId ? { ...n, resolved: true } : n))
}

export function resolveCurrent(state: RunState, choice: ResolverChoice, rng: Rng): RunState {
  const node = state.map!.find(n => n.id === state.currentNodeId)!
  const resolver = resolverFor(node.type)
  const resolved = resolver.resolve(state, node, choice, rng)
  const map = markResolved(resolved, node.id)
  const wiped = resolved.team.length === 0
  let phase: RunState['phase']
  if (wiped) phase = 'defeat'
  else if (node.type === 'boss') phase = 'win' // single-area win; clearAreaAndAdvance handles multi-area below
  else if ((resolved.pendingLevelUps?.length ?? 0) > 0) phase = 'levelup'
  else phase = 'victory'
  return { ...resolved, map, phase }
}

export function applyLevelUp(state: RunState, wizardId: string, choice: GrowthChoice): RunState {
  const team = state.team.map(dw => (dw.wizard.id === wizardId ? applyGrowthChoice(dw, choice) : dw))
  const queue = (state.pendingLevelUps ?? []).slice(1)
  return { ...state, team, activeSynergies: detectSynergies(team),
    pendingLevelUps: queue, phase: queue.length > 0 ? 'levelup' : 'victory' }
}

/** Called after a non-boss victory acknowledged, or after a boss win to roll the next area. */
export function clearAreaAndAdvance(state: RunState, _rng: Rng): RunState {
  const lastArea = (BALANCE.map.areas - 1)
  const cur = state.area ?? 0
  if (cur >= lastArea) return { ...state, phase: 'win' }
  const nextArea = cur + 1
  const map = generateArea(areaRng(state.seed, nextArea), nextArea,
    { teamSize: state.team.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  return { ...state, area: nextArea, map, currentNodeId: entry.id, phase: 'map' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/runEngine.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: tsc + full suite** → green

- [ ] **Step 6: Commit**

```bash
git add game/engine/runEngine.ts tests/engine/runEngine.test.ts
git commit -m "feat(run): run engine — start, starters, node dispatch, level-up, area transition"
```

---

## Task 8: Persistence — runStore (localStorage)

**Files:**
- Create: `lib/runStore.ts`
- Test: `tests/lib/runStore.test.ts`

**Interfaces:**
- Consumes: `RunState`.
- Produces:
  - `const RUN_KEY = 'harry:run:v1'`
  - `saveRun(state: RunState): void` — JSON-serialize under `RUN_KEY` (no-op if `localStorage` is undefined).
  - `loadRun(): RunState | null` — parse; return `null` if absent, malformed, or wrong `version`.
  - `clearRun(): void`
  - Serialized envelope `{ version: 1, state }` so future migrations can reject cleanly.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/runStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveRun, loadRun, clearRun, RUN_KEY } from '@/lib/runStore'
import type { RunState } from '@/types'

// jsdom provides localStorage in vitest's default environment; if not, shim it.
const mem: Record<string, string> = {}
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k]
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

const sample: RunState = {
  seed: 's', phase: 'map', team: [], activeSynergies: [], stage: 0, relics: [],
  house: 'Tassorosso', area: 1, teamMax: 5, log: [], pendingLevelUps: [],
}

describe('runStore', () => {
  it('round-trips a run through save/load', () => {
    saveRun(sample)
    expect(loadRun()).toEqual(sample)
  })
  it('returns null when nothing is saved', () => {
    expect(loadRun()).toBeNull()
  })
  it('returns null for a malformed payload', () => {
    localStorage.setItem(RUN_KEY, '{not json')
    expect(loadRun()).toBeNull()
  })
  it('returns null for an incompatible version envelope', () => {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: 999, state: sample }))
    expect(loadRun()).toBeNull()
  })
  it('clearRun removes the saved run', () => {
    saveRun(sample)
    clearRun()
    expect(loadRun()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/runStore.test.ts`
Expected: FAIL ("does not provide an export named 'saveRun'")

- [ ] **Step 3: Implement `lib/runStore.ts`**

```ts
import type { RunState } from '@/types'

export const RUN_KEY = 'harry:run:v1'
const VERSION = 1

function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function saveRun(state: RunState): void {
  const store = ls()
  if (!store) return
  store.setItem(RUN_KEY, JSON.stringify({ version: VERSION, state }))
}

export function loadRun(): RunState | null {
  const store = ls()
  if (!store) return null
  const raw = store.getItem(RUN_KEY)
  if (!raw) return null
  try {
    const env = JSON.parse(raw) as { version?: number; state?: RunState }
    if (env.version !== VERSION || !env.state) return null
    return env.state
  } catch {
    return null
  }
}

export function clearRun(): void {
  ls()?.removeItem(RUN_KEY)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/runStore.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: tsc + full suite** → green

- [ ] **Step 6: Commit**

```bash
git add lib/runStore.ts tests/lib/runStore.test.ts
git commit -m "feat(run): runStore — versioned localStorage persistence"
```

---

## Task 9: Balance harness rewrite + calibration

**Files:**
- Create: `tests/engine/campaignBalanceB.test.ts`
- Modify (calibration ONLY): `data/constants.ts` (`BALANCE.campaign`, `BALANCE.leveling`, `BALANCE.map` numeric values)

**Interfaces:**
- Consumes: the whole new engine (`startRunB`/`chooseStarters`/`reachable`/`moveTo`/`resolveCurrent`/`applyLevelUp`/`clearAreaAndAdvance`/`registerCoreResolvers`); `starterOffer`; `recruitOffer`/`relicOffer`; `powerOf` (`../combat/teamGen`).
- Produces: a deterministic simulation of N greedy runs through the NEW loop, asserting a difficulty band. This is the first-class mitigation for the two-axis (EXP + recruit) growth risk.

**Greedy player policy (model an upper-bound player):**
1. House = `Grifondoro` (fixed, for determinism). Starters = the 2 highest-`powerOf` of the house offer.
2. At each `map` phase: among `reachable`, prefer a `recruit` node while team < teamMax, else prefer `relic` while relics are few (< 3), else the highest-reward combat (`elite` > `battle`); boss when it's the only option.
3. Combat: `moveTo` → `resolveCurrent({kind:'combat-ack'})`. On `levelup`: for each pending, `applyLevelUp` choosing `kind:'atk'`. On `victory`: if current node was the area boss, `clearAreaAndAdvance`; else continue routing. On `recruit-node`: pick the highest-`powerOf` offered (replace lowest-power member if full). On `relic-node`: pick the first offered.
4. Stop at `win` or `defeat`.

- [ ] **Step 1: Write the harness test (initially expected to need calibration)**

Create `tests/engine/campaignBalanceB.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  applyLevelUp, clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import type { RunNode, RunState } from '@/types'

beforeAll(() => registerCoreResolvers())

function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  const incomplete = (s.team.length < (s.teamMax ?? 5))
  if (incomplete) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'elite')
    ?? opts.find(n => n.type === 'battle')
    ?? opts.find(n => n.type === 'boss')
    ?? opts[0]!
}

function runOne(seed: string): 'win' | 'defeat' {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Grifondoro')
  const starters = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starters, createRng(seed))
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') return 'win'
    if (s.phase === 'defeat') return 'defeat'
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') { s = resolveCurrent(s, { kind: 'combat-ack' }, rng); continue }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const best = [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed)); 
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: off[0]!.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'levelup') {
      const p = s.pendingLevelUps![0]!
      s = applyLevelUp(s, p.wizardId, { atLevel: p.atLevel, kind: 'atk' }); continue
    }
    if (s.phase === 'victory') {
      const wasBoss = node.type === 'boss'
      s = wasBoss ? clearAreaAndAdvance(s, createRng(seed)) : { ...s, phase: 'map' }
      continue
    }
    break
  }
  return 'defeat'
}

describe('campaign balance (new loop)', () => {
  const N = 120
  const outcomes = Array.from({ length: N }, (_, i) => runOne(`run-${i}`))
  const winRate = outcomes.filter(o => o === 'win').length / N

  it('is winnable but not trivial for a near-optimal player', () => {
    expect(winRate).toBeGreaterThan(0.15)
    expect(winRate).toBeLessThan(0.55)
  })
  it('is deterministic (same seeds → same outcomes)', () => {
    const again = Array.from({ length: N }, (_, i) => runOne(`run-${i}`))
    expect(again).toEqual(outcomes)
  })
})
```

- [ ] **Step 2: Run the harness and OBSERVE the win rate**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`
Expected: the determinism test PASSES; the band test may FAIL initially, printing the actual `winRate`. Record the number.

- [ ] **Step 3: Calibrate via `BALANCE` only**

Adjust ONLY `data/constants.ts` numbers to bring `winRate` into `(0.15, 0.55)` — a "winnable but earned" band for the upper-bound greedy player. Levers, in order of preference:
- `BALANCE.campaign.baseBudget` / `budgetStep` — enemy strength ramp (raise → harder).
- `BALANCE.campaign.menacePerStage` / `menaceBossMult` — late/boss bite.
- `BALANCE.leveling.expBattle` / `expElite` / `autoGrowthPct` — player growth rate (raise → easier).
- `BALANCE.map.eliteBudgetMult` — elite reward-vs-risk.

Re-run after each change. Do NOT edit the test thresholds to fit; move the band only if, after genuine tuning, you and the controller agree the target itself is wrong (escalate that as a plan/spec question).

- [ ] **Step 4: Confirm the band holds AND determinism holds (double run)**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`
Expected: BOTH tests PASS. Run it a second time to confirm identical results.

- [ ] **Step 5: Full suite + tsc**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all green (the LEGACY `campaignBalance.test.ts` still passes — its calibration is independent of the new loop; if a shared `BALANCE.campaign` change moved the legacy band, re-check the legacy test and, if needed, note it for the controller rather than silently retuning it).

- [ ] **Step 6: Commit**

```bash
git add tests/engine/campaignBalanceB.test.ts data/constants.ts
git commit -m "test(run): new-loop balance harness + calibration (two-axis growth)"
```

> ⚠️ Shared-constant caution: `BALANCE.campaign` is read by BOTH the legacy `campaignBalance.test.ts` and the new harness. If calibrating the new loop pushes the legacy band out, that is a real signal (the legacy loop is being retired in Plan C) — report it to the controller; do NOT silently rewrite legacy thresholds in this task.

---

## Definition of Done (Piano B)

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all green (legacy + new)
- [ ] No file under `game/engine/combat/*` modified
- [ ] Legacy `run.ts`/`useRun.ts`/`nextBattle` still compile and pass (removed only in Plan C)
- [ ] New loop runs headless end-to-end (start → 3 areas → win/defeat) deterministically, within the balance band
- [ ] Delivered: `statBreakdown`, `battlePrep`, resolver registry + combat/recruit/relic resolvers, `runEngine`, `runStore`, rewritten balance harness

## Cosa NON è in questo piano (→ Piano C)

UI: HouseSelect/StarterPick/Recruit/Relic/LevelUp screens, extended MapScreen (Hogwarts theming is Fase 4), `useRun` FSM rewrite onto `runEngine`, autosave wiring (`saveRun` on each transition) + "Continua run" menu entry, and the REMOVAL of the legacy `nextBattle`/`confirmTeam`/old `useRun` path once the UI is switched over. Also defer: unify `generateArea`/`generateMap` edge-wiring + add the no-orphan (incoming-edge) test (Plan A carry-over).
