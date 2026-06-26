# Brutal Difficulty — Enemy Empowerment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the campaign brutal (real clear rate ~10–15%, merciless boss, gentle start) by empowering enemies — a per-stage "menace" stat buff for all enemies, real relics for elite/boss enemies, a meaner boss, and retuned difficulty knobs — then calibrate against a balance test that finally models the player's relics.

**Architecture:** First de-asymmetrize the relic engine so relics can belong to either side (today they are hardcoded to `left`). Then add two enemy power sources that ride on it: an abstract per-stage "menace" multiplier applied to enemy stats, and real relics assigned to elite/boss enemy teams. Wire the boss's existing (currently dormant) exclusive synergy. Finally, update the campaign balance test to give the greedy player relics and the enemies their new power, and calibrate the numeric knobs until the brutal band passes.

**Tech Stack:** TypeScript, Vitest. Pure-function engine under `game/engine/`, data under `data/`.

## Global Constraints

- Difficulty comes from ENEMIES only. Do NOT nerf the player: no changes to player relic power, the HP-tie tiebreak (`>=` stays), or combat margins.
- RNG/log parity: when `opts.rightRelics` is empty/absent and `opts.rightMenace` is 0/absent, `simulateBattle` must draw the SAME rng sequence and emit the SAME log as before this work (existing battles unchanged). Guard every new code path so a zero-relic / zero-menace enemy draws no extra rng and logs nothing new.
- Whip curve: stage 1 stays gentle (`firstStageWinRate > 0.65`); difficulty ramps steeply to a merciless boss.
- Target band (test, with relics modeled on both sides): `clearRate` in [0.08, 0.18]; `firstStageWinRate > 0.65`; `bossWinRate` in (0, 0.30); `cappedRate < 0.05`.
- Enemy relics are selected deterministically per seed; no duplicate relic on the same enemy team.
- Numeric difficulty values (menace curve, enemy relic counts, budgetStep, difficultySpan, elite settings, boss budget/hpMult) are CALIBRATION OUTPUTS — set structure first, tune in Task 6.
- `npm test` = full vitest; single file `npx vitest run <path>`; typecheck `npm run typecheck`.

---

## File Structure

- `game/engine/relics.ts` — `registerRelicTriggers` gains an owner-`side` param; add `selectEnemyRelics(rng, count)`.
- `game/engine/combat/simulate.ts` — accept `opts.rightRelics` and `opts.rightMenace`; apply relic bonuses/triggers/regen and the onBattleStart block to the RIGHT team; apply menace multiplier to enemy stats; extend onHpThreshold registration to right relics.
- `data/constants.ts` — new `campaign.menace*` and `campaign.enemyRelics*`; retuned difficulty knobs (Task 6).
- `data/bosses.ts` — meaner boss values (Task 6).
- `game/engine/run.ts` — wire boss `exclusiveSynergy` into enemy synergies; compute `rightMenace` and enemy relics per node; pass them to `simulateBattle`.
- `tests/engine/combat/relicSide.test.ts` (new) — bilateral relic behavior + parity.
- `tests/engine/menace.test.ts` (new) — menace scaling.
- `tests/engine/campaignBalance.test.ts` — model relics on both sides; brutal band.
- Other seed-dependent tests — fixture refresh (Task 7).

**Task order:** 1 (relic engine) → 2 (menace) → 3 (enemy relics) → 4 (boss synergy + run wiring) → 5 (test models relics) → 6 (calibrate knobs) → 7 (fixture refresh). 1 is the foundation; 6 is where numbers land once everything is measurable.

---

### Task 1: De-asymmetrize the relic engine (relics can belong to either side)

**Files:**
- Modify: `game/engine/relics.ts` (`registerRelicTriggers` signature)
- Modify: `game/engine/combat/simulate.ts` (right-side relic application + parity)
- Test: `tests/engine/combat/relicSide.test.ts` (create)

**Interfaces:**
- Produces: `registerRelicTriggers(bus, team, relics, side: Side = 'left')` — listeners gate on the given owner side instead of a hardcoded `'left'`.
- Produces: `simulateBattle(left, right, rng, opts)` now reads `opts.rightRelics?: ActiveRelic[]` (default `[]`), applying that team's relic bonuses, regen, triggers, and onBattleStart effects to the RIGHT units.
- Consumes: existing `applyRelicBonuses(stats, team, relics)` and `totalRelicRegen(team, relics)` (already side-agnostic — reuse as-is).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/combat/relicSide.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

function team(ids: string[]): DraftedWizard[] {
  return ids.map((id, i) => draftWizard(createRng(`t-${id}-${i}`), WIZARD_BY_ID[id]!))
}

describe('bilateral relics', () => {
  it('a right-side relic does not change the left team, and parity holds with no right relics', () => {
    const left = team(['harry', 'sirius', 'lupin', 'mcgonagall', 'snape'])
    const right = team(['voldemort', 'bellatrix', 'lucius', 'snape', 'sirius'])

    // Baseline: no right relics.
    const base = simulateBattle(left, right, createRng('b'), {})

    // Same battle, but the ENEMY gets a strong flat-stat relic.
    const enemyRelic: ActiveRelic[] = [{ relic: RELIC_BY_ID['mappa-malandrino']!, stageObtained: 0 }]
    const withEnemyRelic = simulateBattle(left, right, createRng('b'), { rightRelics: enemyRelic })

    // The enemy got stronger → the outcome (winner or turn count or final HP) must differ.
    const baseRightHp = base.finalSnapshot.filter(u => u.side === 'right').reduce((s, u) => s + u.hp, 0)
    const buffRightHp = withEnemyRelic.finalSnapshot.filter(u => u.side === 'right').reduce((s, u) => s + u.hp, 0)
    expect(buffRightHp === baseRightHp && base.winner === withEnemyRelic.winner && base.turns === withEnemyRelic.turns).toBe(false)
  })

  it('parity: identical result when rightRelics is absent', () => {
    const left = team(['harry', 'sirius', 'lupin', 'mcgonagall', 'snape'])
    const right = team(['voldemort', 'bellatrix', 'lucius', 'snape', 'sirius'])
    const a = simulateBattle(left, right, createRng('p'), { leftRelics: [] })
    const b = simulateBattle(left, right, createRng('p'), { leftRelics: [], rightRelics: [] })
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
  })
})
```

(`RELIC_BY_ID` is exported from `@/data/relics` — confirmed.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/relicSide.test.ts`
Expected: FAIL — the enemy relic currently has no effect (right relics ignored), so the first test's outcome is identical.

- [ ] **Step 3: Add the owner-side param to `registerRelicTriggers`**

In `game/engine/relics.ts`, change the signature and the two `'left'` gates. Add `Side` to the type import (`import type { ActiveRelic, DraftedWizard, RelicCondition, Stats, Side } from '@/types'`). Then:

```ts
export function registerRelicTriggers(
  bus: EventBus, team: DraftedWizard[], relics: ActiveRelic[], side: Side = 'left',
): void {
  for (const { relic } of relics) {
    for (const trig of relic.triggers ?? []) {
      const gate = trig.condition ?? relic.condition
      if (!relicMatchesCondition(team, gate)) continue
      if (trig.effects) {
        const specs = trig.effects
        if (trig.hook === 'onBattleStart' || trig.hook === 'onHit'
          || trig.hook === 'onHeal' || trig.hook === 'onDeath'
          || trig.hook === 'onAllyDeath' || trig.hook === 'onTurnStart'
          || trig.hook === 'onTurnEnd' || trig.hook === 'onHpThreshold') {
          bus.onReactive(trig.hook, (ctx) => (ctx.side === side ? specs : []))
        }
      }
      if (trig.modifier
        && (trig.hook === 'modifyOutgoingDamage' || trig.hook === 'modifyIncomingDamage'
          || trig.hook === 'modifyHealing')) {
        const { mult = 1, flat = 0 } = trig.modifier
        bus.onModifier(trig.hook, (v, ctx) => (ctx.side === side ? v * mult + flat : v))
      }
    }
  }
}
```

- [ ] **Step 4: Apply right relics in `simulateBattle`**

In `game/engine/combat/simulate.ts`:

(a) After `const leftRelics = opts.leftRelics ?? []` add:
```ts
  const rightRelics = opts.rightRelics ?? []
```

(b) Pass right relics into the right battle units. Change:
```ts
  const R = toBattleUnits(right, 'right', rightSyn)
```
to:
```ts
  const R = toBattleUnits(right, 'right', rightSyn, rightRelics)
```
(`toBattleUnits` already accepts a `relics` param and runs `applyRelicBonuses` — no signature change needed.)

(c) Add right relic regen. Change the `regen` object's `right` line:
```ts
    right: totalRegen(rightSyn) + totalRelicRegen(right, rightRelics),
```

(d) Register right triggers. After `registerRelicTriggers(bus, left, leftRelics)` add:
```ts
  registerRelicTriggers(bus, left, leftRelics, 'left')
  registerRelicTriggers(bus, right, rightRelics, 'right')
```
(Replace the existing single `registerRelicTriggers(bus, left, leftRelics)` line with these two; the explicit `'left'` is harmless and clear.)

(e) Mirror the onBattleStart block for the right team. The existing block applies left-gated onBattleStart specs to `L`. Immediately after it, add an analogous block for `R` (guarded by `specs.length` so an empty enemy-relic set draws no rng and logs nothing):
```ts
  {
    const ctxR = (u: BattleUnit): HookCtx => ({ turn: 0, actor: u, side: 'right', flags: [] })
    const specsR = bus.collectReactive('onBattleStart', ctxR(R[0] ?? ({} as BattleUnit)))
    for (const eff of specsR) {
      for (const unit of R) {
        const flags: LogFlag[] = []
        const r = EFFECT_HANDLERS[eff.kind]({ rng, turn: 0, actor: unit, target: unit, flags }, eff)
        pushLog({
          turn: 0, actorId: unit.wizard.id, actorSide: unit.side, action: 'Reliquia',
          targetId: unit.wizard.id, targetSide: unit.side, type: 'system', value: r.value, flags,
        })
      }
    }
  }
```

(f) Extend onHpThreshold registration to right relics so enemy threshold triggers can fire. Change:
```ts
  const registeredThresholds = leftRelics.flatMap(({ relic }) =>
    (relic.triggers ?? [])
      .filter(t => t.hook === 'onHpThreshold' && typeof t.threshold === 'number')
      .map(t => t.threshold!),
  )
```
to include both sides:
```ts
  const registeredThresholds = [...leftRelics, ...rightRelics].flatMap(({ relic }) =>
    (relic.triggers ?? [])
      .filter(t => t.hook === 'onHpThreshold' && typeof t.threshold === 'number')
      .map(t => t.threshold!),
  )
```

(g) Add `rightRelics` to the `opts` type in the `simulateBattle` signature. Find the opts type:
```ts
  opts: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[]; leftRelics?: ActiveRelic[] } = {},
```
and extend it to:
```ts
  opts: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[]; leftRelics?: ActiveRelic[]; rightRelics?: ActiveRelic[]; rightMenace?: number } = {},
```
(`rightMenace` is added now to avoid touching this signature again in Task 2; it is unused until Task 2.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/engine/combat/relicSide.test.ts`
Expected: PASS (2 tests) — enemy relic changes the outcome; parity holds with no right relics.

- [ ] **Step 6: Full suite + typecheck (parity check)**

Run: `npm test` then `npm run typecheck`
Expected: PASS with NO fixtures changed. The parity guarantee means existing battles are byte-identical. If ANY existing battle test shifted, the parity guard was violated — STOP and fix the new code (do not refresh fixtures here).

- [ ] **Step 7: Commit**

```bash
git add game/engine/relics.ts game/engine/combat/simulate.ts tests/engine/combat/relicSide.test.ts
git commit -m "feat(combat): relics can belong to either side (rightRelics)"
```

---

### Task 2: Menace — per-stage abstract stat buff for all enemies

**Files:**
- Modify: `data/constants.ts` (add `campaign.menace*`)
- Modify: `game/engine/combat/simulate.ts` (`toBattleUnits` applies a menace multiplier to the right team)
- Test: `tests/engine/menace.test.ts` (create)

**Interfaces:**
- Consumes: `opts.rightMenace?: number` on `simulateBattle` (added in Task 1).
- Produces: `toBattleUnits(team, side, synergies, relics = [], menacePct = 0)` — multiplies the final buffed stats by `(1 + menacePct)`. Produces `menacePct(depth, nodeType)` helper (in `run.ts`, Task 4) but the CONSTANTS land here.

- [ ] **Step 1: Add constants**

In `data/constants.ts`, inside `campaign: { … }`, after `difficultySpan: 7,` add (starting values; Task 6 calibrates):
```ts
    // "Menace": every enemy team's stats are multiplied by (1 + menacePct), where
    // menacePct = menaceBase + menacePerStage * stage, ×menaceEliteMult on elite,
    // ×menaceBossMult on boss. Low base keeps stage 1 gentle; steep per-stage makes
    // late fights and the boss brutal (whip curve). Calibrated in the balance test.
    menaceBase: 0,
    menacePerStage: 0.06,
    menaceEliteMult: 1.5,
    menaceBossMult: 2,
```

- [ ] **Step 2: Write the failing test**

Create `tests/engine/menace.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'

function enemy() {
  return [draftWizard(createRng('m'), WIZARD_BY_ID['voldemort']!)]
}

describe('menace buff', () => {
  it('multiplies enemy stats by (1 + menacePct)', () => {
    const plain = toBattleUnits(enemy(), 'right', [])
    const menaced = toBattleUnits(enemy(), 'right', [], [], 0.5)
    expect(menaced[0]!.buffedStats.atk).toBe(Math.round(plain[0]!.buffedStats.atk * 1.5))
    expect(menaced[0]!.maxHp).toBe(Math.round(plain[0]!.buffedStats.hp * 1.5))
  })

  it('menacePct 0 is identical to no menace', () => {
    const a = toBattleUnits(enemy(), 'right', [])
    const b = toBattleUnits(enemy(), 'right', [], [], 0)
    expect(b[0]!.buffedStats).toEqual(a[0]!.buffedStats)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/menace.test.ts`
Expected: FAIL — `toBattleUnits` ignores the 5th arg.

- [ ] **Step 4: Apply menace in `toBattleUnits`**

In `game/engine/combat/simulate.ts`, change `toBattleUnits`:
```ts
export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[], relics: ActiveRelic[] = [], menacePct = 0,
): BattleUnit[] {
  return team.map(dw => {
    const synBuffed = applyBonuses(dw.stats, synergies)
    const relicBuffed = applyRelicBonuses(synBuffed, team, relics)
    const m = 1 + menacePct
    const buffed = menacePct === 0 ? relicBuffed : {
      hp: Math.round(relicBuffed.hp * m),
      atk: Math.round(relicBuffed.atk * m),
      def: Math.round(relicBuffed.def * m),
      spd: Math.round(relicBuffed.spd * m),
    }
    const startHp = dw.currentHp ?? buffed.hp
    return {
      ...dw, side, buffedStats: buffed, maxHp: buffed.hp,
      hp: Math.min(buffed.hp, Math.max(0, startHp)),
      cooldowns: {}, statusEffects: [], alive: true,
    }
  })
}
```
(The `menacePct === 0` short-circuit preserves byte-identical output for the player and for un-menaced battles — important for parity.)

- [ ] **Step 5: Pass menace from `simulateBattle` to the right units**

In `simulateBattle`, change the `R` construction to thread the menace value:
```ts
  const R = toBattleUnits(right, 'right', rightSyn, rightRelics, opts.rightMenace ?? 0)
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx vitest run tests/engine/menace.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: PASS, no fixtures changed (menace defaults to 0 everywhere until Task 4 wires it).

- [ ] **Step 8: Commit**

```bash
git add data/constants.ts game/engine/combat/simulate.ts tests/engine/menace.test.ts
git commit -m "feat(combat): per-team menace stat multiplier for enemies"
```

---

### Task 3: Enemy relic selection for elite/boss

**Files:**
- Modify: `data/constants.ts` (add `campaign.enemyRelicsElite`, `campaign.enemyRelicsBoss`)
- Modify: `game/engine/relics.ts` (add `selectEnemyRelics`)
- Test: `tests/engine/enemyRelics.test.ts` (create)

**Interfaces:**
- Produces: `selectEnemyRelics(rng: Rng, count: number): ActiveRelic[]` — picks `count` distinct relics weighted by rarity (reusing `weightedPick`), wrapped as `ActiveRelic` with `stageObtained: 0`. Used by `run.ts` (Task 4).

- [ ] **Step 1: Add constants**

In `data/constants.ts` `campaign: { … }`, after the menace block add:
```ts
    // Real relics handed to enemy teams on elite/boss nodes (deterministic per seed).
    enemyRelicsElite: 1,
    enemyRelicsBoss: 3,
```

- [ ] **Step 2: Write the failing test**

Create `tests/engine/enemyRelics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { selectEnemyRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

describe('selectEnemyRelics', () => {
  it('returns the requested count of distinct relics, deterministically', () => {
    const a = selectEnemyRelics(createRng('s'), 3)
    const b = selectEnemyRelics(createRng('s'), 3)
    expect(a.length).toBe(3)
    expect(new Set(a.map(r => r.relic.id)).size).toBe(3) // distinct
    expect(a.map(r => r.relic.id)).toEqual(b.map(r => r.relic.id)) // deterministic
    expect(a[0]!.stageObtained).toBe(0)
  })

  it('never returns more relics than exist in the pool', () => {
    const huge = selectEnemyRelics(createRng('s'), 9999)
    expect(new Set(huge.map(r => r.relic.id)).size).toBe(huge.length)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/enemyRelics.test.ts`
Expected: FAIL — `selectEnemyRelics` not exported.

- [ ] **Step 4: Implement `selectEnemyRelics`**

In `game/engine/relics.ts`, add (reuses the existing private `weightedPick`):
```ts
export function selectEnemyRelics(rng: Rng, count: number): ActiveRelic[] {
  const remaining = [...RELICS]
  const n = Math.min(count, remaining.length)
  const out: ActiveRelic[] = []
  for (let i = 0; i < n; i++) {
    const pick = weightedPick(rng, remaining)
    out.push({ relic: pick, stageObtained: 0 })
    remaining.splice(remaining.indexOf(pick), 1)
  }
  return out
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/enemyRelics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: PASS, no fixtures changed (function not yet called by the run).

- [ ] **Step 7: Commit**

```bash
git add data/constants.ts game/engine/relics.ts tests/engine/enemyRelics.test.ts
git commit -m "feat(relics): deterministic enemy relic selection"
```

---

### Task 4: Wire menace + enemy relics + boss synergy into the run

**Files:**
- Modify: `game/engine/run.ts` (`nextBattle`: compute menace, enemy relics, boss synergy; pass to `simulateBattle`)
- Test: `tests/engine/runEmpowerment.test.ts` (create)

**Interfaces:**
- Consumes: `selectEnemyRelics` (Task 3), `BALANCE.campaign.menace*` / `enemyRelics*` (Tasks 2–3), `opts.rightMenace`/`opts.rightRelics` (Task 1), `boss.exclusiveSynergy` (`data/bosses.ts`).
- Produces: enemy teams that, per node type, receive menace + (elite/boss) relics + (boss) exclusive synergy.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/runEmpowerment.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { menacePctFor } from '@/game/engine/run'
import { BALANCE } from '@/data/constants'

describe('menacePctFor', () => {
  it('is gentle early and steep late', () => {
    const early = menacePctFor(0, 'normal')
    const late = menacePctFor(5, 'normal')
    expect(early).toBeCloseTo(BALANCE.campaign.menaceBase)
    expect(late).toBeGreaterThan(early)
  })
  it('elite and boss multiply the menace', () => {
    const normal = menacePctFor(3, 'normal')
    expect(menacePctFor(3, 'elite')).toBeCloseTo(normal * BALANCE.campaign.menaceEliteMult)
    expect(menacePctFor(3, 'boss')).toBeCloseTo(normal * BALANCE.campaign.menaceBossMult)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/runEmpowerment.test.ts`
Expected: FAIL — `menacePctFor` not exported.

- [ ] **Step 3: Implement and wire in `run.ts`**

In `game/engine/run.ts`:

(a) Add the helper (export it) near the top-level functions:
```ts
export function menacePctFor(depth: number, nodeType: 'normal' | 'elite' | 'boss'): number {
  const c = BALANCE.campaign
  const base = c.menaceBase + c.menacePerStage * depth
  if (nodeType === 'elite') return base * c.menaceEliteMult
  if (nodeType === 'boss') return base * c.menaceBossMult
  return base
}
```

(b) Import `selectEnemyRelics`:
```ts
import { detectSynergies } from './synergy'
import { selectEnemyRelics } from './relics'
```

(c) In `nextBattle`, after `const enemySyn = detectSynergies(enemy)`, build the empowerment and feed it to the battle. Replace the existing block:
```ts
  const enemySyn = detectSynergies(enemy)

  const result = simulateBattle(state.team, enemy, battleRng, {
    leftSyn: state.activeSynergies, rightSyn: enemySyn, leftRelics: state.relics,
  })
```
with:
```ts
  const nodeType: 'normal' | 'elite' | 'boss' = isBoss ? 'boss' : (cur?.type === 'elite' ? 'elite' : 'normal')

  // Boss carries its exclusive synergy (previously defined but never applied).
  // ActiveSynergy is { synergy, memberIds }; applyBonuses sums synergy.bonus
  // regardless of memberIds, so an empty memberIds list applies the bonus team-wide.
  const bossSyn = isBoss ? BOSSES[0]!.exclusiveSynergy : undefined
  const enemySyn = bossSyn
    ? [...detectSynergies(enemy), { synergy: bossSyn, memberIds: enemy.map(d => d.wizard.id) }]
    : detectSynergies(enemy)

  // Real relics for elite/boss enemies (forked rng channel so it never disturbs
  // the enemy-draft or battle streams).
  const relicCount = nodeType === 'boss' ? BALANCE.campaign.enemyRelicsBoss
    : nodeType === 'elite' ? BALANCE.campaign.enemyRelicsElite : 0
  const rightRelics = relicCount > 0
    ? selectEnemyRelics(base.fork(depth + 200), relicCount)
    : []

  const result = simulateBattle(state.team, enemy, battleRng, {
    leftSyn: state.activeSynergies, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace: menacePctFor(depth, nodeType),
  })
```
IMPORTANT: delete the now-duplicated `const enemySyn = detectSynergies(enemy)` line above (the block replaces it). Confirm `enemySyn` is declared exactly once. The `{ synergy, count }` shape must match `ActiveSynergy` — verify against `types`; if `ActiveSynergy` differs, adapt the literal to the real shape (read `detectSynergies`' return type).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/runEmpowerment.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: the new test passes; SOME seed-dependent campaign/battle fixtures now shift (enemies are stronger). That is expected and is refreshed in Task 7 — do NOT refresh them here, and do NOT loosen any assertion. Only confirm there are no LOGIC breaks (crash/NaN). Report which files shifted.

- [ ] **Step 6: Commit**

```bash
git add game/engine/run.ts tests/engine/runEmpowerment.test.ts
git commit -m "feat(run): enemies get menace, elite/boss relics, boss synergy"
```

---

### Task 5: Balance test models relics on both sides

**Files:**
- Modify: `tests/engine/campaignBalance.test.ts` (greedy player collects relics; brutal band)

**Interfaces:**
- Consumes: `offerRelics` (`game/engine/relics.ts`), `addRelic`/`nextBattle`/`advanceToNode` (`run.ts`), `relicOfferRngChannel`.

- [ ] **Step 1: Make the greedy simulation collect relics**

The current `simulateCampaigns` walks the graph and never picks up relics, so it measures a relic-less player. Update it so that at each step the greedy player gains the single strongest available relic (a simple, deterministic upper-bound heuristic), mirroring real play where relics accrue. Replace the body of `simulateCampaigns` so that, after `confirmTeam(...)` and before the battle loop, and again after each non-boss victory, the player gains a relic:

```ts
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { startRun, confirmTeam, nextBattle, advanceToNode, nodeById, addRelic } from '@/game/engine/run'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'

// Strongest-by-aggregate-bonus heuristic: an upper-bound "optimal relic grab".
function relicScore(r: { bonus?: { hp?: number; atk?: number; def?: number; spd?: number; allPct?: number } }): number {
  const b = r.bonus ?? {}
  return (b.hp ?? 0) + (b.atk ?? 0) * 2 + (b.def ?? 0) * 1.5 + (b.spd ?? 0) + (b.allPct ?? 0) * 400
}

function grabRelic(state: ReturnType<typeof startRun>, n: number) {
  const offers = offerRelics(createRng(`${state.seed}-relic-${n}`), state.relics, state.stage)
  if (offers.length === 0) return state
  const best = offers.reduce((a, b) => (relicScore(b) >= relicScore(a) ? b : a))
  return addRelic(state, best)
}
```

Then in the loop, give a relic before the first fight and after each normal victory:
```ts
    let state = confirmTeam(startRun(seed), greedyTeam(seed))
    state = grabRelic(state, 0)
    let firstFight = true
    let guard = 0
    while (guard++ < 50) {
      const out = nextBattle(state)
      battles++
      if (out.result.turns >= 100) capped++
      const won = out.result.winner === 'left'
      if (firstFight) { firstPlays++; if (won) firstWins++; firstFight = false }
      if (out.isBoss) { bossPlays++; if (won) bossWins++ }
      state = out.state
      if (state.phase === 'win') { clears++; break }
      if (state.phase === 'defeat') break
      const cur = nodeById(state, state.currentNodeId!)!
      state = advanceToNode(state, cur.next[0]!)
      state = grabRelic(state, guard)
    }
```

- [ ] **Step 2: Set the brutal band (these will FAIL until Task 6 calibrates — that is intended)**

Replace the three difficulty assertions with the brutal band:
```ts
  it('is brutal but winnable for optimal play (with relics)', () => {
    expect(stats.clearRate).toBeGreaterThan(0.08)
    expect(stats.clearRate).toBeLessThan(0.18)
  })

  it('starts gently — the first fight is usually won', () => {
    expect(stats.firstStageWinRate).toBeGreaterThan(0.65)
  })

  it('peaks at a merciless boss — winnable but rarely', () => {
    expect(stats.bossWinRate).toBeGreaterThan(0)
    expect(stats.bossWinRate).toBeLessThan(0.30)
  })

  it('rarely stalls to the turn cap', () => {
    expect(stats.cappedRate).toBeLessThan(0.05)
  })
```

- [ ] **Step 3: Run it to see the current measured values (expected to FAIL the band)**

Run: `npx vitest run tests/engine/campaignBalance.test.ts`
Expected: FAIL — record the printed `clearRate`, `firstStageWinRate`, `bossWinRate`, `cappedRate`. These measurements drive Task 6. Add a temporary `console.log(stats)` inside the `describe` if needed to read them, and remove it before committing.

- [ ] **Step 4: Commit the test scaffold (red is acceptable here — note it in the commit body)**

```bash
git add tests/engine/campaignBalance.test.ts
git commit -m "test(balance): model player+enemy relics; assert brutal band (calibrated next)"
```
(Commit body: note the band is expected to fail until Task 6 calibration lands.)

---

### Task 6: Calibrate the difficulty knobs to the brutal band

**Files:**
- Modify: `data/constants.ts` (`campaign.menace*`, `enemyRelics*`, `budgetStep`, `difficultySpan`; `map.eliteFloors`, `eliteBudgetMult`)
- Modify: `data/bosses.ts` (`budget`, `hpMult`)

**Interfaces:** none new — pure numeric tuning measured by `tests/engine/campaignBalance.test.ts`.

This is an ITERATIVE tuning task, not a code-writing task. The deliverable is constant values that put the balance test inside the band.

- [ ] **Step 1: Read the current measurement** (from Task 5 Step 3). Identify which way to move:
  - `clearRate` too HIGH (> 0.18) → enemies too weak → raise menace (`menacePerStage`, elite/boss mults), raise `budgetStep`, lower `difficultySpan`, raise `enemyRelicsBoss`, raise boss `budget`/`hpMult`.
  - `clearRate` too LOW (< 0.08) → enemies too strong → reverse.
  - `firstStageWinRate` < 0.65 → early game too hard → lower `menaceBase`/`menacePerStage` (early term) or `baseBudget`; keep the whip in the LATE terms.
  - `bossWinRate` ≥ 0.30 → boss too soft → raise boss `budget`/`hpMult`/`menaceBossMult`/`enemyRelicsBoss`.

- [ ] **Step 2: Adjust ONE lever group at a time**, re-running the test after each change:

Run: `npx vitest run tests/engine/campaignBalance.test.ts`

Prefer adjusting the menace curve and boss values first (most direct), `budgetStep`/`difficultySpan` second. Keep the whip shape: stage-1 gentle, late/boss brutal. Make changes in `data/constants.ts` / `data/bosses.ts` only — never touch engine logic or weaken the test band to pass.

- [ ] **Step 3: Converge** until all four `campaignBalance` assertions pass with margin (clear in ~[0.08, 0.18], firstStage > 0.65, boss in (0, 0.30), capped < 0.05). Record the final values and the measured stats in the commit body.

- [ ] **Step 4: Sanity-check `relicBalance`**

Run: `npx vitest run tests/engine/relicBalance.test.ts`
Expected: still passes (it builds equal-budget enemy pairs directly and passes `leftRelics` only — enemy menace/relics from `run.ts` do not apply there). If it now fails because of constant changes that shift `budgetForStage(2)`, refresh its expected counts as a value-shift (do not weaken intent).

- [ ] **Step 5: Commit**

```bash
git add data/constants.ts data/bosses.ts
git commit -m "balance: calibrate enemy menace/relics/boss to the brutal band"
```

---

### Task 7: Refresh seed-dependent fixtures

**Files:** whichever non-balance tests now assert shifted seed-dependent values (battle outcomes, snapshots, MVP) because enemies are stronger.

- [ ] **Step 1: Find the fallout**

Run: `npm test`
Expected: `campaignBalance` green (Task 6); some other seed-dependent files may FAIL on shifted values. List them.

- [ ] **Step 2: Triage** each failure — value-shift (different number/winner for a seed) vs logic break (crash/NaN/undefined). A logic break is a real bug → STOP and investigate, do not paper over.

- [ ] **Step 3: Refresh** genuine value-shifts: update asserted numbers, or `npx vitest run -u` for snapshots, then eyeball the diff. Do not weaken any balance-intent assertion.

- [ ] **Step 4: Full suite green**

Run: `npm test` then `npm run typecheck`
Expected: PASS (all files), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: refresh seed-dependent fixtures after enemy empowerment"
```

---

## Self-Review notes

- **Spec coverage:** relic de-asymmetrization (Task 1) ✓; menace buff for all enemies (Task 2) ✓; real relics on elite/boss (Tasks 3–4) ✓; boss meaner incl. now-applied exclusive synergy (Task 4 + Task 6) ✓; harder knobs retuned (Task 6) ✓; test models relics on both sides + brutal band (Task 5) ✓; whip curve (gentle stage 1) enforced by `firstStageWinRate > 0.65` and calibration ✓; fixture refresh (Task 7) ✓.
- **Parity:** the spec's hard RNG/log-parity requirement is enforced by Task 1 Step 6 (no fixture may shift) and the `menacePct === 0` short-circuit in Task 2.
- **Player not nerfed:** no task touches player relic power, the `>=` HP tiebreak, or combat margins. ✓
- **Calibration honesty:** the band is set in Task 5 and the test is committed RED; Task 6 moves only data constants to pass it — the test is never weakened to meet the code. ✓
- **Type checks to verify during implementation:** the `ActiveSynergy` literal shape in Task 4 Step 3 (`{ synergy, count }`) and the `RELIC_BY_ID` vs `RELICS.find` export in Task 1 Step 1 — both flagged inline to confirm against the real types.
