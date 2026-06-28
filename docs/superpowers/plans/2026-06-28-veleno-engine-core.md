# Veleno Engine Core — Implementation Plan (Plan A of the Veleno slice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the keyword substrate and the "Veleno che divora" poison mechanic — a status that ramps unlimited (flat) + melts big HP (%max-HP, capped), scaled by team relics — entirely in the engine, unit-tested.

**Architecture:** Pure additive extensions to the existing event-driven combat engine. A new `Keyword` type tags content; a new `veleno` status uses a new `accumulate` stack policy (single growing entry); `tickStatuses` computes `stacks × flat × velenoMult + min(stacks, cap) × pctMaxHp × maxHp`; the team-level `velenoMult` is computed from relics and threaded into the end-of-turn tick from `simulate.ts`. No combat-loop rewrite, no RNG in scaling, deterministic.

**Tech Stack:** TypeScript, Next.js, Vitest. Path alias `@/` → repo root. Types barrel at `types/index.ts` re-exported as `@/types`.

## Global Constraints

- **Determinism:** same seed → same outcome. The tick scaling consumes **no RNG**. (Verbatim from spec §8 / §11.)
- **Backward compatibility:** all existing tests stay green (baseline 664). Multiplying tick by `stacks` is safe because every existing status entry has `stacks: 1`. (spec §2.2 "burn resta invariato")
- **"Veleno che divora" tick formula (verbatim, spec §2.2):** `tick = stacks × perStackFlat × keywordDamageMult.veleno + min(stacks, pctCap) × perStackPct × target.maxHp`.
- **Guardrail (verbatim, spec §2.2):** the %max-HP component is **capped at `pctCap` = 8 stacks**; only the flat component is unbounded.
- **Counter-web invariants to PRESERVE (spec §7.1):** veleno tick must subtract HP **directly** (it must keep bypassing shields → beats Scudi/Tank); the `veleno` status must stay `removable: true` (it must stay cleansable / lose to sustain). Do not route veleno through `absorbDamage`.
- **Starting numbers (dials, spec §3):** `perStackFlat = 4`, `perStackPct = 0.005` (0.5% maxHp), `pctCap = 8`, base `maxStacks = 8`, `defaultDuration = 2` (refresh on reapply), Ampolla `keywordMult.veleno = +0.5`.

---

## File Structure

- **Create** `types/keyword.ts` — the `Keyword` string-union (full set declared; only `veleno` used now).
- **Modify** `types/index.ts` — re-export `./keyword` from the barrel.
- **Modify** `types/status.ts` — add `'accumulate'` to `StatusStackPolicy`; add `keywords?`, `tickPctMaxHp?`, `tickStackCapForPct?` to `StatusDef`.
- **Modify** `types/relic.ts` — add `keywords?` and `keywordMult?` to `Relic`.
- **Modify** `data/statuses.ts` — add the `veleno` `StatusDef`.
- **Modify** `game/engine/status.ts` — `accumulate` branch in `applyStatus`; scaled tick + `opts.velenoMult` in `tickStatuses`.
- **Modify** `game/engine/relics.ts` — add `keywordDamageMult(team, relics, keyword)`.
- **Modify** `game/engine/combat/simulate.ts` — compute each side's veleno mult; pass the **opposing** side's mult into the end-of-turn `tickStatuses`.
- **Modify** `data/relics.ts` — add Ampolla di Veleno, Pugnale di Bellatrix; rework Boccino d'Oro.
- **Test** `tests/engine/veleno.test.ts` — new; all unit + integration tests for this plan.

> Note discovered during grounding: `game/engine/signatures.ts` + `registerSignatures()` already exist and are wired in `simulate.ts`. Wizard signature abilities (P0) therefore belong to **Plan B**, not here. This plan does not touch them.

---

### Task 1: Keyword substrate + `veleno` status with `accumulate` policy

**Files:**
- Create: `types/keyword.ts`
- Modify: `types/index.ts` (add barrel re-export)
- Modify: `types/status.ts` (StatusStackPolicy + StatusDef fields)
- Modify: `data/statuses.ts:8` (add `veleno` after `burn`)
- Modify: `game/engine/status.ts:38-43` (accumulate branch in `applyStatus`)
- Test: `tests/engine/veleno.test.ts`

**Interfaces:**
- Produces: `Keyword` type; `StatusDef.keywords?: Keyword[]`, `StatusDef.tickPctMaxHp?: number`, `StatusDef.tickStackCapForPct?: number`; `StatusStackPolicy` now includes `'accumulate'`; `STATUS_BY_ID['veleno']` exists. `applyStatus(unit, 'veleno')` increments a single entry's `stacks` up to `maxStacks` and refreshes `remaining`.

- [ ] **Step 1: Create the Keyword type**

Create `types/keyword.ts`:

```typescript
/** Build-archetype keywords. Full set declared up-front so content can tag against it;
 *  in the Veleno slice only 'veleno' is populated. */
export type Keyword =
  | 'veleno'
  | 'colpoFortunato'
  | 'velocita'
  | 'scudo'
  | 'controllo'
  | 'rigenerazione'
  | 'esecuzione'
  | 'sacrificio'
  | 'magieOscure'
  | 'evocazione'
  | 'crescendo'
```

- [ ] **Step 2: Re-export from the types barrel**

In `types/index.ts`, add alongside the other `export * from './...'` lines:

```typescript
export * from './keyword'
```

- [ ] **Step 3: Extend StatusDef and StatusStackPolicy**

In `types/status.ts`, change the import line at top and the two definitions:

```typescript
import type { Stat } from './spell'
import type { Keyword } from './keyword'
```

```typescript
export type StatusStackPolicy = 'ignore' | 'refresh' | 'extend' | 'stack' | 'accumulate'
```

Add three optional fields to `StatusDef` (after `tickHeal?: number`):

```typescript
  tickHeal?: number
  /** Build keyword tags (e.g. ['veleno']). */
  keywords?: Keyword[]
  /** Per-stack damage as a fraction of the target's maxHp (the "divora" component). */
  tickPctMaxHp?: number
  /** Stack count above which the %maxHp component stops growing (the guardrail). */
  tickStackCapForPct?: number
```

- [ ] **Step 4: Add the `veleno` status definition**

In `data/statuses.ts`, add immediately after the `burn` line (line 8):

```typescript
  { id: 'veleno', name: 'Veleno', kind: 'dot', family: 'dot', keywords: ['veleno'], tickDamage: 4, tickPctMaxHp: 0.005, tickStackCapForPct: 8, defaultDuration: 2, stack: 'accumulate', maxStacks: 8, priority: 50, removable: true },
```

- [ ] **Step 5: Write the failing test for `accumulate`**

Create `tests/engine/veleno.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { BattleUnit } from '@/types'
import { applyStatus, tickStatuses } from '@/game/engine/status'

/** Minimal BattleUnit with only the fields tickStatuses/applyStatus read. */
function mkUnit(maxHp = 100): BattleUnit {
  return {
    wizard: { id: 'dummy' },
    side: 'right',
    hp: maxHp,
    maxHp,
    cooldowns: {},
    statusEffects: [],
    alive: true,
  } as unknown as BattleUnit
}

describe('veleno: accumulate stack policy', () => {
  it('grows a single entry up to maxStacks, then caps', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')
    const entries = u.statusEffects.filter(e => e.statusId === 'veleno')
    expect(entries).toHaveLength(1)          // one entry, not many
    expect(entries[0]!.stacks).toBe(8)       // capped at maxStacks
  })

  it('refreshes remaining duration on reapply', () => {
    const u = mkUnit()
    applyStatus(u, 'veleno')
    const e = u.statusEffects.find(x => x.statusId === 'veleno')!
    e.remaining = 1
    applyStatus(u, 'veleno')
    expect(e.remaining).toBe(2)              // refreshed to defaultDuration
    expect(e.stacks).toBe(2)
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: FAIL — `accumulate` not handled, so a second entry is pushed / `stacks` stays 1.

- [ ] **Step 7: Implement the `accumulate` branch**

In `game/engine/status.ts`, inside `applyStatus`, add the branch in the `existing.length > 0` block (after the `'extend'` line, before the `'stack'` line):

```typescript
  if (existing.length > 0) {
    if (def.stack === 'ignore') return
    if (def.stack === 'refresh') { existing[0]!.remaining = remaining; return }
    if (def.stack === 'extend') { existing[0]!.remaining += remaining; return }
    if (def.stack === 'accumulate') {
      const cur = existing[0]!
      const cap = def.maxStacks ?? Infinity
      cur.stacks = Math.min(cap, (cur.stacks ?? 1) + 1)
      cur.remaining = remaining
      return
    }
    if (def.stack === 'stack' && def.maxStacks != null && existing.length >= def.maxStacks) return
  }
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: PASS (both `accumulate` tests).

- [ ] **Step 9: Run the full suite (no regressions)**

Run: `npx vitest run`
Expected: PASS — all existing tests still green (the new policy and status are additive).

- [ ] **Step 10: Commit**

```bash
git add types/keyword.ts types/index.ts types/status.ts data/statuses.ts game/engine/status.ts tests/engine/veleno.test.ts
git commit -m "feat(veleno): keyword type + veleno status with accumulate stack policy"
```

---

### Task 2: Scaled tick — `stacks × flat` + capped `%maxHp`

**Files:**
- Modify: `game/engine/status.ts:61-85` (`tickStatuses` damage branch)
- Test: `tests/engine/veleno.test.ts`

**Interfaces:**
- Consumes: `StatusDef.tickPctMaxHp`, `StatusDef.tickStackCapForPct`, entry `stacks` (Task 1).
- Produces: `tickStatuses(turn, unit)` now deals `tickDamage × stacks + min(stacks, tickStackCapForPct) × tickPctMaxHp × unit.maxHp` (rounded) per damaging entry. Mult param comes in Task 3.

- [ ] **Step 1: Write the failing test for the tick formula**

Append to `tests/engine/veleno.test.ts`:

```typescript
describe('veleno: "che divora" tick (no mult yet)', () => {
  it('deals stacks*flat + min(stacks,8)*0.5%maxHp', () => {
    const u = mkUnit(200)
    for (let i = 0; i < 5; i++) applyStatus(u, 'veleno')   // 5 stacks
    const before = u.hp
    tickStatuses(1, u)
    // flat 5*4=20 ; pct min(5,8)*0.005*200=5 ; total 25
    expect(before - u.hp).toBe(25)
  })

  it('caps the %maxHp component at 8 stacks but not the flat', () => {
    const u = mkUnit(1000)
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')  // stacks cap at 8
    const before = u.hp
    tickStatuses(1, u)
    // stacks=8 ; flat 8*4=32 ; pct min(8,8)*0.005*1000=40 ; total 72
    expect(before - u.hp).toBe(72)
  })

  it('does not route through shields (bypasses absorb)', () => {
    const u = mkUnit(100)
    u.statusEffects.push({ kind: 'shield', statusId: 'shield', remaining: 3, stacks: 1, absorbLeft: 50 })
    applyStatus(u, 'veleno')                                // 1 stack
    const before = u.hp
    tickStatuses(1, u)
    // flat 1*4=4 ; pct 1*0.005*100=0.5 ; round(4.5)=5 ; shield untouched
    expect(before - u.hp).toBe(5)
    expect(u.statusEffects.find(e => e.statusId === 'shield')!.absorbLeft).toBe(50)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: FAIL — current tick ignores `stacks` and `%maxHp` (would subtract 4 per entry).

- [ ] **Step 3: Implement the scaled tick**

In `game/engine/status.ts`, replace the damage branch of `tickStatuses` (the `if (tickDamage) { ... }` block, lines ~67-71). Replace the whole damage computation with:

```typescript
  for (const e of unit.statusEffects) {
    const def = e.statusId ? STATUS_BY_ID[e.statusId] : undefined
    const baseTick = def?.tickDamage ?? (e.kind === 'dot' ? e.amount : undefined)
    const tickHeal = def?.tickHeal
    if (baseTick != null) {
      const stacks = e.stacks ?? 1
      const flat = baseTick * stacks
      const pctStacks = def?.tickStackCapForPct != null ? Math.min(stacks, def.tickStackCapForPct) : stacks
      const pct = def?.tickPctMaxHp ? pctStacks * def.tickPctMaxHp * unit.maxHp : 0
      const total = Math.round(flat + pct)
      unit.hp -= total
      logs.push({ turn, actorId: unit.wizard.id, actorSide: unit.side, action: def?.name ?? 'Veleno',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Controllo', value: total, flags: ['dot'] })
    }
    if (tickHeal && unit.alive) {
```

(Leave the `tickHeal` block, `e.remaining -= 1`, and the rest of the function unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: PASS (all veleno tests).

- [ ] **Step 5: Run the full suite (burn unchanged)**

Run: `npx vitest run`
Expected: PASS — burn still ticks 8/entry (`stacks=1`, no `tickPctMaxHp`).

- [ ] **Step 6: Commit**

```bash
git add game/engine/status.ts tests/engine/veleno.test.ts
git commit -m "feat(veleno): scaled tick — stacks*flat + capped %maxHp"
```

---

### Task 3: Team-level `keywordDamageMult` + threading into the tick

**Files:**
- Modify: `types/relic.ts` (add `keywords?`, `keywordMult?`)
- Modify: `game/engine/relics.ts` (add `keywordDamageMult`)
- Modify: `game/engine/status.ts` (`tickStatuses` gains `opts.velenoMult`)
- Modify: `game/engine/combat/simulate.ts` (compute per-side mult; pass opposing side's mult into end-of-turn tick)
- Test: `tests/engine/veleno.test.ts`

**Interfaces:**
- Consumes: `relicMatchesCondition` (existing, `game/engine/relics.ts:8`), `Keyword` (Task 1).
- Produces: `Relic.keywords?: Keyword[]`, `Relic.keywordMult?: Partial<Record<Keyword, number>>`; `keywordDamageMult(team: DraftedWizard[], relics: ActiveRelic[], keyword: Keyword): number`; `tickStatuses(turn, unit, opts?: { velenoMult?: number })` scales the **flat** veleno component by `velenoMult`.

- [ ] **Step 1: Extend the Relic type**

In `types/relic.ts`, add the import and the two optional fields to `Relic`:

```typescript
import type { Keyword } from './keyword'
```

```typescript
  triggers?: RelicTrigger[]
  /** Build keyword tags. */
  keywords?: Keyword[]
  /** Team-level multiplier added to a keyword's damage (e.g. { veleno: 0.5 } = +50%). */
  keywordMult?: Partial<Record<Keyword, number>>
```

- [ ] **Step 2: Write the failing test for `keywordDamageMult`**

Append to `tests/engine/veleno.test.ts`:

```typescript
import { keywordDamageMult } from '@/game/engine/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

describe('keywordDamageMult', () => {
  const team = [] as unknown as DraftedWizard[]
  it('returns 1 with no relics', () => {
    expect(keywordDamageMult(team, [], 'veleno')).toBe(1)
  })
  it('sums keywordMult from unconditional relics', () => {
    const relics: ActiveRelic[] = [
      { relic: { id: 'a', name: 'A', desc: '', rarity: 'non-comune', keywordMult: { veleno: 0.5 } }, stageObtained: 0 },
    ]
    expect(keywordDamageMult(team, relics, 'veleno')).toBeCloseTo(1.5)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: FAIL — `keywordDamageMult` is not exported.

- [ ] **Step 4: Implement `keywordDamageMult`**

In `game/engine/relics.ts`, add the import for `Keyword` to the existing type import line, then add the function after `relicMatchesCondition`:

```typescript
import type { ActiveRelic, DraftedWizard, Keyword, RelicCondition, Stats, Side } from '@/types'
```

```typescript
/** Team-level damage multiplier for a keyword: 1 + Σ keywordMult[keyword] over
 *  active (condition-matching) relics. Consumes no RNG. */
export function keywordDamageMult(team: DraftedWizard[], relics: ActiveRelic[], keyword: Keyword): number {
  let mult = 1
  for (const { relic } of relics) {
    if (!relic.keywordMult) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    mult += relic.keywordMult[keyword] ?? 0
  }
  return mult
}
```

- [ ] **Step 5: Write the failing test for `velenoMult` in the tick**

Append to `tests/engine/veleno.test.ts`:

```typescript
describe('veleno: velenoMult scales the flat component only', () => {
  it('1.5x mult scales flat but not %maxHp', () => {
    const u = mkUnit(200)
    for (let i = 0; i < 5; i++) applyStatus(u, 'veleno')   // 5 stacks
    const before = u.hp
    tickStatuses(1, u, { velenoMult: 1.5 })
    // flat 5*4*1.5=30 ; pct 5*0.005*200=5 ; total 35
    expect(before - u.hp).toBe(35)
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: FAIL — `tickStatuses` ignores the third argument.

- [ ] **Step 7: Thread `velenoMult` through `tickStatuses`**

In `game/engine/status.ts`, change the signature and the flat computation:

```typescript
export function tickStatuses(turn: number, unit: BattleUnit, opts: { velenoMult?: number } = {}): LogEntry[] {
```

In the damage branch, scale only the flat part for veleno-keyworded statuses:

```typescript
      const stacks = e.stacks ?? 1
      const isVeleno = def?.keywords?.includes('veleno') ?? false
      const flat = baseTick * stacks * (isVeleno ? (opts.velenoMult ?? 1) : 1)
      const pctStacks = def?.tickStackCapForPct != null ? Math.min(stacks, def.tickStackCapForPct) : stacks
      const pct = def?.tickPctMaxHp ? pctStacks * def.tickPctMaxHp * unit.maxHp : 0
      const total = Math.round(flat + pct)
```

(The `resolve.ts` re-export `export { tickStatuses }` is unaffected by the new optional param.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: PASS (mult test + all prior).

- [ ] **Step 9: Wire the per-side mult into `simulate.ts`**

In `game/engine/combat/simulate.ts`: extend the relics import (line 7) to include `keywordDamageMult`:

```typescript
import { applyRelicBonuses, keywordDamageMult, registerRelicTriggers, totalRelicRegen } from '../relics'
```

After the trigger registration block (just below `registerSignatures(bus, [...L, ...R])`, ~line 92), add:

```typescript
  // Poison scaling: each side's veleno multiplier from its own relics. Poison ON a unit
  // is scaled by the OPPOSING side's mult (the side that applied it).
  const leftVelenoMult = keywordDamageMult(left, leftRelics, 'veleno')
  const rightVelenoMult = keywordDamageMult(right, rightRelics, 'veleno')
```

Then change the end-of-turn tick call (the `const dots = tickStatuses(turn, u)` line, ~line 242) to:

```typescript
      const dots = tickStatuses(turn, u, { velenoMult: u.side === 'left' ? rightVelenoMult : leftVelenoMult })
```

- [ ] **Step 10: Run the full suite (no regressions)**

Run: `npx vitest run`
Expected: PASS — mult defaults to 1 with no veleno relics, so existing battles are unchanged and deterministic.

- [ ] **Step 11: Commit**

```bash
git add types/relic.ts game/engine/relics.ts game/engine/status.ts game/engine/combat/simulate.ts tests/engine/veleno.test.ts
git commit -m "feat(veleno): team keywordDamageMult threaded into poison tick"
```

---

### Task 4: The three Veleno relics + battle integration test

**Files:**
- Modify: `data/relics.ts` (add Ampolla + Pugnale; rework Boccino at line ~25)
- Test: `tests/engine/veleno.test.ts`

**Interfaces:**
- Consumes: `keywordMult` / `keywords` (Task 3); the `applyStatus` effect handler dispatches `{ kind:'applyStatus', target:'enemy', statusId:'veleno' }` → `applyStatus(target,'veleno')` (verified in `game/engine/combat/effects.ts:84-88`).
- Produces: relics `ampolla-veleno`, `pugnale-bellatrix`, reworked `boccino-doro` in `RELICS`.

- [ ] **Step 1: Add Ampolla + Pugnale, rework Boccino**

In `data/relics.ts`: **replace** the existing `boccino-doro` line, and **add** the two new relics next to it. Final state of those entries:

```typescript
  { id: 'ampolla-veleno', name: 'Ampolla di Veleno', desc: 'Il danno da Veleno della squadra è aumentato del 50%.', rarity: 'non-comune', keywords: ['veleno'], keywordMult: { veleno: 0.5 } },
  { id: 'pugnale-bellatrix', name: 'Pugnale di Bellatrix', desc: 'Ogni colpo avvelena il nemico (1 dose).', rarity: 'rara', keywords: ['veleno'], triggers: [{ hook: 'onHit', effects: [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno' }] }] },
  { id: 'boccino-doro', name: "Boccino d'Oro", desc: 'Ogni colpo ha il 25% di avvelenare il nemico.', rarity: 'epica', keywords: ['veleno'], triggers: [{ hook: 'onHit', effects: [{ kind: 'applyStatus', target: 'enemy', chance: 0.25, statusId: 'veleno' }] }] },
```

> Simplification vs spec §6: Boccino applies 1 dose at 25% (was loosely "+2 stack at 15%"); a single applyStatus call adds one stack and avoids double-roll ambiguity. Power is tuned later via the dials, not the relic shape.

- [ ] **Step 2: Write the failing integration test**

Append to `tests/engine/veleno.test.ts`. It proves the Ampolla mult reaches a real battle tick. Signature confirmed: `simulateBattle(left, right, rng, { leftRelics })` in `game/engine/combat/simulate.ts:45`. Pugnale (100% onHit → veleno) is the deterministic applier; comparing the **first** poison tick avoids the kill-speed confound (a stronger poison kills faster → fewer ticks, so cumulative totals are not monotonic; the first tick at a fixed turn/stack is):

```typescript
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, BattleResult, DraftedWizard } from '@/types'

function draft(id: string, over: Partial<{ hp: number; atk: number; def: number; spd: number }> = {}): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  const stats = { hp: over.hp ?? 200, atk: over.atk ?? 40, def: over.def ?? 20, spd: over.spd ?? 30 }
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}

function firstDotOnRight(r: BattleResult): number {
  const e = r.log.find(x => x.flags.includes('dot') && x.targetSide === 'right')
  return e?.value ?? 0
}

describe('veleno relics: Ampolla scales the in-battle poison tick', () => {
  const pugnale = RELICS.find(r => r.id === 'pugnale-bellatrix')!   // 100% onHit → veleno
  const ampolla = RELICS.find(r => r.id === 'ampolla-veleno')!      // +50% veleno flat
  const left = [draft('harry', { atk: 40, hp: 500 })]               // attacker, won't die
  const right = [draft('ron', { hp: 300, def: 20 })]                // soaks several turns

  const run = (leftRelics: ActiveRelic[]): BattleResult =>
    simulateBattle(left, right, createRng('veleno-int-1'), { leftRelics })

  it('applies poison via the relic onHit trigger', () => {
    expect(firstDotOnRight(run([{ relic: pugnale, stageObtained: 0 }]))).toBeGreaterThan(0)
  })

  it('Ampolla makes the first poison tick stronger (flat x1.5), same seed', () => {
    const without = run([{ relic: pugnale, stageObtained: 0 }])
    const withAmpolla = run([{ relic: pugnale, stageObtained: 0 }, { relic: ampolla, stageObtained: 0 }])
    expect(firstDotOnRight(withAmpolla)).toBeGreaterThan(firstDotOnRight(without))
  })
})
```

- [ ] **Step 3: Run the integration test (fails, then passes)**

Run: `npx vitest run tests/engine/veleno.test.ts`
Expected: the first test passes once the relics exist (Step 1); the second passes once Task 3's `simulate.ts` threading is in place (it is). If the second unexpectedly fails, confirm `harry` acts before `ron` (both spd 30 → id tiebreak `harry` < `ron`) so poison lands turn 1.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS — new relics are inert for teams that don't carry them; rarity weights unaffected (Boccino keeps `epica`).

- [ ] **Step 5: Commit**

```bash
git add data/relics.ts tests/engine/veleno.test.ts
git commit -m "feat(veleno): Ampolla/Pugnale relics + Boccino rework, battle integration test"
```

---

## Self-Review

**1. Spec coverage (Plan A scope = spec §2.1 keyword substrate, §2.2 veleno status, §2.3 scaling, §6 relics, counter-web invariants §7.1):**
- Keyword type + `keywords?` on StatusDef/Relic → Task 1, Task 3. ✓ (Spell/Trait keyword fields intentionally deferred to Plan B, where draftability/identity consume them — noted in File Structure.)
- `veleno` status, `accumulate` policy, single growing entry → Task 1. ✓
- "Che divora" tick (flat + capped %maxHp) → Task 2. ✓
- Team `keywordDamageMult` + threading (opposing-side mult) → Task 3. ✓
- Ampolla (scaling) / Pugnale + Boccino (appliers) → Task 4. ✓
- Counter-web invariants: veleno bypasses shields (tick subtracts hp directly; explicit test in Task 2 Step 1) ✓; veleno `removable: true` (Task 1 def) ✓.
- Deferred to later plans (correctly out of scope here): signatures/identity (Plan B — `signatures.ts` already exists), Tossicità synergy (Plan B), loadout + drama UI (Plan C), the viability/distinction/turn-budget sweep (Plan D, spec §8), Umbridge (Plan D).

**2. Placeholder scan:** none. Every step contains complete, runnable code. The Task 4 integration test is bound to the real `simulateBattle(left, right, rng, { leftRelics })` signature (`simulate.ts:45`) with a self-contained `draft()` factory over real `WIZARDS`/`SPELL_BY_ID`, so no "open another test and copy" step remains.

**3. Type consistency:** `keywordDamageMult(team, relics, keyword)` signature identical in Task 3 (def) and Task 4 (use). `tickStatuses(turn, unit, opts?)` consistent Task 2→3. `veleno` id/fields consistent across statuses.ts, tests, relics. `StatusStackPolicy` includes `'accumulate'` before `applyStatus` uses it. `Relic.keywordMult` shape `Partial<Record<Keyword, number>>` consistent between type (Task 3 Step 1) and data (Task 4 Step 1) and function (Task 3 Step 4).

---

## What this plan deliberately leaves to follow-on plans

- **Plan B — Identity & draftability:** wizard `signatureTraitId`/`registerSignatures` content (Slughorn/Bellatrix/Dolohov), the ~6-8 contributor pools, `Spell`/`Trait` keyword tags, the "Tossicità" synergy (removes the flat stack cap), Veleno's place in the counter web at the synergy level.
- **Plan C — Loadout & drama (P8):** the spell-loadout panel and persistence; battle callout overlay + MVP recap.
- **Plan D — Validation & counter:** the Veleno sweep (viability ≥0.20, dot-damage distinction, draftability, turn-budget median<22/max<30), the Scudi-beats / Regen-loses matchup tests, optional Umbridge boss. This is the quality gate before declaring the slice done.
