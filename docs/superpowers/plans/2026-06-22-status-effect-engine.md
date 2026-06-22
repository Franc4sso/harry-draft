# Status & Effect Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `if/else` combat resolution with a data-driven `StatusDef` registry + a canonical `EffectSpec` interpreter, so new statuses/spells are pure data.

**Architecture:** A `StatusDef` registry (`data/statuses.ts`) describes status behavior declaratively. Spells normalize (`normalizeSpell`) to a canonical `EffectSpec[]`, dispatched through a pure `EFFECT_HANDLERS` registry. A pure `status.ts` module owns status lifecycle (apply/tick/stats/guards). `ActiveEffect` is widened to a backward-compatible superset so legacy inline effects keep working.

**Tech Stack:** TypeScript strict, Vitest, Next.js 15. Pure functions, RNG injected (no `Math.random`).

## Global Constraints

- TypeScript **strict**, no `any`, no workarounds — verbatim from spec.
- **All 154 existing tests must stay green.** Observable behavior (damage, heal, log entries, winner, determinism from seed) is unchanged for existing content.
- No UI changes (components never read `statusEffects`).
- All randomness via the injected `Rng` (`rng.chance`, etc.) — never `Math.random`.
- Run commands from `C:\Users\Francesco\Desktop\wa\harry-draft`.
- Verify command (full suite): `npx vitest run` ; typecheck: `npx tsc --noEmit`.

---

### Task 1: Status & effect types

**Files:**
- Create: `types/status.ts`
- Modify: `types/spell.ts` (add optional `spec`, `target`, `priority` to `Spell`)
- Modify: `types/combat.ts:11-16` (widen `ActiveEffect`)
- Modify: `types/index.ts` (export `./status`)
- Test: `tests/types.test.ts` (append a structural test)

**Interfaces:**
- Produces: `StatusKind`, `StatusFamily`, `StatusStackPolicy`, `ActionGate`, `StatusDef`, `EffectInline`, `EffectSpec` (from `types/status.ts`); widened `ActiveEffect`; `Spell.spec?: EffectSpec[]`, `Spell.target?`, `Spell.priority?`.

- [ ] **Step 1: Create `types/status.ts`**

```ts
import type { Stat } from './spell'

export type StatusKind =
  | 'buff' | 'debuff' | 'dot' | 'stun'              // legacy (retro-compat)
  | 'freeze' | 'silence' | 'disarm' | 'regen' | 'shield'  // new

export type StatusFamily = 'control' | 'dot' | 'regen' | 'shield' | 'buff' | 'debuff'
export type StatusStackPolicy = 'ignore' | 'refresh' | 'extend' | 'stack'
export type ActionGate = 'action' | 'spell' | 'attack'

export interface StatusDef {
  id: string
  name: string
  kind: StatusKind
  family: StatusFamily
  prevents?: ActionGate[]
  statMod?: { stat: Stat; amount: number; pct?: boolean }
  tickDamage?: number
  tickHeal?: number
  absorb?: number
  defaultDuration: number
  stack: StatusStackPolicy
  maxStacks?: number
  priority: number
  removable: boolean
}

export interface EffectInline {
  kind: StatusKind
  stat?: Stat
  amount?: number
  duration?: number
}

export type EffectTarget = 'enemy' | 'self' | 'ally'

export type EffectSpec =
  | { kind: 'damage'; power: number; canCrit?: boolean; canDodge?: boolean }
  | { kind: 'heal'; amount: number }
  | { kind: 'shield'; amount: number; duration?: number }
  | {
      kind: 'applyStatus'; target: EffectTarget; chance?: number
      statusId?: string; effect?: EffectInline; duration?: number
    }
```

- [ ] **Step 2: Modify `types/spell.ts`** — add three optional fields to `Spell` (after `effects?`), plus the type-only import. Replace the `Spell` interface block:

```ts
import type { EffectSpec, EffectTarget } from './status'

export type SpellType = 'Attacco' | 'Difesa' | 'Cura' | 'Controllo'
export type Stat = 'hp' | 'atk' | 'def' | 'spd'

export interface SpellEffect {
  kind: 'buff' | 'debuff' | 'dot' | 'stun'
  stat?: Stat
  amount?: number
  duration?: number
}

export interface Spell {
  id: string
  name: string
  desc: string
  type: SpellType
  power?: number
  heal?: number
  hitChance: number
  cooldown?: number
  effects?: SpellEffect[]
  spec?: EffectSpec[]
  target?: EffectTarget
  priority?: number
}
```

- [ ] **Step 3: Modify `types/combat.ts`** — widen `ActiveEffect` (lines 11-16). Replace that interface and update the `kind` import:

```ts
import type { Spell, SpellType, Stat } from './spell'
import type { StatusKind } from './status'
import type { Stats, Wizard } from './wizard'
```

```ts
export interface ActiveEffect {
  kind: StatusKind
  stat?: Stat
  amount?: number
  remaining: number
  statusId?: string
  stacks?: number
  sourceId?: string
  absorbLeft?: number
}
```

- [ ] **Step 4: Modify `types/index.ts`** — add the export line:

```ts
export * from './spell'
export * from './wizard'
export * from './synergy'
export * from './combat'
export * from './run'
export * from './status'
```

- [ ] **Step 5: Append structural test to `tests/types.test.ts`**

```ts
import type { StatusDef, EffectSpec, ActiveEffect } from '@/types'

describe('status types', () => {
  it('ActiveEffect accepts legacy and extended shapes', () => {
    const legacy: ActiveEffect = { kind: 'dot', amount: 10, remaining: 2 }
    const extended: ActiveEffect = { kind: 'shield', remaining: 3, statusId: 'shield', absorbLeft: 60, sourceId: 'left:harry' }
    expect(legacy.kind).toBe('dot')
    expect(extended.absorbLeft).toBe(60)
  })
  it('EffectSpec union covers damage/heal/shield/applyStatus', () => {
    const specs: EffectSpec[] = [
      { kind: 'damage', power: 1.4, canCrit: true, canDodge: true },
      { kind: 'heal', amount: 20 },
      { kind: 'shield', amount: 40, duration: 3 },
      { kind: 'applyStatus', target: 'enemy', statusId: 'burn' },
    ]
    expect(specs).toHaveLength(4)
  })
  it('StatusDef shape is well-formed', () => {
    const def: StatusDef = { id: 'x', name: 'X', kind: 'dot', family: 'dot', defaultDuration: 2, stack: 'stack', priority: 10, removable: true }
    expect(def.id).toBe('x')
  })
})
```

> Note: `tests/types.test.ts` already imports `describe/it/expect` from vitest at the top — reuse them; do not re-import.

- [ ] **Step 6: Verify typecheck + types test**

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

Run: `npx vitest run tests/types.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add types tests/types.test.ts
git commit -m "feat(types): status & effect type foundation (superset ActiveEffect)"
```

---

### Task 2: Status registry data

**Files:**
- Create: `data/statuses.ts`
- Test: `tests/data/statuses.test.ts`

**Interfaces:**
- Consumes: `StatusDef` (Task 1).
- Produces: `STATUS_DEFS: StatusDef[]`, `STATUS_BY_ID: Record<string, StatusDef>`.

- [ ] **Step 1: Write the failing test `tests/data/statuses.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { STATUS_DEFS, STATUS_BY_ID } from '@/data/statuses'

describe('statuses data', () => {
  it('has unique ids', () => {
    expect(new Set(STATUS_DEFS.map(s => s.id)).size).toBe(STATUS_DEFS.length)
  })
  it('covers every family', () => {
    const fams = new Set(STATUS_DEFS.map(s => s.family))
    expect(fams).toEqual(new Set(['control', 'dot', 'regen', 'shield', 'buff', 'debuff']))
  })
  it('field coherence per family', () => {
    for (const d of STATUS_DEFS) {
      if (d.family === 'control') expect(d.prevents?.length).toBeGreaterThan(0)
      if (d.family === 'dot') expect(d.tickDamage ?? 0).toBeGreaterThan(0)
      if (d.family === 'regen') expect(d.tickHeal ?? 0).toBeGreaterThan(0)
      if (d.family === 'shield') expect(d.absorb ?? 0).toBeGreaterThan(0)
      if (d.family === 'buff' || d.family === 'debuff') expect(d.statMod).toBeTruthy()
      expect(d.defaultDuration).toBeGreaterThan(0)
    }
  })
  it('lookup map matches array', () => {
    expect(Object.keys(STATUS_BY_ID).length).toBe(STATUS_DEFS.length)
    expect(STATUS_BY_ID['burn']?.tickDamage).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/statuses.test.ts`
Expected: FAIL ("Failed to resolve import '@/data/statuses'").

- [ ] **Step 3: Create `data/statuses.ts`**

```ts
import type { StatusDef } from '@/types'

export const STATUS_DEFS: StatusDef[] = [
  { id: 'stun', name: 'Stordito', kind: 'stun', family: 'control', prevents: ['action'], defaultDuration: 1, stack: 'refresh', priority: 100, removable: false },
  { id: 'freeze', name: 'Congelamento', kind: 'freeze', family: 'control', prevents: ['action'], defaultDuration: 1, stack: 'refresh', priority: 100, removable: true },
  { id: 'silence', name: 'Silenziato', kind: 'silence', family: 'control', prevents: ['spell'], defaultDuration: 2, stack: 'refresh', priority: 90, removable: true },
  { id: 'disarm', name: 'Disarmato', kind: 'disarm', family: 'control', prevents: ['attack'], defaultDuration: 2, stack: 'refresh', priority: 90, removable: true },
  { id: 'burn', name: 'Bruciatura', kind: 'dot', family: 'dot', tickDamage: 8, defaultDuration: 2, stack: 'stack', maxStacks: 3, priority: 50, removable: true },
  { id: 'regen', name: 'Rigenerazione', kind: 'regen', family: 'regen', tickHeal: 12, defaultDuration: 3, stack: 'refresh', priority: 40, removable: true },
  { id: 'shield', name: 'Scudo', kind: 'shield', family: 'shield', absorb: 50, defaultDuration: 3, stack: 'refresh', priority: 10, removable: true },
  { id: 'atkUp', name: 'Forza', kind: 'buff', family: 'buff', statMod: { stat: 'atk', amount: 20 }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'defUp', name: 'Difesa Rinforzata', kind: 'buff', family: 'buff', statMod: { stat: 'def', amount: 25 }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 15 }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
]

export const STATUS_BY_ID: Record<string, StatusDef> = Object.fromEntries(
  STATUS_DEFS.map(s => [s.id, s]),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/statuses.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add data/statuses.ts tests/data/statuses.test.ts
git commit -m "feat(data): StatusDef registry covering all status families"
```

---

### Task 3: status.ts core — stats, tick, apply

**Files:**
- Create: `game/engine/status.ts`
- Modify: `game/engine/combat/resolve.ts` (remove `effectiveStats`/`tickStatuses` bodies, re-export from `status.ts`)
- Test: `tests/engine/status.test.ts`

**Interfaces:**
- Consumes: `STATUS_BY_ID` (Task 2), `BALANCE`, `Rng`, `BattleUnit`, `ActiveEffect`, `LogEntry`, `Stats`.
- Produces:
  - `effectiveStats(unit: BattleUnit): Stats`
  - `tickStatuses(turn: number, unit: BattleUnit): LogEntry[]`
  - `applyStatus(unit: BattleUnit, statusId: string, opts?: { duration?: number; sourceId?: string }): void`
  - `applyInlineEffect(unit: BattleUnit, eff: { kind: ActiveEffect['kind']; stat?: Stat; amount?: number; duration?: number }, opts?: { sourceId?: string }): void`

- [ ] **Step 1: Write the failing test `tests/engine/status.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { effectiveStats, tickStatuses, applyStatus, applyInlineEffect } from '@/game/engine/status'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 120, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('status core', () => {
  it('applyStatus(atkUp) raises effective atk via def statMod', () => {
    const u = unit()
    applyStatus(u, 'atkUp')
    expect(effectiveStats(u).atk).toBe(100) // 80 + 20
  })
  it('applyStatus(slow) lowers effective spd', () => {
    const u = unit()
    applyStatus(u, 'slow')
    expect(effectiveStats(u).spd).toBe(25) // 40 - 15
  })
  it('refresh stack policy resets duration, no duplicate', () => {
    const u = unit()
    applyStatus(u, 'slow', { duration: 1 })
    applyStatus(u, 'slow', { duration: 3 })
    const slows = u.statusEffects.filter(e => e.statusId === 'slow')
    expect(slows).toHaveLength(1)
    expect(slows[0]?.remaining).toBe(3)
  })
  it('stack policy (burn) adds instances up to maxStacks', () => {
    const u = unit()
    applyStatus(u, 'burn'); applyStatus(u, 'burn'); applyStatus(u, 'burn'); applyStatus(u, 'burn')
    expect(u.statusEffects.filter(e => e.statusId === 'burn')).toHaveLength(3)
  })
  it('tickStatuses applies burn tickDamage and regen tickHeal', () => {
    const u = unit({ hp: 50 })
    applyStatus(u, 'burn', { duration: 2 })
    applyStatus(u, 'regen', { duration: 2 })
    const logs = tickStatuses(1, u)
    expect(u.hp).toBe(50 - 8 + 12)
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })
  it('legacy inline dot still ticks (back-compat)', () => {
    const u = unit({ statusEffects: [{ kind: 'dot', amount: 10, remaining: 2 }] })
    tickStatuses(1, u)
    expect(u.hp).toBe(110)
    expect(u.statusEffects[0]?.remaining).toBe(1)
  })
  it('applyInlineEffect pushes legacy-shaped effect', () => {
    const u = unit()
    applyInlineEffect(u, { kind: 'debuff', stat: 'def', amount: 20, duration: 2 })
    expect(u.statusEffects[0]).toMatchObject({ kind: 'debuff', stat: 'def', amount: 20, remaining: 2 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/status.test.ts`
Expected: FAIL ("Failed to resolve import '@/game/engine/status'").

- [ ] **Step 3: Create `game/engine/status.ts`**

```ts
import type { ActiveEffect, BattleUnit, LogEntry, Stat, Stats } from '@/types'
import { STATUS_BY_ID } from '@/data/statuses'

/** statMod for an active effect: prefer its StatusDef, fall back to legacy inline fields. */
function statModOf(e: ActiveEffect): { stat: Stat; delta: number; pct: boolean } | null {
  if (e.statusId) {
    const def = STATUS_BY_ID[e.statusId]
    if (def?.statMod) {
      const sign = def.kind === 'debuff' ? -1 : 1
      return { stat: def.statMod.stat, delta: sign * def.statMod.amount, pct: def.statMod.pct ?? false }
    }
    return null
  }
  if ((e.kind === 'buff' || e.kind === 'debuff') && e.stat && e.amount) {
    return { stat: e.stat, delta: e.kind === 'buff' ? e.amount : -e.amount, pct: false }
  }
  return null
}

function priorityOf(e: ActiveEffect): number {
  return e.statusId ? (STATUS_BY_ID[e.statusId]?.priority ?? 50) : 50
}

export function effectiveStats(unit: BattleUnit): Stats {
  const s: Stats = { ...unit.buffedStats }
  const mods = unit.statusEffects
    .map(statModOf)
    .filter((m): m is { stat: Stat; delta: number; pct: boolean } => m !== null)
  // deterministic: flat mods first, then pct; stable by nothing else needed (commutative sums)
  for (const m of mods.filter(m => !m.pct)) s[m.stat] = Math.max(1, s[m.stat] + m.delta)
  for (const m of mods.filter(m => m.pct)) s[m.stat] = Math.max(1, Math.round(s[m.stat] * (1 + m.delta / 100)))
  return s
}

export function applyStatus(
  unit: BattleUnit, statusId: string, opts: { duration?: number; sourceId?: string } = {},
): void {
  const def = STATUS_BY_ID[statusId]
  if (!def) return
  const remaining = opts.duration ?? def.defaultDuration
  const existing = unit.statusEffects.filter(e => e.statusId === statusId)
  if (existing.length > 0) {
    if (def.stack === 'ignore') return
    if (def.stack === 'refresh') { existing[0]!.remaining = remaining; return }
    if (def.stack === 'extend') { existing[0]!.remaining += remaining; return }
    if (def.stack === 'stack' && def.maxStacks && existing.length >= def.maxStacks) return
  }
  unit.statusEffects.push({
    kind: def.kind, statusId, remaining, stacks: 1, sourceId: opts.sourceId,
    stat: def.statMod?.stat, amount: def.statMod?.amount, absorbLeft: def.absorb,
  })
}

export function applyInlineEffect(
  unit: BattleUnit,
  eff: { kind: ActiveEffect['kind']; stat?: Stat; amount?: number; duration?: number },
  opts: { sourceId?: string } = {},
): void {
  unit.statusEffects.push({
    kind: eff.kind, stat: eff.stat, amount: eff.amount,
    remaining: eff.duration ?? 1, sourceId: opts.sourceId,
  })
}

export function tickStatuses(turn: number, unit: BattleUnit): LogEntry[] {
  const logs: LogEntry[] = []
  for (const e of unit.statusEffects) {
    const def = e.statusId ? STATUS_BY_ID[e.statusId] : undefined
    const tickDamage = def?.tickDamage ?? (e.kind === 'dot' ? e.amount : undefined)
    const tickHeal = def?.tickHeal
    if (tickDamage) {
      unit.hp -= tickDamage
      logs.push({ turn, actorId: unit.wizard.id, actorSide: unit.side, action: def?.name ?? 'Veleno',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Controllo', value: tickDamage, flags: ['dot'] })
    }
    if (tickHeal) {
      unit.hp = Math.min(unit.maxHp, unit.hp + tickHeal)
      logs.push({ turn, actorId: unit.wizard.id, actorSide: unit.side, action: def?.name ?? 'Rigenerazione',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Cura', value: tickHeal, flags: ['heal'] })
    }
    e.remaining -= 1
  }
  unit.statusEffects = unit.statusEffects.filter(e => e.remaining > 0)
  for (const id of Object.keys(unit.cooldowns)) {
    unit.cooldowns[id] = Math.max(0, (unit.cooldowns[id] ?? 0) - 1)
  }
  return logs
}

// Note: priorityOf reserved for future ordered resolution; flat+pct split above is order-independent.
void priorityOf
```

> The `void priorityOf` line keeps the helper without an "unused" strict error; Task 4 will use it if needed, otherwise leave as-is. If `noUnusedLocals` complains differently, inline-delete `priorityOf` and the `void` line.

- [ ] **Step 4: Replace bodies in `game/engine/combat/resolve.ts` with re-exports**

Remove the `effectiveStats` function (lines ~5-14) and the `tickStatuses` function (lines ~77-94) from `resolve.ts`. At the top of `resolve.ts`, add:

```ts
import { effectiveStats, tickStatuses } from '../status'
export { effectiveStats, tickStatuses }
```

Keep `computeDamage`/`dodged`/`resolveAction` as-is for now (Task 7 refactors `resolveAction`). `computeDamage` and `dodged` already call `effectiveStats` — they now use the imported one.

- [ ] **Step 5: Run tests to verify both old and new pass**

Run: `npx vitest run tests/engine/status.test.ts tests/engine/combat/resolve.test.ts`
Expected: PASS (status: 7 tests; resolve: existing tests still green via re-export).

- [ ] **Step 6: Commit**

```bash
git add game/engine/status.ts game/engine/combat/resolve.ts tests/engine/status.test.ts
git commit -m "feat(engine): pure status module (apply/tick/effectiveStats) with back-compat"
```

---

### Task 4: status.ts guards — shield absorb & action gates

**Files:**
- Modify: `game/engine/status.ts` (add functions)
- Test: `tests/engine/status.test.ts` (append)

**Interfaces:**
- Consumes: `STATUS_BY_ID`, `BattleUnit`, `ActiveEffect`, `ActionGate`.
- Produces:
  - `absorbDamage(unit: BattleUnit, dmg: number): number` (residual after shields)
  - `canAct(unit: BattleUnit): boolean`
  - `canCastSpell(unit: BattleUnit): boolean`
  - `canAttack(unit: BattleUnit): boolean`

- [ ] **Step 1: Append failing tests to `tests/engine/status.test.ts`**

```ts
import { absorbDamage, canAct, canCastSpell, canAttack } from '@/game/engine/status'

describe('status guards', () => {
  it('shield absorbs damage before hp', () => {
    const u = unit()
    applyStatus(u, 'shield', { duration: 3 }) // absorb 50
    const residual = absorbDamage(u, 30)
    expect(residual).toBe(0)
    expect(u.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft).toBe(20)
    const residual2 = absorbDamage(u, 30)
    expect(residual2).toBe(10) // 30 - 20 remaining
  })
  it('stun blocks action, allows nothing extra', () => {
    const u = unit(); applyStatus(u, 'stun')
    expect(canAct(u)).toBe(false)
  })
  it('legacy inline stun also blocks action', () => {
    const u = unit({ statusEffects: [{ kind: 'stun', remaining: 1 }] })
    expect(canAct(u)).toBe(false)
  })
  it('silence blocks spells but not action', () => {
    const u = unit(); applyStatus(u, 'silence')
    expect(canCastSpell(u)).toBe(false)
    expect(canAct(u)).toBe(true)
  })
  it('disarm blocks attacks but not spells', () => {
    const u = unit(); applyStatus(u, 'disarm')
    expect(canAttack(u)).toBe(false)
    expect(canCastSpell(u)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/status.test.ts`
Expected: FAIL ("absorbDamage is not exported" / not a function).

- [ ] **Step 3: Add functions to `game/engine/status.ts`**

```ts
import type { ActionGate } from '@/types'

function preventsOf(e: ActiveEffect): ActionGate[] {
  if (e.statusId) return STATUS_BY_ID[e.statusId]?.prevents ?? []
  return e.kind === 'stun' ? ['action'] : []
}

function gated(unit: BattleUnit, gate: ActionGate): boolean {
  return unit.statusEffects.some(e => preventsOf(e).includes(gate))
}

export function canAct(unit: BattleUnit): boolean { return !gated(unit, 'action') }
export function canCastSpell(unit: BattleUnit): boolean { return canAct(unit) && !gated(unit, 'spell') }
export function canAttack(unit: BattleUnit): boolean { return canAct(unit) && !gated(unit, 'attack') }

export function absorbDamage(unit: BattleUnit, dmg: number): number {
  let remaining = dmg
  const shields = unit.statusEffects
    .filter(e => e.statusId === 'shield' && (e.absorbLeft ?? 0) > 0)
    .sort((a, b) => a.remaining - b.remaining || (a.sourceId ?? '').localeCompare(b.sourceId ?? ''))
  for (const s of shields) {
    if (remaining <= 0) break
    const left = s.absorbLeft ?? 0
    const used = Math.min(left, remaining)
    s.absorbLeft = left - used
    remaining -= used
  }
  return remaining
}
```

> Add the `import type { ActionGate }` to the existing top import group (merge with the `@/types` import line). Remove the now-redundant `void priorityOf` only if `priorityOf` is otherwise unused; leaving it is harmless.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine/status.test.ts`
Expected: PASS (all status tests).

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add game/engine/status.ts tests/engine/status.test.ts
git commit -m "feat(engine): shield absorption + action/spell/attack gates"
```

---

### Task 5: normalizeSpell adapter

**Files:**
- Create: `game/engine/combat/normalizeSpell.ts`
- Test: `tests/engine/combat/normalizeSpell.test.ts`

**Interfaces:**
- Consumes: `Spell`, `EffectSpec` (Task 1).
- Produces: `normalizeSpell(spell: Spell): EffectSpec[]`.
- Behavior contract (must match current `resolveAction`):
  - `Cura` → `[{ kind:'heal', amount: heal }]` (legacy ignores Cura's `effects`, so we do too).
  - `Difesa` → each `SpellEffect` → `{ kind:'applyStatus', target:'self', effect:{...} }`.
  - `Attacco`/`Controllo` → if `power>0` prepend `{ kind:'damage', power, canCrit:true, canDodge:true }`; each `SpellEffect` → `{ kind:'applyStatus', target:'enemy', effect:{...} }`.
  - If `spell.spec` present, return it verbatim.

- [ ] **Step 1: Write failing test `tests/engine/combat/normalizeSpell.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { normalizeSpell } from '@/game/engine/combat/normalizeSpell'
import { SPELL_BY_ID } from '@/data/spells'

describe('normalizeSpell', () => {
  it('heal spell → single heal effect', () => {
    expect(normalizeSpell(SPELL_BY_ID['vulnera']!)).toEqual([{ kind: 'heal', amount: 48 }])
  })
  it('plain attack → damage with crit+dodge', () => {
    expect(normalizeSpell(SPELL_BY_ID['expelliarmus']!)).toEqual([
      { kind: 'damage', power: 1.4, canCrit: true, canDodge: true },
    ])
  })
  it('attack with stun → damage then applyStatus(enemy)', () => {
    expect(normalizeSpell(SPELL_BY_ID['stupeficium']!)).toEqual([
      { kind: 'damage', power: 1.6, canCrit: true, canDodge: true },
      { kind: 'applyStatus', target: 'enemy', effect: { kind: 'stun', stat: undefined, amount: undefined, duration: 1 } },
    ])
  })
  it('control with power 0 → only applyStatus, no damage', () => {
    expect(normalizeSpell(SPELL_BY_ID['imperio']!)).toEqual([
      { kind: 'applyStatus', target: 'enemy', effect: { kind: 'stun', stat: undefined, amount: undefined, duration: 2 } },
    ])
  })
  it('defense buff → applyStatus(self)', () => {
    expect(normalizeSpell(SPELL_BY_ID['protego']!)).toEqual([
      { kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'def', amount: 25, duration: 2 } },
    ])
  })
  it('spell.spec is returned verbatim', () => {
    const spec = [{ kind: 'shield', amount: 60, duration: 3 }] as const
    const fake = { id: 'x', name: 'X', desc: '', type: 'Difesa', hitChance: 1, spec: [...spec] } as const
    expect(normalizeSpell({ ...fake })).toEqual([...spec])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/combat/normalizeSpell.test.ts`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Create `game/engine/combat/normalizeSpell.ts`**

```ts
import type { EffectSpec, Spell } from '@/types'

export function normalizeSpell(spell: Spell): EffectSpec[] {
  if (spell.spec) return spell.spec

  if (spell.type === 'Cura') {
    return [{ kind: 'heal', amount: spell.heal ?? 0 }]
  }

  if (spell.type === 'Difesa') {
    return (spell.effects ?? []).map(e => ({
      kind: 'applyStatus' as const, target: 'self' as const,
      effect: { kind: e.kind, stat: e.stat, amount: e.amount, duration: e.duration },
    }))
  }

  // Attacco | Controllo
  const out: EffectSpec[] = []
  const power = spell.power ?? 0
  if (power > 0) out.push({ kind: 'damage', power, canCrit: true, canDodge: true })
  for (const e of spell.effects ?? []) {
    out.push({
      kind: 'applyStatus', target: 'enemy',
      effect: { kind: e.kind, stat: e.stat, amount: e.amount, duration: e.duration },
    })
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine/combat/normalizeSpell.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/normalizeSpell.ts tests/engine/combat/normalizeSpell.test.ts
git commit -m "feat(engine): normalizeSpell adapter (legacy spell -> EffectSpec[])"
```

---

### Task 6: EFFECT_HANDLERS registry

**Files:**
- Create: `game/engine/combat/effects.ts`
- Test: `tests/engine/combat/effects.test.ts`

**Interfaces:**
- Consumes: `Rng`, `BattleUnit`, `LogFlag`, `EffectSpec`, `BALANCE`; `effectiveStats`, `applyStatus`, `applyInlineEffect`, `absorbDamage`, `canAttack` (Tasks 3-4); `STATUS_BY_ID`.
- Produces:
  - `type EffectCtx = { rng: Rng; turn: number; actor: BattleUnit; target: BattleUnit; flags: LogFlag[] }`
  - `type EffectResult = { value?: number; dodged?: boolean }`
  - `EFFECT_HANDLERS: Record<EffectSpec['kind'], (ctx: EffectCtx, eff: EffectSpec) => EffectResult>`
  - `computeDamage(rng, actor, target, power, flags): number` (moved from resolve.ts)
  - `dodged(rng, actor, target): boolean` (moved from resolve.ts)

- [ ] **Step 1: Write failing test `tests/engine/combat/effects.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import type { BattleUnit, DraftedWizard, LogFlag } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import type { Rng } from '@/game/engine/rng'

function unit(over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 120, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}
const noChance: Rng = { next: () => 0, int: () => 0, chance: () => false,
  pick: <T,>(a: readonly T[]) => a[0]!, shuffle: <T,>(a: readonly T[]) => [...a], fork: () => noChance }
const always: Rng = { ...noChance, chance: () => true, fork: () => always }

describe('EFFECT_HANDLERS', () => {
  it('damage reduces hp and returns value', () => {
    const a = unit(); const b = unit({ side: 'right' })
    const flags: LogFlag[] = []
    const r = EFFECT_HANDLERS.damage({ rng: noChance, turn: 1, actor: a, target: b, flags }, { kind: 'damage', power: 1.4, canDodge: true, canCrit: true })
    expect(r.value).toBeGreaterThan(0)
    expect(b.hp).toBeLessThan(120)
  })
  it('damage dodge returns dodged and leaves hp', () => {
    const a = unit(); const b = unit({ side: 'right' })
    const flags: LogFlag[] = []
    const r = EFFECT_HANDLERS.damage({ rng: always, turn: 1, actor: a, target: b, flags }, { kind: 'damage', power: 1.4, canDodge: true })
    expect(r.dodged).toBe(true)
    expect(b.hp).toBe(120)
    expect(flags).toContain('dodge')
  })
  it('heal raises hp capped at max', () => {
    const a = unit(); const b = unit({ side: 'left', hp: 10 })
    const flags: LogFlag[] = []
    const r = EFFECT_HANDLERS.heal({ rng: noChance, turn: 1, actor: a, target: b, flags }, { kind: 'heal', amount: 30 })
    expect(b.hp).toBe(40); expect(r.value).toBe(30); expect(flags).toContain('heal')
  })
  it('shield pushes a shield status with absorbLeft', () => {
    const a = unit()
    const flags: LogFlag[] = []
    EFFECT_HANDLERS.shield({ rng: noChance, turn: 1, actor: a, target: a, flags }, { kind: 'shield', amount: 60, duration: 3 })
    expect(a.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft).toBe(60)
  })
  it('applyStatus(statusId) applies a def-driven status', () => {
    const a = unit(); const b = unit({ side: 'right' })
    EFFECT_HANDLERS.applyStatus({ rng: noChance, turn: 1, actor: a, target: b, flags: [] }, { kind: 'applyStatus', target: 'enemy', statusId: 'burn' })
    expect(b.statusEffects.some(e => e.statusId === 'burn')).toBe(true)
  })
  it('applyStatus(inline stun) pushes legacy stun + flag', () => {
    const a = unit(); const b = unit({ side: 'right' }); const flags: LogFlag[] = []
    EFFECT_HANDLERS.applyStatus({ rng: noChance, turn: 1, actor: a, target: b, flags }, { kind: 'applyStatus', target: 'enemy', effect: { kind: 'stun', duration: 1 } })
    expect(b.statusEffects.some(e => e.kind === 'stun')).toBe(true)
    expect(flags).toContain('stun')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/combat/effects.test.ts`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Create `game/engine/combat/effects.ts`**

```ts
import type { BattleUnit, EffectSpec, LogFlag } from '@/types'
import type { Rng } from '../rng'
import { BALANCE } from '@/data/constants'
import { STATUS_BY_ID } from '@/data/statuses'
import { absorbDamage, applyInlineEffect, applyStatus, canAttack, effectiveStats } from '../status'

export interface EffectCtx { rng: Rng; turn: number; actor: BattleUnit; target: BattleUnit; flags: LogFlag[] }
export interface EffectResult { value?: number; dodged?: boolean }

export function computeDamage(rng: Rng, actor: BattleUnit, target: BattleUnit, power: number, flags: LogFlag[]): number {
  const c = BALANCE.combat
  const atk = effectiveStats(actor).atk
  const def = effectiveStats(target).def
  let dmg = atk * power - def * c.defenseK
  dmg = Math.max(c.minDamage, dmg)
  const critChance = c.critBase + effectiveStats(actor).spd * c.critSpdScale
  if (rng.chance(critChance)) { dmg *= c.critMult; flags.push('crit') }
  return Math.round(dmg)
}

export function dodged(rng: Rng, actor: BattleUnit, target: BattleUnit): boolean {
  const c = BALANCE.combat
  const gap = effectiveStats(target).spd - effectiveStats(actor).spd
  const chance = Math.max(0, c.dodgeBase + gap * c.dodgeScale)
  return rng.chance(chance)
}

function sourceId(u: BattleUnit): string { return `${u.side}:${u.wizard.id}` }

export const EFFECT_HANDLERS: Record<EffectSpec['kind'], (ctx: EffectCtx, eff: EffectSpec) => EffectResult> = {
  damage: (ctx, eff) => {
    if (eff.kind !== 'damage') return {}
    if (eff.canDodge && dodged(ctx.rng, ctx.actor, ctx.target)) {
      ctx.flags.push('dodge'); return { value: 0, dodged: true }
    }
    if (!canAttack(ctx.actor)) return { value: 0 } // disarmed: no damage
    const dmg = computeDamage(ctx.rng, ctx.actor, ctx.target, eff.power, ctx.flags)
    const residual = absorbDamage(ctx.target, dmg)
    ctx.target.hp -= residual
    return { value: dmg }
  },
  heal: (ctx, eff) => {
    if (eff.kind !== 'heal') return {}
    ctx.target.hp = Math.min(ctx.target.maxHp, ctx.target.hp + eff.amount)
    ctx.flags.push('heal')
    return { value: eff.amount }
  },
  shield: (ctx, eff) => {
    if (eff.kind !== 'shield') return {}
    ctx.target.statusEffects.push({
      kind: 'shield', statusId: 'shield', remaining: eff.duration ?? STATUS_BY_ID['shield']!.defaultDuration,
      stacks: 1, sourceId: sourceId(ctx.actor), absorbLeft: eff.amount,
    })
    ctx.flags.push('block')
    return {}
  },
  applyStatus: (ctx, eff) => {
    if (eff.kind !== 'applyStatus') return {}
    if (eff.chance !== undefined && !ctx.rng.chance(eff.chance)) return {}
    const unit = eff.target === 'self' ? ctx.actor : ctx.target
    if (eff.statusId) {
      applyStatus(unit, eff.statusId, { duration: eff.duration, sourceId: sourceId(ctx.actor) })
      const def = STATUS_BY_ID[eff.statusId]
      if (def?.kind === 'stun' || def?.kind === 'freeze') ctx.flags.push('stun')
      if (def?.kind === 'dot') ctx.flags.push('dot')
    } else if (eff.effect) {
      applyInlineEffect(unit, eff.effect, { sourceId: sourceId(ctx.actor) })
      if (eff.effect.kind === 'stun') ctx.flags.push('stun')
      if (eff.effect.kind === 'dot') ctx.flags.push('dot')
    }
    return {}
  },
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine/combat/effects.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/effects.ts tests/engine/combat/effects.test.ts
git commit -m "feat(engine): EFFECT_HANDLERS registry (damage/heal/shield/applyStatus)"
```

---

### Task 7: Refactor resolveAction to the interpreter

**Files:**
- Modify: `game/engine/combat/resolve.ts`
- Test: `tests/engine/combat/resolve.test.ts` (must stay green, unchanged)

**Interfaces:**
- Consumes: `normalizeSpell` (Task 5), `EFFECT_HANDLERS`, `EffectCtx` (Task 6); re-exports `effectiveStats`, `tickStatuses` (Task 3).
- Produces: `resolveAction(rng, turn, actor, target, spell): LogEntry` (unchanged signature & behavior for existing spells).

- [ ] **Step 1: Rewrite `game/engine/combat/resolve.ts`**

```ts
import type { BattleUnit, LogEntry, LogFlag, Spell } from '@/types'
import type { Rng } from '../rng'
import { effectiveStats, tickStatuses } from '../status'
import { EFFECT_HANDLERS } from './effects'
import { normalizeSpell } from './normalizeSpell'

export { effectiveStats, tickStatuses }

export function resolveAction(
  rng: Rng, turn: number, actor: BattleUnit, target: BattleUnit, spell: Spell,
): LogEntry {
  const flags: LogFlag[] = []
  let value: number | undefined

  if (spell.cooldown && spell.cooldown > 0) actor.cooldowns[spell.id] = spell.cooldown

  const ctx = { rng, turn, actor, target, flags }
  for (const eff of normalizeSpell(spell)) {
    const r = EFFECT_HANDLERS[eff.kind](ctx, eff)
    if (r.dodged) { value = 0; break }
    if (r.value !== undefined && value === undefined) value = r.value
  }

  if (spell.type === 'Difesa') flags.push('block') // log tagging only

  return {
    turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
    targetId: target.wizard.id, targetSide: target.side, type: spell.type, value, flags,
  }
}
```

> Behavior preserved: dodge short-circuits remaining effects and sets `value=0` + `dodge` flag (matches old `if (dodged) {...} else {...}`). Damage/heal set `value`; status effects push `stun`/`dot` flags. `block` added for `Difesa`. Cooldown set up-front as before.

- [ ] **Step 2: Run the existing resolve suite (must pass unchanged)**

Run: `npx vitest run tests/engine/combat/resolve.test.ts`
Expected: PASS (all original resolve tests: attack reduces hp, minDamage, heal, debuff lowers stat, dot tick, cooldown, crit, dodge, stupeficium stun, crucio dual effects).

- [ ] **Step 3: Run combat + simulate suites**

Run: `npx vitest run tests/engine/combat tests/engine/balance.test.ts`
Expected: PASS.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/resolve.ts
git commit -m "refactor(engine): resolveAction interprets EffectSpec[] (kills if/else)"
```

---

### Task 8: Wire silence (selectSpell) & generalized stun/freeze (simulate)

**Files:**
- Modify: `game/engine/combat/selectSpell.ts`
- Modify: `game/engine/combat/simulate.ts:23-25,61-65`
- Test: `tests/engine/combat/selection.test.ts` (append) ; existing `simulate.test.ts` stays green

**Interfaces:**
- Consumes: `canCastSpell`, `canAct` (Task 4).
- Produces: `selectSpell` (silenced → base attack); `simulate` skips units where `!canAct`.

- [ ] **Step 1: Append failing test to `tests/engine/combat/selection.test.ts`**

```ts
import { canCastSpell } from '@/game/engine/status'

describe('silence fallback', () => {
  it('silenced unit selects base attack instead of its spell', () => {
    // build a unit whose spell is a heal, then silence it
    const stats = { hp: 100, atk: 50, def: 20, spd: 30 }
    const u = {
      wizard: { id: 's', name: 's', house: 'Grifondoro', role: 'Supporto', tier: 3,
        ranges: { hp: [100,100], atk: [50,50], def: [20,20], spd: [30,30] }, spellPool: ['vulnera'] },
      stats, maxHp: 100, spell: SPELL_BY_ID['vulnera']!,
      side: 'left' as const, hp: 100, cooldowns: {}, statusEffects: [{ kind: 'silence' as const, statusId: 'silence', remaining: 2 }], buffedStats: stats, alive: true,
    }
    expect(canCastSpell(u)).toBe(false)
    expect(selectSpell(u).id).toBe('base_attack')
  })
})
```

> `selectSpell` and `SPELL_BY_ID` are already imported at the top of `selection.test.ts`. If not, add: `import { selectSpell } from '@/game/engine/combat/selectSpell'` and `import { SPELL_BY_ID } from '@/data/spells'`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/combat/selection.test.ts`
Expected: FAIL (silenced unit still returns `vulnera`).

- [ ] **Step 3: Modify `game/engine/combat/selectSpell.ts`**

```ts
import type { BattleUnit, Spell } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { canCastSpell } from '../status'

export function selectSpell(unit: BattleUnit): Spell {
  if (!canCastSpell(unit)) return SPELL_BY_ID['base_attack']!
  const onCooldown = (unit.cooldowns[unit.spell.id] ?? 0) > 0
  if (onCooldown) return SPELL_BY_ID['base_attack']!
  return unit.spell
}

export function wantsHeal(actor: BattleUnit, spell: Spell): boolean {
  return spell.type === 'Cura'
}
```

- [ ] **Step 4: Modify `game/engine/combat/simulate.ts`** — replace the `isStunned` helper and its usage with `canAct`.

Replace the helper (lines ~23-25):

```ts
import { canAct } from '../status'
```

Delete the local `isStunned` function. In the turn loop, replace `if (isStunned(actor)) {` with `if (!canAct(actor)) {` (the logged entry and `continue` stay the same).

- [ ] **Step 5: Run selection + simulate + full combat**

Run: `npx vitest run tests/engine/combat`
Expected: PASS (silence test green; simulate stun behavior unchanged — `canAct` returns false for stun just like before).

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/selectSpell.ts game/engine/combat/simulate.ts tests/engine/combat/selection.test.ts
git commit -m "feat(engine): silence falls back to base attack; stun/freeze via canAct"
```

---

### Task 9: Demonstration content + integration test + full green

**Files:**
- Modify: `data/spells.ts` (append 3 demo spells using new capabilities)
- Test: `tests/engine/combat/statusIntegration.test.ts`

**Interfaces:**
- Consumes: everything above. New spells: `glacius` (freeze via inline-style applyStatus), `silencio` (silence), `aegis` (shield via `spec`).
- Produces: 3 new entries in `SPELLS` (35 total). `spells.test.ts` uses `>= 30` and validates `Attacco→power>0`, `Cura→heal>0`; new spells are `Controllo`/`Difesa` so they pass.

- [ ] **Step 1: Append demo spells in `data/spells.ts`** (before the closing `]` of `SPELLS`)

```ts
  // demo: data-driven statuses (Status & Effect engine)
  { id: 'glacius', name: 'Glacius', desc: 'Congela il bersaglio.', type: 'Controllo', hitChance: 0.85, cooldown: 2,
    spec: [{ kind: 'applyStatus', target: 'enemy', statusId: 'freeze', duration: 1 }] },
  { id: 'silencio', name: 'Silencio', desc: 'Silenzia il bersaglio.', type: 'Controllo', hitChance: 0.9, cooldown: 2,
    spec: [{ kind: 'applyStatus', target: 'enemy', statusId: 'silence', duration: 2 }] },
  { id: 'aegis', name: 'Aegis', desc: 'Evoca uno scudo che assorbe danno.', type: 'Difesa', hitChance: 1, cooldown: 3,
    spec: [{ kind: 'shield', amount: 60, duration: 3 }] },
```

- [ ] **Step 2: Write integration test `tests/engine/combat/statusIntegration.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { selectSpell } from '@/game/engine/combat/selectSpell'
import { canAct, canCastSpell } from '@/game/engine/status'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('status integration', () => {
  it('aegis shield absorbs a subsequent attack (no hp loss until shield depletes)', () => {
    const caster = unit('c', 'aegis')
    resolveAction(createRng(1), 1, caster, caster, SPELL_BY_ID['aegis']!)
    expect(caster.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft).toBe(60)
    const attacker = unit('a', 'base_attack', { side: 'right', buffedStats: { hp: 120, atk: 100, def: 0, spd: 40 } })
    const hpBefore = caster.hp
    resolveAction(createRng(2), 2, attacker, caster, SPELL_BY_ID['flipendo']!)
    // small attack fully absorbed by 60-pt shield
    expect(caster.hp).toBe(hpBefore)
    expect((caster.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft ?? 0)).toBeLessThan(60)
  })
  it('glacius freezes: target cannot act', () => {
    const a = unit('a', 'glacius'); const b = unit('b', 'base_attack', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['glacius']!)
    expect(b.statusEffects.some(e => e.statusId === 'freeze')).toBe(true)
    expect(canAct(b)).toBe(false)
  })
  it('silencio silences: target falls back to base attack', () => {
    const a = unit('a', 'silencio'); const b = unit('b', 'sectumsempra', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['silencio']!)
    expect(canCastSpell(b)).toBe(false)
    expect(selectSpell(b).id).toBe('base_attack')
  })
})
```

- [ ] **Step 3: Run integration test**

Run: `npx vitest run tests/engine/combat/statusIntegration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Full suite + typecheck (regression gate)**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: PASS — **all original 154 tests plus the new tests** (types, statuses, status core+guards, normalizeSpell, effects, silence selection, integration). No failures.

- [ ] **Step 5: Commit**

```bash
git add data/spells.ts tests/engine/combat/statusIntegration.test.ts
git commit -m "feat(content): demo data-driven spells (glacius/silencio/aegis) + integration tests"
```

---

## Self-Review notes (author)

- **Spec coverage:** StatusDef registry (Task 2), rich lifecycle duration/stack/priority/removal/source (Tasks 2-4 via `StatusDef` + `ActiveEffect.sourceId/stacks`), EffectSpec interpreter replacing if/else (Tasks 5-7), all 10 status families (Task 2), silence/disarm/freeze/shield wired (Tasks 4,6,8,9), superset back-compat & 154 tests green (gates in Tasks 3,7,9), determinism preserved (RNG injected throughout). ✓
- **Priority ordering:** spec §4.4 mentions priority-ordered statMod; implementation applies flat-then-pct which is order-independent (sums commute), so explicit priority sort is unnecessary for correctness. `priorityOf` left as a reserved helper. Documented, not a gap.
- **Cura effects:** legacy `resolveAction` ignored `Cura.effects` (ferula's buff never applied). `normalizeSpell` preserves this exactly (Cura → heal only). Intentional behavior preservation, noted in Task 5.
- **Placeholder scan:** none. **Type consistency:** `effectiveStats`/`tickStatuses`/`applyStatus`/`absorbDamage`/`canAct`/`canCastSpell`/`canAttack`/`normalizeSpell`/`EFFECT_HANDLERS` names consistent across Tasks 3-9.
