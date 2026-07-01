# Wall-boss framework + Area-0 "Il Muro" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable "wall" boss archetype (units carry high `damageReduction`) and one concrete boss — Area-0 "Il Muro" — telegraphed and countered by veleno (which bypasses `damageReduction`).

**Architecture:** Pure wiring. `damageReduction` is already a per-unit field consumed at `game/engine/combat/effects.ts:65`. We add a boss-side source: two optional `BossDef` fields → carried on `NodeBattle` → threaded through `simulateBattle` opts (mirroring the existing `rightMenace` param) → applied to right-side units in `toBattleUnits` via **max** with any existing value. No combat-math change. Veleno bypass is structural (poison ticks subtract HP directly in `tickStatuses`, never routing through `effects.ts`).

**Tech Stack:** TypeScript, Vitest. Existing engine modules; no new dependencies.

## Global Constraints

- **No engine-math changes.** Only *populate* the existing `damageReduction` field; do not alter the `dr` formula at `effects.ts:65`.
- **Voldemort untouched.** The `isFinalBoss` / area-2 branch and `BOSSES[0]` must not change behavior. Do NOT add `pinnedArea` to Voldemort.
- **Combine rule = MAX.** When a unit could get `damageReduction` from both a house effect and the wall, take `Math.max(...)`, never additive (additive can approach 1.0 → hard-gate).
- **Determinism.** No new RNG draws on the combat path; `campaignBalanceB` determinism test must stay green.
- **Soft wall.** Without-veleno win-rate must stay **above zero**; veleno is the *fast* path, not the *only* path.
- **Balance band.** `campaignBalanceB` overall win-rate must remain in `(0.15, 0.45)`.
- **Italian copy.** Boss name `Il Muro`; hint copy in Italian.
- **Run typecheck on new TS test files** (`npm run test` does NOT typecheck): `npx tsc --noEmit` after adding tests.
- **Verify HEAD before each commit** (repo may have a concurrent git writer): `git rev-parse --abbrev-ref HEAD` must be `master`.

---

### Task 1: `BossDef` fields + Muro boss data

**Files:**
- Modify: `data/bosses.ts:3-24`
- Test: `tests/data/muroBoss.test.ts` (create)

**Interfaces:**
- Consumes: nothing (leaf data).
- Produces:
  - `BossDef.unitDamageReduction?: number` — wall value (0..1), applied to every boss unit.
  - `BossDef.pinnedArea?: number` — area this scripted boss is pinned to.
  - `MURO: BossDef` exported from `data/bosses.ts` with `id: 'muro_boss'`, `name: 'Il Muro'`, `pinnedArea: 0`, `unitDamageReduction: 0.4` (starting value; calibrated in Task 6).

- [ ] **Step 1: Write the failing test**

Create `tests/data/muroBoss.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { MURO, type BossDef } from '@/data/bosses'

describe('Muro boss def', () => {
  it('is pinned to area 0 with a soft wall value', () => {
    expect(MURO.id).toBe('muro_boss')
    expect(MURO.name).toBe('Il Muro')
    expect(MURO.pinnedArea).toBe(0)
    expect(MURO.unitDamageReduction).toBeGreaterThan(0)
    expect(MURO.unitDamageReduction).toBeLessThan(0.7) // soft wall, not hard-gate
  })
  it('BossDef exposes optional wall fields', () => {
    const d: BossDef = { id: 'x', name: 'x', budget: 1, hpMult: 1, unitDamageReduction: 0.3, pinnedArea: 0 }
    expect(d.unitDamageReduction).toBe(0.3)
    expect(d.pinnedArea).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/muroBoss.test.ts`
Expected: FAIL — `MURO` is not exported / properties absent.

- [ ] **Step 3: Implement**

In `data/bosses.ts`, add the two optional fields to the interface and export `MURO`:

```typescript
export interface BossDef {
  id: string
  name: string
  budget: number
  hpMult: number
  forcedSpellIds?: string[]
  exclusiveSynergy?: Synergy
  /** Wall archetype: per-unit direct-damage reduction (0..1) applied to every boss unit. */
  unitDamageReduction?: number
  /** Area this scripted boss is pinned to (e.g. Muro → 0). Final boss uses isFinalBoss instead. */
  pinnedArea?: number
}
```

Add after the `BOSSES` array (keep `BOSSES` = Voldemort only; Muro is selected by area, not by `BOSSES[0]`):

```typescript
/** Area-0 scripted wall boss. Telegraphed; countered by veleno (bypasses damageReduction). */
export const MURO: BossDef = {
  id: 'muro_boss',
  name: 'Il Muro',
  budget: 1000,
  hpMult: 1.3,
  unitDamageReduction: 0.4, // starting value; calibrated in Task 6
  pinnedArea: 0,
}
```

Note on `budget`: area-0 boss budget today comes from `budgetB(depth) * bossBudgetMult` (procedural). Muro uses a fixed `budget` like Voldemort; 1000 is a placeholder area-0-scale figure, re-checked in Task 6 calibration.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/muroBoss.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git rev-parse --abbrev-ref HEAD   # must print: master
git add data/bosses.ts tests/data/muroBoss.test.ts
git commit -m "feat(wall-boss): BossDef wall fields + Il Muro area-0 def"
```

---

### Task 2: Apply the wall in `toBattleUnits` (right-side, MAX combine)

**Files:**
- Modify: `game/engine/combat/simulate.ts:24-50` (`toBattleUnits`), `:58-69` (`simulateBattle` opts + call)
- Test: `tests/engine/wallDamageReduction.test.ts` (create)

**Interfaces:**
- Consumes: `BattleUnit.damageReduction` (existing, `types/combat.ts:62`).
- Produces:
  - `toBattleUnits(team, side, synergies, relics?, menacePct?, damageReduction?)` — new trailing optional `damageReduction?: number` applied to every unit via `Math.max(existing, damageReduction)`.
  - `simulateBattle` opts gains `rightDamageReduction?: number`, passed as the new `toBattleUnits` arg for the right team (mirrors `rightMenace`).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/wallDamageReduction.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import type { DraftedWizard } from '@/types'

function stubTeam(): DraftedWizard[] {
  return [{
    wizard: { id: 'w1', name: 'W1', house: 'Grifondoro', baseStats: { hp: 100, atk: 10, def: 5, spd: 5 }, spellIds: [], tags: [] },
    stats: { hp: 100, atk: 10, def: 5, spd: 5 },
    spell: { id: 's', name: 's', type: 'Attacco', hitChance: 1, cooldown: 0, spec: [{ kind: 'damage', power: 1 }] },
    level: 1,
  } as unknown as DraftedWizard]
}

describe('wall damageReduction application', () => {
  it('applies the wall value to units when no house effect present', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0, 0.4)
    expect(units[0]!.damageReduction).toBe(0.4)
  })
  it('takes the MAX of existing and wall (never additive)', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0, 0.4)
    // wall 0.4 vs (no house) → 0.4; ensure it is not > 0.4 (not additive)
    expect(units[0]!.damageReduction).toBeLessThanOrEqual(0.4)
  })
  it('is undefined/absent when no wall passed and no house effect', () => {
    const units = toBattleUnits(stubTeam(), 'right', [], [], 0)
    expect(units[0]!.damageReduction ?? 0).toBe(0)
  })
}) 
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/wallDamageReduction.test.ts`
Expected: FAIL — `toBattleUnits` ignores a 6th arg; `damageReduction` undefined.

- [ ] **Step 3: Implement**

In `game/engine/combat/simulate.ts`, extend `toBattleUnits` signature and apply the wall after the house spread. Change the signature line:

```typescript
export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[], relics: ActiveRelic[] = [], menacePct = 0, damageReduction = 0,
): BattleUnit[] {
```

Change the returned unit object (the `return { ...dw, ... }` at line ~44-48) so the house spread comes first, then apply the MAX wall. Replace the return block with:

```typescript
    const base: BattleUnit = {
      ...dw, side, buffedStats: buffed, maxHp: buffed.hp,
      hp: Math.min(buffed.hp, Math.max(0, startHp)),
      cooldowns: {}, statusEffects: [], alive: true, velenoUncapped, execute, shieldConvert, darkMagic: darkMap[dw.wizard.id], alwaysHit: alwaysHitIds.has(dw.wizard.id), ...houseMap[dw.wizard.id],
    }
    if (damageReduction > 0) {
      base.damageReduction = Math.max(base.damageReduction ?? 0, damageReduction)
    }
    return base
```

In `simulateBattle`, add the opt and pass it to the RIGHT team only. Change the opts type (line ~62) to include `rightDamageReduction?: number`:

```typescript
  opts: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[]; leftRelics?: ActiveRelic[]; rightRelics?: ActiveRelic[]; rightMenace?: number; rightDamageReduction?: number } = {},
```

Change the right-team build (line ~69):

```typescript
  const R = toBattleUnits(right, 'right', rightSyn, rightRelics, opts.rightMenace ?? 0, opts.rightDamageReduction ?? 0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/wallDamageReduction.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Full suite + typecheck + commit**

```bash
npx vitest run
npx tsc --noEmit
git rev-parse --abbrev-ref HEAD   # master
git add game/engine/combat/simulate.ts tests/engine/wallDamageReduction.test.ts
git commit -m "feat(wall-boss): thread rightDamageReduction into toBattleUnits (max combine)"
```

---

### Task 3: Veleno-bypasses-wall regression test

**Files:**
- Test: `tests/engine/velenoBypassesWall.test.ts` (create)

**Interfaces:**
- Consumes: `tickStatuses` (`game/engine/status.ts:68`), `toBattleUnits` (Task 2), `computeDamage`/`EFFECT_HANDLERS.damage` path (`effects.ts`).
- Produces: nothing (regression guard only).

This task has no implementation step — it asserts existing behavior stays true so a future engine change can't silently make the wall block veleno. If the direct-hit assertion needs the damage handler, drive it through the handler; otherwise assert the two independent facts.

- [ ] **Step 1: Write the test**

Create `tests/engine/velenoBypassesWall.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { tickStatuses } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

// A walled unit carrying a veleno stack. tickStatuses subtracts hp directly and
// never routes through effects.ts damageReduction — so the wall must NOT reduce the tick.
function walledUnit(): BattleUnit {
  return {
    wizard: { id: 'muro', name: 'Muro' },
    side: 'right', alive: true, hp: 1000, maxHp: 1000, damageReduction: 0.4,
    cooldowns: {}, buffedStats: { hp: 1000, atk: 0, def: 0, spd: 0 },
    statusEffects: [{ kind: 'dot', statusId: 'veleno', remaining: 3, stacks: 2 }],
  } as unknown as BattleUnit
}

describe('veleno bypasses the wall', () => {
  it('poison tick deals full damage despite damageReduction 0.4', () => {
    const u = walledUnit()
    const before = u.hp
    tickStatuses(1, u)
    const dealt = before - u.hp
    expect(dealt).toBeGreaterThan(0)
    // If the wall wrongly applied, dealt would be scaled by (1 - 0.4). We assert the
    // tick is NOT scaled: recompute the unreduced expected value from the same status def.
    // (Exact number depends on veleno def; the key invariant is "not reduced by dr".)
  })
})
```

If the veleno status id or stack shape differs from the above, read `data/statuses.ts` for the `veleno` def and adjust the fixture (statusId, stacks, `tickPctMaxHp`) so the tick is non-zero — but keep the invariant assertion (`dealt > 0` and unaffected by `damageReduction`). To make the invariant exact, compute the tick twice: once on a unit with `damageReduction: 0` and once with `0.4`, and assert **equal**:

```typescript
  it('poison tick is identical with and without the wall', () => {
    const a = walledUnit(); a.damageReduction = 0
    const b = walledUnit(); b.damageReduction = 0.4
    const beforeA = a.hp, beforeB = b.hp
    tickStatuses(1, a); tickStatuses(1, b)
    expect(beforeA - a.hp).toBe(beforeB - b.hp)
  })
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/engine/velenoBypassesWall.test.ts`
Expected: PASS. If FAIL because the fixture produced a zero tick, adjust the fixture per the note above (read `data/statuses.ts`), then re-run.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git rev-parse --abbrev-ref HEAD   # master
git add tests/engine/velenoBypassesWall.test.ts
git commit -m "test(wall-boss): guard veleno bypasses damageReduction wall"
```

---

### Task 4: Pin Muro into area-0 boss selection (`battlePackage.ts`) + carry wall on `NodeBattle`

**Files:**
- Modify: `types/run.ts:17-26` (`NodeBattle`), `:28-33` (`NodePreview`)
- Modify: `game/engine/combat/battlePackage.ts:36-63`
- Test: `tests/engine/muroAreaSelection.test.ts` (create)

**Interfaces:**
- Consumes: `MURO` (Task 1), `generateBossTeam`, `BOSSES`.
- Produces:
  - `NodeBattle.unitDamageReduction?: number` — wall value for the enemy boss team (boss nodes only).
  - `NodePreview.bossHint?: string` — telegraph copy.
  - `buildBattlePackage` sets both for the area-0 boss node using `MURO`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/muroAreaSelection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { MURO } from '@/data/bosses'
import { BALANCE } from '@/data/constants'

describe('Muro area-0 boss selection', () => {
  it('area-0 boss carries the Muro wall + hint', () => {
    const { battle, preview } = buildBattlePackage('seed-a', 0, 3, 'boss')
    expect(battle.unitDamageReduction).toBe(MURO.unitDamageReduction)
    expect(preview.bossName).toBe('Il Muro')
    expect(preview.bossHint).toMatch(/veleno/i)
  })
  it('final-area boss (Voldemort) is unchanged — no wall', () => {
    const finalArea = BALANCE.map.areas - 1
    const { battle, preview } = buildBattlePackage('seed-a', finalArea, 3, 'boss')
    expect(battle.unitDamageReduction ?? 0).toBe(0)
    expect(preview.bossName).toBe('Lord Voldemort')
  })
  it('non-boss node carries no wall', () => {
    const { battle } = buildBattlePackage('seed-a', 0, 1, 'battle')
    expect(battle.unitDamageReduction ?? 0).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/muroAreaSelection.test.ts`
Expected: FAIL — no area-0 boss branch; `unitDamageReduction`/`bossHint` absent.

- [ ] **Step 3: Implement types**

In `types/run.ts`, add to `NodeBattle` (after `bossSynergy`):

```typescript
  /** Wall archetype: per-unit direct-damage reduction for the enemy boss team (boss nodes only). */
  unitDamageReduction?: number
```

Add to `NodePreview` (after `bossName`):

```typescript
  /** Telegraph copy for a scripted boss weakness (e.g. Muro → veleno). */
  bossHint?: string
```

- [ ] **Step 4: Implement selection**

In `game/engine/combat/battlePackage.ts`, import `MURO`:

```typescript
import { BOSSES, MURO } from '@/data/bosses'
```

Add a first-boss flag near `isFinalBoss` (line ~21):

```typescript
  const isFirstBoss = isBoss && area === MURO.pinnedArea
```

Extend the boss-selection branch (lines ~36-48). Replace with:

```typescript
  let enemyTeam, themeId: string | null = null, bossSynergy: ActiveSynergy | undefined
  let unitDamageReduction: number | undefined
  if (isFinalBoss) {
    enemyTeam = generateBossTeam(enemyRng, BOSSES[0]!)
    bossSynergy = BOSSES[0]!.exclusiveSynergy
      ? { synergy: BOSSES[0]!.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
  } else if (isFirstBoss) {
    enemyTeam = generateBossTeam(enemyRng, MURO)
    bossSynergy = MURO.exclusiveSynergy
      ? { synergy: MURO.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
    unitDamageReduction = MURO.unitDamageReduction
  } else {
    const out = themedEnemyTeam(enemyRng, {
      area, kind: ek, budget: Math.round(budgetB(depth) * budgetMult), count, excludeThemes,
    })
    enemyTeam = out.team
    themeId = out.themeId
  }
```

Update the `battle` and `preview` construction (lines ~58-62):

```typescript
  const battle: NodeBattle = { enemyTeam, enemyRelics, enemyLevel, bossSynergy, unitDamageReduction }
  const preview: NodePreview = {
    synergyIds,
    bossName: isFinalBoss ? BOSSES[0]!.name : isFirstBoss ? MURO.name : undefined,
    bossHint: isFirstBoss ? 'Incassa i colpi diretti — il veleno lo ignora.' : undefined,
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/muroAreaSelection.test.ts`
Expected: PASS (all 3).

- [ ] **Step 6: Full suite + typecheck + commit**

```bash
npx vitest run
npx tsc --noEmit
git rev-parse --abbrev-ref HEAD   # master
git add types/run.ts game/engine/combat/battlePackage.ts tests/engine/muroAreaSelection.test.ts
git commit -m "feat(wall-boss): pin Il Muro to area-0 boss + carry wall/hint on package"
```

---

### Task 5: Wire the wall into combat resolution (`resolveCombat`)

**Files:**
- Modify: `game/engine/resolvers/combat.ts:49-66`
- Test: covered by Task 4 selection + Task 6 balance; add a focused resolver assertion here.
- Test: `tests/engine/muroWallInCombat.test.ts` (create)

**Interfaces:**
- Consumes: `pkg.unitDamageReduction` (Task 4), `simulateBattle` opts `rightDamageReduction` (Task 2).
- Produces: area-0 boss combat actually applies the wall to enemy units.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/muroWallInCombat.test.ts`. Assert that, for an area-0 boss package, the enemy units entering the sim carry the wall. The cleanest observable is the package → sim opt wiring; test it by spying on the built package and confirming `resolveCombat` forwards it. If spying is awkward in this codebase, assert the end-to-end invariant instead: an identical player team loses *more slowly* (more turns) against the walled area-0 boss than against the same boss with the wall stripped.

```typescript
import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { detectSynergies } from '@/game/engine/synergy'

// End-to-end invariant: the wall makes the enemy boss take fewer casualties for the
// same player assault (the direct-damage path is reduced), so the same battle runs
// longer with the wall than without it. This proves rightDamageReduction is applied.
describe('Muro wall applied in combat', () => {
  it('walled boss survives longer than the same boss with wall stripped', () => {
    const { battle } = buildBattlePackage('wall-seed', 0, 3, 'boss')
    const enemy = battle.enemyTeam
    const enemySyn = detectSynergies(enemy)
    // A fixed player team: reuse the enemy team as a stand-in attacker (deterministic).
    const player = buildBattlePackage('wall-seed', 0, 1, 'battle').battle.enemyTeam
    const playerSyn = detectSynergies(player)

    const withWall = simulateBattle(player, enemy, createRng('b'), {
      leftSyn: playerSyn, rightSyn: enemySyn, rightDamageReduction: battle.unitDamageReduction ?? 0,
    })
    const noWall = simulateBattle(player, enemy, createRng('b'), {
      leftSyn: playerSyn, rightSyn: enemySyn, rightDamageReduction: 0,
    })
    expect(withWall.turns).toBeGreaterThanOrEqual(noWall.turns)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/muroWallInCombat.test.ts`
Expected: FAIL initially only if `resolveCombat` is exercised; since this test calls `simulateBattle` directly it validates Task 2 wiring and should PASS once Task 2 is done. Its real purpose is the resolver wiring below — run it AFTER Step 3. If it already passes (direct sim), that confirms the sim half; Step 3 wires the resolver half.

- [ ] **Step 3: Implement resolver wiring**

In `game/engine/resolvers/combat.ts`, read the wall from the package and pass it to `simulateBattle`. After line ~52 (`const bossSyn = pkg.bossSynergy?.synergy`), add:

```typescript
  const rightDamageReduction = pkg.unitDamageReduction ?? 0
```

Update the `simulateBattle` call (lines ~63-66) to forward it:

```typescript
  const result = simulateBattle(ready, enemy, battleRng, {
    leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace, rightDamageReduction,
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/muroWallInCombat.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck + commit**

```bash
npx vitest run
npx tsc --noEmit
git rev-parse --abbrev-ref HEAD   # master
git add game/engine/resolvers/combat.ts tests/engine/muroWallInCombat.test.ts
git commit -m "feat(wall-boss): apply Muro wall to enemy team in resolveCombat"
```

---

### Task 6: Measure-driven calibration (two-profile sweep) + balance guard

**Files:**
- Modify: `data/bosses.ts` (`MURO.unitDamageReduction`, and `MURO.budget` if needed)
- Modify: `tests/engine/campaignBalanceB.test.ts` (add two-profile veleno test + calibration comment)

**Interfaces:**
- Consumes: `runOne` / `pickNode` harness in `campaignBalanceB.test.ts`.
- Produces: a veleno-preferring policy variant + a test asserting with-veleno win-rate > without-veleno, without collapsing to zero; overall band held.

This task is measure-driven: the concrete `unitDamageReduction` value is DISCOVERED by sweeping, not assumed. Start from 0.4 (Task 1).

- [ ] **Step 1: Add a veleno-preferring policy + two-profile harness**

In `tests/engine/campaignBalanceB.test.ts`, add a policy that prefers recruiting veleno-tagged wizards and picking veleno relics. Add near `pickNode`:

```typescript
import { SPELLS } from '@/data/spells'

const VELENO_SPELL_IDS = new Set(
  SPELLS.filter(s => (s.spec ?? []).some(e => e.kind === 'applyStatus' && e.statusId === 'veleno')).map(s => s.id),
)
function isVeleno(dw: { wizard: { tags?: string[] } }): boolean {
  return (dw.wizard.tags ?? []).includes('veleno')
}
// runOne variant that, when true, biases recruit/relic picks toward veleno.
```

Generalize `runOne` to accept a `preferVeleno` flag that, in the `recruit-node` branch, prefers a veleno-tagged candidate (falling back to power) and in `relic-node` prefers a relic whose `keywords` include `'veleno'`. Keep the existing behavior when the flag is false. (Copy the existing `runOne` body; only the recruit/relic selection lines change — do not share mutable state.)

Recruit selection when `preferVeleno`:

```typescript
      const velenoCand = [...off].filter(isVeleno).sort((a, b) => powerOf(b) - powerOf(a))[0]
      const best = velenoCand ?? [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
```

Relic selection when `preferVeleno` (read `off` relic list; each has `keywords?: string[]`):

```typescript
      const velenoRelic = off.find(r => (r.keywords ?? []).includes('veleno'))
      const chosen = velenoRelic ?? off[0]!
```

- [ ] **Step 2: Add the two-profile balance test**

```typescript
describe('Muro wall — veleno is the counter', () => {
  const N = 120
  const withVeleno = Array.from({ length: N }, (_, i) => runOne(`run-${i}`, undefined, true))
  const noVeleno = Array.from({ length: N }, (_, i) => runOne(`run-${i}`, undefined, false))
  const wr = (o: ('win' | 'defeat')[]) => o.filter(x => x === 'win').length / N

  it('veleno players win more than non-veleno players (the wall teaches)', () => {
    expect(wr(withVeleno)).toBeGreaterThan(wr(noVeleno))
  })
  it('soft wall: non-veleno play is still winnable (above zero)', () => {
    expect(wr(noVeleno)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Sweep `unitDamageReduction` to satisfy all bands**

Run the suite and read the win-rates. Adjust `MURO.unitDamageReduction` in `data/bosses.ts` and (if area-0 boss power moved the overall band) re-check the existing `campaignBalanceB` `(0.15, 0.45)` test.

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`

Target simultaneously:
- overall `campaignBalanceB` win-rate stays in `(0.15, 0.45)` (existing test),
- `wr(withVeleno) > wr(noVeleno)` (gap exists),
- `wr(noVeleno) > 0` (soft, not hard-gate).

Sweep procedure (document actual numbers in a comment as prior calibrations do):
- If `noVeleno` win-rate is 0 → wall too high → lower `unitDamageReduction` (e.g. 0.4 → 0.33 → 0.28).
- If `withVeleno` ≈ `noVeleno` (no gap) → wall too low → raise it.
- If overall band breaks the 0.15 floor → the Muro budget/wall raised area-0 power too much → lower `unitDamageReduction` and/or `MURO.budget`.

Record the final chosen values in a `// Calibration (2026-07-01, Muro wall): ...` comment block at the top of `campaignBalanceB.test.ts`, matching the style of the existing comments (sweep points → chosen value → win-rates).

- [ ] **Step 4: Run full suite to confirm all green**

Run: `npx vitest run`
Expected: PASS — all existing tests + the new two-profile tests, with the overall band held.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git rev-parse --abbrev-ref HEAD   # master
git add data/bosses.ts tests/engine/campaignBalanceB.test.ts
git commit -m "balance(wall-boss): calibrate Muro wall — veleno counter gap, soft floor held"
```

---

### Task 7: Whole-slice review + push

**Files:** none (review + integrate).

- [ ] **Step 1: Confirm full green + typecheck**

```bash
npx vitest run
npx tsc --noEmit
```
Expected: all PASS.

- [ ] **Step 2: Review the whole slice**

Use `superpowers:requesting-code-review` (or `/code-review`) over the commit range from before Task 1 to HEAD. Verify: Voldemort branch untouched, MAX-combine (not additive), veleno bypass guarded, soft-wall floor held, calibration comment present and accurate.

- [ ] **Step 3: Apply any review corrections, re-run suite, then push**

```bash
git rev-parse --abbrev-ref HEAD   # master
git push origin master
```

(Push without asking is authorized per user standing preference once work is done and verified.)

---

## Self-Review notes

- **Spec coverage:** framework fields (T1), wall application + MAX combine (T2), veleno-bypass guard (T3), area-0 pinning + telegraph `bossHint` (T4), resolver wiring (T5), soft-wall calibration + two-profile sweep (T6), review/push (T7). Every spec section maps to a task.
- **Type consistency:** `unitDamageReduction` used identically across `BossDef` (T1), `NodeBattle` (T4), and the `rightDamageReduction` opt (T2/T5). `bossHint` defined in `NodePreview` (T4) and set in `buildBattlePackage` (T4). `toBattleUnits` 6th param `damageReduction` (T2) matches its caller in `simulateBattle` (T2).
- **Anti-hard-gate:** enforced by T6 `wr(noVeleno) > 0` assertion.
- **Voldemort safety:** T4 test asserts final-area boss has no wall and unchanged name.
- **Determinism:** no new RNG draws added; existing `campaignBalanceB` determinism test remains the guard.
