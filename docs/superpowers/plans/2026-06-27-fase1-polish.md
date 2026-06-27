# Fase 1 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix combat correctness (cooldown wait, Protego spell-negation), surface wizard levels, replace house-selection with the classic 2-of-5 draft, give the map two nearby choices, add a persistent team+synergy panel, and restyle three screens.

**Architecture:** Pure engine in `game/engine/*` (combat in `combat/`, run loop in `runEngine.ts` + `resolvers/`), React screens in `components/screens/` orchestrated by `RunBRunner`, hooks in `hooks/`. Data catalogs in `data/`. Tests in `tests/` via vitest. Determinism via seeded `Rng` (`createRng`/`fork`).

**Tech Stack:** TypeScript, Next.js (app router), React, framer-motion, Tailwind, vitest + @testing-library/react.

## Global Constraints

- Combat engine stays pure: levels/map are data it consumes; no run-loop logic inside `combat/simulate.ts`.
- Determinism: same seed → same outcome. Never call `Date.now()`/`Math.random()` in engine; use the threaded `Rng`.
- New-loop balance lives in `BALANCE.campaignB` / `BALANCE.leveling` (never the legacy `BALANCE.campaign`).
- After every task: `npx tsc --noEmit` clean AND the full suite green (`npx vitest run`).
- The restored no-stalemate guard in `tests/engine/campaignBalanceB.test.ts` ("no battle stalls to the turn cap on any seed") MUST stay green. If a change breaks it, re-tune — do not weaken the test.
- `BALANCE.leveling.autoGrowthPct = 0.10`, `levelMax = 10`. `BALANCE.combat.turnCap = 100`. `BALANCE.map`: `floorsPerArea=5`, `minWidth=2`, `maxWidth=3`, `areas=3`.
- Commit after each task with a Conventional-Commit message; end commit bodies with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- `game/engine/combat/selectSpell.ts` — turn action choice (cooldown → wait).
- `game/engine/combat/simulate.ts` — turn loop (skip wait; pass allies to resolveAction).
- `game/engine/combat/resolve.ts` — spell resolution (Protego negation hook; allies in ctx).
- `game/engine/combat/effects.ts` — effect handlers (new `protego` handler).
- `game/engine/status.ts` — status helpers (new `consumeWard`).
- `data/statuses.ts` — new `protego` status def.
- `data/spells.ts` — Protego → ward spec; cooldown rebalance.
- `game/engine/resolvers/combat.ts` — `enemyLevel` derivation on the battle payload.
- `hooks/useRunB.combat.ts` — carry `enemyLevel` to UI.
- `components/battle/UnitBust.tsx`, `components/cards/WizardCard.tsx`, `components/cards/WizardCardRow.tsx` — level badge.
- `game/engine/map.ts` — nearest-2 edge wiring.
- `game/engine/draftSession.ts`, `hooks/useDraft.ts`, `components/screens/DraftScreen.tsx` — restored classic draft (retargeted to 2).
- `game/engine/runEngine.ts` — `draft` phase, 2-pick start, remove house/starter.
- `game/engine/recruit.ts` — drop house bias.
- `components/screens/RunBRunner.tsx` — draft phase wiring, persistent panel.
- `components/run/TeamSynergyBar.tsx` — persistent team+synergy strip.
- `types/*` — `'ward'` status kind, `protego` EffectSpec, `RunPhase` `'draft'`.

---

# PHASE A — Combat

## Task A1: Cooldown means WAIT, not basic attack

**Files:**
- Modify: `game/engine/combat/selectSpell.ts`
- Modify: `game/engine/combat/simulate.ts:189-196`
- Test: `tests/engine/combat/selectSpell.test.ts` (create)

**Interfaces:**
- Produces: `selectSpell(unit: BattleUnit): Spell | null` — returns `null` when the unit's own spell is purely cooldown-gated (the unit should WAIT). Returns `base_attack` only when the spell cannot be cast for another reason (silence). Returns the spell when ready.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/combat/selectSpell.test.ts
import { describe, it, expect } from 'vitest'
import { selectSpell } from '@/game/engine/combat/selectSpell'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit } from '@/types'

function unit(spellId: string, cd = 0, statuses: BattleUnit['statusEffects'] = []): BattleUnit {
  return {
    wizard: { id: 'w', name: 'W', house: 'Grifondoro', role: 'Attaccante' } as any,
    side: 'left', hp: 100, maxHp: 100, alive: true,
    buffedStats: { hp: 100, atk: 50, def: 30, spd: 20 },
    spell: SPELL_BY_ID[spellId]!, cooldowns: { [spellId]: cd }, statusEffects: statuses,
  } as unknown as BattleUnit
}

describe('selectSpell', () => {
  it('returns the spell when ready (cooldown 0)', () => {
    expect(selectSpell(unit('stupeficium', 0))?.id).toBe('stupeficium')
  })
  it('returns null (WAIT) when the spell is on cooldown', () => {
    expect(selectSpell(unit('stupeficium', 1))).toBeNull()
  })
  it('falls back to base_attack when silenced (cannot cast), not WAIT', () => {
    const silenced = unit('stupeficium', 0, [{ kind: 'silence', statusId: 'silence', remaining: 2 } as any])
    expect(selectSpell(silenced)?.id).toBe('base_attack')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/selectSpell.test.ts`
Expected: FAIL (current code returns base_attack on cooldown; signature is non-null).

- [ ] **Step 3: Implement**

```ts
// game/engine/combat/selectSpell.ts
import type { BattleUnit, Spell } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { canCastSpell } from '../status'

/** WAIT semantics: a unit whose own spell is merely on cooldown does nothing
 *  this turn (returns null). base_attack is only the silence/disarm fallback. */
export function selectSpell(unit: BattleUnit): Spell | null {
  if (!canCastSpell(unit)) return SPELL_BY_ID['base_attack']!
  const onCooldown = (unit.cooldowns[unit.spell.id] ?? 0) > 0
  if (onCooldown) return null
  return unit.spell
}

export function wantsHeal(_actor: BattleUnit, spell: Spell): boolean {
  return spell.type === 'Cura'
}
```

- [ ] **Step 4: Update the turn loop to skip WAIT**

In `game/engine/combat/simulate.ts`, replace the block starting at `const spell = selectSpell(actor)` (line ~189) through the `realTarget` assignment with:

```ts
      const spell = selectSpell(actor)
      if (!spell) {
        // Spell recharging: the unit waits (no action). Cooldown still ticks at end-of-turn.
        pushLog({ turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'Ricarica', type: 'system', flags: ['wait'] })
        fireReactive('onTurnEnd', actor, turn)
        continue
      }
      const allies = actor.side === 'left' ? L : R
      const enemies = actor.side === 'left' ? R : L
      const healIntent = spell.type === 'Cura'
      const target = selectTarget(actor, allies, enemies, spell)
      if (!target) { fireReactive('onTurnEnd', actor, turn); continue }
      const realTarget = healIntent
        ? (mostWounded(allies.filter(a => a.alive)) ?? actor)
        : (spell.type === 'Difesa' ? actor : target)
```

Note: `'wait'` is a new `LogFlag`. Add `'wait'` to the `LogFlag` union in `types/` (search `type LogFlag`). If the UI switches on flags exhaustively, add a no-op/neutral case.

- [ ] **Step 5: Run focused + full suite**

Run: `npx vitest run tests/engine/combat/selectSpell.test.ts` → PASS
Run: `npx tsc --noEmit` → clean
Run: `npx vitest run` → all green (some balance/combat snapshot tests may shift; investigate any failure — do NOT mask it. The no-stalemate guard is addressed in A2.)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "fix(combat): spell on cooldown makes the unit wait, not basic-attack"
```

---

## Task A2: Cooldown rebalance + keep tempo (no stalemates)

**Files:**
- Modify: `data/spells.ts` (cooldown values only)
- Verify: `tests/engine/campaignBalanceB.test.ts` (no new code; must stay green)

**Rationale:** With WAIT, a cooldown-N spell idles the unit for N turns between casts. Halve idle time so fights keep pace and never reach the turn cap.

- [ ] **Step 1: Apply the new cooldown policy** (cap 2; 2→1, 3→2; 0/1 unchanged)

In `data/spells.ts` set these `cooldown` values (leave all other fields untouched):

| id | old | new |
|----|-----|-----|
| sectumsempra | 2 | 1 |
| bombarda | 2 | 1 |
| confringo | 2 | 1 |
| avada | 3 | 2 |
| crucio | 2 | 1 |
| imperio | 3 | 2 |
| petrificus | 2 | 1 |
| vulnera | 2 | 1 |
| rennervate | 2 | 1 |
| protego_maxima | 3 | 2 |
| fianto | 2 | 1 |
| salvio | 2 | 1 |
| riddikulus | 2 | 1 |
| expecto | 3 | 2 |
| fiendfyre | 3 | 2 |
| glacius | 2 | 1 |
| silencio | 2 | 1 |
| aegis | 3 | 2 |

All cooldown-0 and cooldown-1 spells stay as-is. `base_attack` stays 0. `protego` stays 1.

- [ ] **Step 2: Run the balance harness**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`
Expected: all 3 tests PASS — in particular "no battle stalls to the turn cap on any seed" and the win-rate band (0.15, 0.55).

- [ ] **Step 3: If win-rate leaves the band or a stalemate appears, re-tune**

- Stalemate (turn-cap hit): lower the remaining 2-cooldowns to 1, or raise `BALANCE.combat.fatigueStart` lower / `fatiguePctStep` higher in `data/constants.ts`.
- Win-rate too high/low: nudge `BALANCE.campaignB.menaceBase`/`budgetStep` (NOT the legacy `campaign`). Re-run until in band. Document the final values in the commit body.

- [ ] **Step 4: Full suite + commit**

Run: `npx tsc --noEmit` → clean; `npx vitest run` → green

```bash
git add -A && git commit -m "balance(combat): lower spell cooldowns to keep tempo under wait-on-cooldown"
```

---

## Task A3: Protego negates the next incoming spell (self/ally; maxima = 2)

**Files:**
- Modify: `types/` (status kind + EffectSpec) — find the `StatusDef['kind']` union and the `EffectSpec` union.
- Modify: `data/statuses.ts` (new `protego` status)
- Modify: `data/spells.ts` (`protego`/`protego_maxima` → ward spec)
- Modify: `game/engine/status.ts` (new `consumeWard`)
- Modify: `game/engine/combat/effects.ts` (new `protego` handler; allies in ctx)
- Modify: `game/engine/combat/resolve.ts` (negation hook; thread allies)
- Modify: `game/engine/combat/simulate.ts` (pass allies into `resolveAction`)
- Test: `tests/engine/combat/protego.test.ts` (create)

**Interfaces:**
- Produces: `consumeWard(target: BattleUnit): boolean` — if target has a `protego` status with a charge left, consume one charge (remove the status when 0) and return true; else false.
- Produces: EffectSpec `{ kind: 'protego'; count?: number }` (default count 1).
- Produces: `EffectCtx.allies?: BattleUnit[]` and `resolveAction(rng, turn, actor, target, spell, allies, bus?)`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/combat/protego.test.ts
import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { consumeWard } from '@/game/engine/status'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit } from '@/types'

function mk(side: 'left' | 'right', id: string, hp = 100): BattleUnit {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    side, hp, maxHp: 100, alive: true,
    buffedStats: { hp: 100, atk: 60, def: 20, spd: 20 },
    spell: SPELL_BY_ID['stupeficium']!, cooldowns: {}, statusEffects: [],
  } as unknown as BattleUnit
}

describe('Protego', () => {
  it('wards the caster: the next enemy spell is negated, then the ward is gone', () => {
    const caster = mk('left', 'a'); const enemy = mk('right', 'e')
    // cast protego (self-target → caster is its own most-threatened ally)
    resolveAction(createRng('s'), 1, caster, caster, SPELL_BY_ID['protego']!, [caster], undefined)
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(true)
    const hpBefore = caster.hp
    // enemy hits the warded caster → negated (no hp loss), ward consumed
    const e1 = resolveAction(createRng('s'), 2, enemy, caster, SPELL_BY_ID['sectumsempra']!, [enemy], undefined)
    expect(caster.hp).toBe(hpBefore)
    expect(e1.flags).toContain('block')
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(false)
    // a second enemy spell now lands
    resolveAction(createRng('s'), 3, enemy, caster, SPELL_BY_ID['sectumsempra']!, [enemy], undefined)
    expect(caster.hp).toBeLessThan(hpBefore)
  })

  it('does NOT ward basic attacks', () => {
    const caster = mk('left', 'a'); const enemy = mk('right', 'e')
    resolveAction(createRng('s'), 1, caster, caster, SPELL_BY_ID['protego']!, [caster], undefined)
    const hpBefore = caster.hp
    resolveAction(createRng('s'), 2, enemy, caster, SPELL_BY_ID['base_attack']!, [enemy], undefined)
    expect(caster.hp).toBeLessThan(hpBefore) // basic attack still lands
    expect(caster.statusEffects.some(e => e.statusId === 'protego')).toBe(true) // ward intact
  })

  it('protego_maxima wards two allies', () => {
    const a = mk('left', 'a', 40); const b = mk('left', 'b', 50); const c = mk('left', 'c', 100)
    resolveAction(createRng('s'), 1, c, c, SPELL_BY_ID['protego_maxima']!, [a, b, c], undefined)
    const warded = [a, b, c].filter(u => u.statusEffects.some(e => e.statusId === 'protego'))
    expect(warded.length).toBe(2) // the two most-threatened (lowest hp): a and b
    expect(warded).toEqual(expect.arrayContaining([a, b]))
  })

  it('consumeWard returns false when no ward present', () => {
    expect(consumeWard(mk('left', 'x'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/combat/protego.test.ts`
Expected: FAIL (resolveAction has no allies param; protego is still a buff; consumeWard missing).

- [ ] **Step 3: Add the `protego` status and the `'ward'` kind**

In `types/` add `'ward'` to the `StatusDef['kind']` (and `ActiveEffect['kind']` if it mirrors it) union. In `data/statuses.ts` add to `STATUS_DEFS`:

```ts
  { id: 'protego', name: 'Protego', kind: 'ward', family: 'shield', defaultDuration: 3, stack: 'refresh', priority: 15, removable: true, absorb: 1 },
```

(`absorb: 1` is copied into the active effect's `absorbLeft` by `applyStatus` and used as the charge counter.)

- [ ] **Step 4: Add `consumeWard` to `game/engine/status.ts`**

```ts
/** Consume one Protego charge on `unit`. Returns true if a charge was spent
 *  (and the ward removed when it hits 0). */
export function consumeWard(unit: BattleUnit): boolean {
  const ward = unit.statusEffects.find(e => e.statusId === 'protego' && (e.absorbLeft ?? 0) > 0)
  if (!ward) return false
  ward.absorbLeft = (ward.absorbLeft ?? 0) - 1
  if ((ward.absorbLeft ?? 0) <= 0) {
    unit.statusEffects = unit.statusEffects.filter(e => e !== ward)
  }
  return true
}
```

- [ ] **Step 5: Add the `protego` EffectSpec + handler**

In `types/` add `{ kind: 'protego'; count?: number }` to the `EffectSpec` union. In `game/engine/combat/effects.ts`:
- Add `allies?: BattleUnit[]` to `EffectCtx`.
- Add `import { applyStatus } from '../status'` (already imported) and a handler:

```ts
  protego: (ctx, eff) => {
    if (eff.kind !== 'protego') return {}
    const count = eff.count ?? 1
    const pool = (ctx.allies ?? [ctx.actor]).filter(u => u.alive)
    // most-threatened first: lowest HP fraction, tiebreak higher ATK, then id for determinism
    const ranked = [...pool].sort((a, b) =>
      (a.hp / a.maxHp) - (b.hp / b.maxHp) ||
      b.buffedStats.atk - a.buffedStats.atk ||
      a.wizard.id.localeCompare(b.wizard.id))
    for (const u of ranked.slice(0, count)) {
      applyStatus(u, 'protego', { sourceId: `${ctx.actor.side}:${ctx.actor.wizard.id}` })
    }
    ctx.flags.push('block')
    return {}
  },
```

- [ ] **Step 6: Negation hook + allies threading in `resolve.ts`**

```ts
import { effectiveStats, tickStatuses, consumeWard } from '../status'
// ...
export function resolveAction(
  rng: Rng, turn: number, actor: BattleUnit, target: BattleUnit, spell: Spell,
  allies: BattleUnit[] = [], bus?: EventBus,
): LogEntry {
  const flags: LogFlag[] = []
  let value: number | undefined

  // Protego: an incoming ENEMY spell (not a basic attack) on a warded target is negated.
  if (spell.id !== 'base_attack' && actor.side !== target.side && consumeWard(target)) {
    flags.push('block')
    return {
      turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
      targetId: target.wizard.id, targetSide: target.side, type: spell.type, value: 0, flags,
    }
  }

  if (spell.cooldown && spell.cooldown > 0) actor.cooldowns[spell.id] = spell.cooldown
  const ctx = { rng, turn, actor, target, flags, bus, allies }
  for (const eff of normalizeSpell(spell)) {
    const r = EFFECT_HANDLERS[eff.kind](ctx, eff)
    if (r.dodged) { value = 0; break }
    if (r.value !== undefined && value === undefined) value = r.value
  }
  if (spell.type === 'Difesa' && !flags.includes('block')) flags.push('block')
  return {
    turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
    targetId: target.wizard.id, targetSide: target.side, type: spell.type, value, flags,
  }
}
```

Also update `EffectCtx` consumers: the `ctx` object literal now carries `allies`. Ensure `EffectCtx` includes `allies?: BattleUnit[]`.

- [ ] **Step 7: Convert the Protego spells to the ward spec**

In `data/spells.ts` replace lines 34-35:

```ts
  { id: 'protego', name: 'Protego', desc: 'Annulla la prossima magia sul bersaglio.', type: 'Difesa', hitChance: 1, cooldown: 1, spec: [{ kind: 'protego', count: 1 }] },
  { id: 'protego_maxima', name: 'Protego Maxima', desc: 'Annulla la prossima magia su due alleati.', type: 'Difesa', hitChance: 1, cooldown: 2, spec: [{ kind: 'protego', count: 2 }] },
```

- [ ] **Step 8: Pass allies from `simulate.ts`**

At the `resolveAction(...)` call (line ~196), pass the actor's allies:

```ts
      const entry = resolveAction(rng, turn, actor, realTarget, spell, allies, bus)
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run tests/engine/combat/protego.test.ts` → PASS
Run: `npx tsc --noEmit` → clean
Run: `npx vitest run` → green (re-run balance harness; protego no longer buffs DEF, which slightly changes AI value — confirm win-rate stays in band, else note in A2 follow-up).

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(combat): Protego negates the next incoming spell (self/ally; maxima wards two)"
```

---

## Task A4: Show wizard levels in battle (player + derived enemy)

**Files:**
- Modify: `game/engine/resolvers/combat.ts` (derive `enemyLevel`, add to `CombatResult`)
- Modify: `hooks/useRunB.combat.ts` (`ActiveBattleB.enemyLevel`)
- Modify: `components/screens/BattleScreen.tsx` (pass enemyLevel down)
- Modify: `components/battle/UnitBust.tsx` (level badge)
- Modify: `components/cards/WizardCard.tsx`, `components/cards/WizardCardRow.tsx` (level badge)
- Test: `tests/engine/enemyLevel.test.ts`, `tests/screens/unitLevel.test.tsx` (create)

**Interfaces:**
- Produces: `enemyLevel: number` on `CombatResult` and `ActiveBattleB`.
- Formula: `clamp(round(1 + rightMenace / BALANCE.leveling.autoGrowthPct), 1, BALANCE.leveling.levelMax)`.

- [ ] **Step 1: Failing engine test**

```ts
// tests/engine/enemyLevel.test.ts
import { describe, it, expect } from 'vitest'
import { deriveEnemyLevel } from '@/game/engine/resolvers/combat'
import { BALANCE } from '@/data/constants'

describe('deriveEnemyLevel', () => {
  it('maps menace onto the player growth curve', () => {
    expect(deriveEnemyLevel(0)).toBe(1)
    expect(deriveEnemyLevel(0.20)).toBe(3)   // 1 + 0.20/0.10
    expect(deriveEnemyLevel(0.50)).toBe(6)
  })
  it('clamps to [1, levelMax]', () => {
    expect(deriveEnemyLevel(-0.5)).toBe(1)
    expect(deriveEnemyLevel(99)).toBe(BALANCE.leveling.levelMax)
  })
})
```

- [ ] **Step 2: Run → FAIL** (`deriveEnemyLevel` not exported).

Run: `npx vitest run tests/engine/enemyLevel.test.ts`

- [ ] **Step 3: Implement the derivation in `resolvers/combat.ts`**

```ts
export function deriveEnemyLevel(menace: number): number {
  const lvl = Math.round(1 + menace / BALANCE.leveling.autoGrowthPct)
  return Math.max(1, Math.min(BALANCE.leveling.levelMax, lvl))
}
```

Add `enemyLevel: number` to `CombatResult` and set it in the return of `resolveCombat`:

```ts
  return { result, enemy, enemySyn, isBoss, isFinalBoss, enemyLevel: deriveEnemyLevel(rightMenace), survivors, expEach, milestones }
```

- [ ] **Step 4: Carry to the UI**

In `hooks/useRunB.combat.ts` add `enemyLevel: number` to `ActiveBattleB` and set `enemyLevel: out.enemyLevel` in `prepareCombat`. In `components/screens/BattleScreen.tsx`, accept an `enemyLevel` prop and render it on enemy busts (pass to enemy `UnitBust`). Player busts read the wizard's own `level`.

- [ ] **Step 5: Level badge component test**

```tsx
// tests/screens/unitLevel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'

describe('UnitBust level badge', () => {
  it('shows the unit level', () => {
    render(<UnitBust /* minimal props */ unit={{ wizard: { id: 'a', name: 'A', house: 'Grifondoro' }, level: 4, hp: 50, maxHp: 100 } as any} level={4} side="left" />)
    expect(screen.getByText(/Lv\.?\s*4/i)).toBeInTheDocument()
  })
})
```

(Adapt props to the real `UnitBust` signature — read it first. The badge renders `Lv. {level}` near the name.)

- [ ] **Step 6: Implement the badge**

In `UnitBust.tsx` add a small badge near the name: `Lv. {level}` (prop `level: number`, defaulting to the player unit's `level ?? 1`; enemy uses the passed `enemyLevel`). In `WizardCard.tsx`/`WizardCardRow.tsx` add `Lv. {drafted.level ?? 1}` near the tier/name. Reuse `Chip` for consistent styling.

- [ ] **Step 7: Run + commit**

Run: `npx vitest run tests/engine/enemyLevel.test.ts tests/screens/unitLevel.test.tsx` → PASS; `npx tsc --noEmit`; `npx vitest run` → green

```bash
git add -A && git commit -m "feat(combat-ui): show player + derived enemy levels on battle busts and cards"
```

---

# PHASE C — Map

## Task C1: Two nearest options per node

**Files:**
- Modify: `game/engine/map.ts:109-127` (edge wiring)
- Test: `tests/engine/mapWiring.test.ts` (extend)

**Interfaces:** unchanged public API; `generateArea`/`generateMap` keep their signatures and invariants (no orphans, no dead ends before boss).

- [ ] **Step 1: Extend the wiring test**

```ts
// add to tests/engine/mapWiring.test.ts
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

it('interior nodes offer two nearby options where the next floor allows', () => {
  let twoEdgeNodes = 0, candidates = 0
  for (let s = 0; s < 40; s++) {
    const map = generateArea(createRng(`m${s}`).fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
    const byFloor = new Map<number, typeof map>()
    for (const n of map) {
      const f = parseAreaNodeId(n.id).floor
      byFloor.set(f, [...(byFloor.get(f) ?? []), n])
    }
    for (const n of map) {
      const f = parseAreaNodeId(n.id).floor
      const nextWidth = (byFloor.get(f + 1) ?? []).length
      if (nextWidth >= 2 && n.type !== 'boss') { candidates++; if (n.next.length >= 2) twoEdgeNodes++ }
    }
  }
  // With deterministic nearest-2 wiring, (nearly) every candidate has 2 edges.
  expect(twoEdgeNodes / candidates).toBeGreaterThan(0.95)
})
```

- [ ] **Step 2: Run → FAIL** (current ~50% coin flip).

Run: `npx vitest run tests/engine/mapWiring.test.ts`

- [ ] **Step 3: Replace the edge-wiring block in `generateArea`**

Replace lines 109-127 (the `for (let f = 0; f < last; f++) { ... }` body) with deterministic nearest-2 wiring:

```ts
  // 4. Edges f -> f+1: each node links to the (up to) TWO nearest next-floor nodes
  //    by proportional column position, then guarantee no orphan (every next node
  //    has an incoming edge). Boss/entry convergence (width 1) yields a single edge.
  for (let f = 0; f < last; f++) {
    const cur = floorNodes[f]!
    const nxt = floorNodes[f + 1]!
    const want = Math.min(2, nxt.length)
    cur.forEach((node, i) => {
      const pos = cur.length > 1 ? (i / (cur.length - 1)) * (nxt.length - 1) : (nxt.length - 1) / 2
      const nearest = [...nxt.keys()]
        .sort((a, b) => Math.abs(a - pos) - Math.abs(b - pos) || a - b)
        .slice(0, want)
      for (const j of nearest) if (!node.next.includes(nxt[j]!.id)) node.next.push(nxt[j]!.id)
    })
    // No-orphan guarantee: any uncovered next node gets the nearest current node as a source.
    const covered = new Set(cur.flatMap(n => n.next))
    nxt.forEach((target, j) => {
      if (covered.has(target.id)) return
      const pos = nxt.length > 1 ? (j / (nxt.length - 1)) * (cur.length - 1) : (cur.length - 1) / 2
      const src = cur.reduce((best, n, i) =>
        Math.abs(i - pos) < Math.abs(cur.indexOf(best) - pos) ? n : best, cur[0]!)
      if (!src.next.includes(target.id)) src.next.push(target.id)
    })
    cur.forEach(node => node.next.sort())
  }
```

- [ ] **Step 4: Run the full map suite**

Run: `npx vitest run tests/engine/mapWiring.test.ts tests/screens/MapScreen.area.test.tsx` → PASS (no-orphan/no-dead-end invariants still hold; new 2-edge assertion passes).
Run: `npx tsc --noEmit`; `npx vitest run` → green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(run-map): nodes offer the two nearest next options (no more 50% single-path)"
```

---

# PHASE B — Run start: classic 2-of-5 draft (no House)

## Task B1: Restore the legacy draft engine

**Files:**
- Create (restore): `game/engine/draftSession.ts`, `hooks/useDraft.ts`
- Create (restore): `tests/engine/draftSession.test.ts`, `tests/ui/useDraft.test.tsx`

- [ ] **Step 1: Restore the deleted files from history**

```bash
git show 0b0feb0^:game/engine/draftSession.ts > game/engine/draftSession.ts
git show 0b0feb0^:hooks/useDraft.ts > hooks/useDraft.ts
git show 0b0feb0^:tests/engine/draftSession.test.ts > tests/engine/draftSession.test.ts
git show 0b0feb0^:tests/ui/useDraft.test.tsx > tests/ui/useDraft.test.tsx
```

- [ ] **Step 2: Read the restored files** and reconcile imports against the current tree (`game/engine/draft.ts` `generateScreen`, `statRoll.ts` `draftWizard`, `BALANCE.draft`). Fix any drifted import paths/signatures so it compiles.

- [ ] **Step 3: Run the restored tests**

Run: `npx vitest run tests/engine/draftSession.test.ts tests/ui/useDraft.test.tsx`
Expected: PASS (after import fixes). If a test asserts drafting to `teamSize=5`, leave it — B2 introduces the 2-pick start as a separate parameter.

- [ ] **Step 4: tsc + commit**

Run: `npx tsc --noEmit` → clean

```bash
git add -A && git commit -m "chore(draft): restore legacy classic-draft engine (draftSession + useDraft)"
```

---

## Task B2: `draft` run-phase and 2-pick start in the engine

**Files:**
- Modify: `types/run.ts` (add `'draft'` to `RunPhase`)
- Modify: `game/engine/runEngine.ts` (`startRunB` → phase `draft`; new `confirmDraftPicks`; remove `starterOffer`/`chooseStarters`/house plumbing)
- Test: `tests/engine/runEngine.test.ts` (extend)

**Interfaces:**
- Produces: `confirmDraftPicks(state: RunState, picked: DraftedWizard[], rng: Rng): RunState` — takes the 2 drafted starters, builds the team (`recruitVia(d, 'iniziale')`), generates area 0, returns `{ ...state, team, activeSynergies, map, currentNodeId, area: 0, phase: 'map' }`.
- Constant: `STARTER_PICKS = 2`.

- [ ] **Step 1: Failing test**

```ts
// add to tests/engine/runEngine.test.ts
import { startRunB, confirmDraftPicks, STARTER_PICKS } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { createDraftPool } from '@/game/engine/draft'
import { draftWizard } from '@/game/engine/statRoll'

it('starts in the draft phase and confirmDraftPicks seeds a 2-wizard team on the map', () => {
  const s = startRunB('seed-x')
  expect(s.phase).toBe('draft')
  expect(STARTER_PICKS).toBe(2)
  const pool = createDraftPool().slice(0, 2).map(w => draftWizard(createRng('seed-x'), w, true))
  const next = confirmDraftPicks(s, pool, createRng('seed-x'))
  expect(next.phase).toBe('map')
  expect(next.team.length).toBe(2)
  expect(next.map && next.map.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run → FAIL**.

Run: `npx vitest run tests/engine/runEngine.test.ts`

- [ ] **Step 3: Implement**

- `types/run.ts`: add `'draft'` to the `RunPhase` union (keep `'house'`/`'starter'` only if other unremoved code references them; otherwise remove in B3).
- `runEngine.ts`:
  - `startRunB`: return `phase: 'draft'` (was `'house'`).
  - Add `export const STARTER_PICKS = 2`.
  - Add:

```ts
export function confirmDraftPicks(state: RunState, picked: DraftedWizard[], _rng: Rng): RunState {
  const starters = picked.slice(0, STARTER_PICKS).map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(areaRng(state.seed, 0), 0, { teamSize: starters.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  return { ...state, area: 0, team: starters, activeSynergies: detectSynergies(starters),
    map, currentNodeId: entry.id, phase: 'map' }
}
```

  - Remove `starterOffer`, `chooseStarters`, `draftChannelForStarters` (and the `house` import usages). Keep `areaRng`, `generateArea`, `parseAreaNodeId`, `recruitVia`, `detectSynergies`.

- [ ] **Step 4: Run → PASS**; fix any references to the removed exports (compile errors guide you). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(run): draft phase replaces house/starter; confirmDraftPicks seeds 2 starters"
```

---

## Task B3: DraftScreen + RunBRunner wiring; remove House/StarterPick

**Files:**
- Create (restore + adapt): `components/screens/DraftScreen.tsx`
- Modify: `hooks/useRunB.ts` (draft state machine: offer screens, pick handling, `confirmDraftPicks`)
- Modify: `components/screens/RunBRunner.tsx` (render `DraftScreen` for `draft`; drop `house`/`starter` views)
- Delete: `components/screens/HouseSelectScreen.tsx`, `components/screens/StarterPickScreen.tsx`, and their tests
- Test: `tests/screens/RunBRunner.test.tsx` (update flow), `tests/screens/DraftScreen.test.tsx` (create/restore)

- [ ] **Step 1: Restore DraftScreen** from history and adapt to a 2-pick session:

```bash
git show 0b0feb0^:components/screens/DraftScreen.tsx > components/screens/DraftScreen.tsx
```

Read it. It renders a 5-wizard screen and reports picks. Adapt its "done" condition to fire after `STARTER_PICKS` (2) picks, calling an `onComplete(picked: DraftedWizard[])` prop.

- [ ] **Step 2: Update `useRunB`** — replace `selectHouse`/`backToHouse`/`confirmStarters`/`starterOffer` with a draft session:
  - Use the restored `draftSession` (start with `createRng(seed)`, `screenSize` from `BALANCE.draft`, target 2).
  - Track `draftScreen` (current 5 offered) and `draftPicked` (0–2).
  - On pick: advance the session; when 2 are picked, call `confirmDraftPicks(run, picked, createRng(run.seed))` and `commit(next, 'map')`.
  - `viewForPhase('draft') => 'draft'`. Remove `'house'`/`'starter'` views.

- [ ] **Step 3: Rewire `RunBRunner`** — `case 'draft':` renders `<DraftScreen screen={c.draftScreen} picked={c.draftPicked} onPick={c.pickDraft} />`. Delete the `house` and `starter` cases and the now-unused imports.

- [ ] **Step 4: Update the RunBRunner flow test** (`tests/screens/RunBRunner.test.tsx`) — drive `draft → (pick 2) → map` instead of `house → starter → map`. Delete `HouseSelectScreen.test.tsx`, `StarterPickScreen.test.tsx`.

```bash
git rm components/screens/HouseSelectScreen.tsx components/screens/StarterPickScreen.tsx tests/screens/HouseSelectScreen.test.tsx tests/screens/StarterPickScreen.test.tsx
```

- [ ] **Step 5: Run** `npx vitest run tests/screens/RunBRunner.test.tsx tests/screens/DraftScreen.test.tsx`; `npx tsc --noEmit`; full `npx vitest run`. Fix fallout (e.g. `PlayFlow.runB.test.tsx`). Green.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(run-ui): classic 2-of-5 draft replaces house+starter screens"
```

---

## Task B4: Recruit offers — drop the house bias

**Files:**
- Modify: `game/engine/recruit.ts` (`offerRecruits`)
- Modify: `game/engine/resolvers/recruit.ts:13` (no `state.house!`)
- Test: `tests/engine/nodeResolvers.test.ts` / `tests/engine/*recruit*` (update)

- [ ] **Step 1: Failing/updated test** — assert `offerRecruits` no longer requires a house and returns `offerSize` tier-weighted picks excluding the team:

```ts
import { offerRecruits } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

it('offers tier-weighted recruits with no house guarantee', () => {
  const offer = offerRecruits(createRng('r'), { exclude: new Set() })
  expect(offer.length).toBe(BALANCE.recruit.offerSize)
})
```

- [ ] **Step 2: Run → FAIL** (signature still requires `house`).

- [ ] **Step 3: Implement** — change `offerRecruits(rng, opts: { exclude })`: drop `houseGuarantee`/`houseBiasWeight`/`pickBiased`; fill `offerSize` slots with `takeWeighted` over the un-excluded pool. Update `resolvers/recruit.ts:13` to `offerRecruits(r, { exclude: new Set(state.team.map(t => t.wizard.id)) })`. Remove now-unused `BALANCE.recruit.houseGuarantee`/`houseBiasWeight` reads (leave the constants or delete if unreferenced).

- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit`; full suite green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(run): recruit offers are tier-weighted only (no house bias)"
```

---

# PHASE D — Persistent team + synergy panel

## Task D1: TeamSynergyBar component

**Files:**
- Create: `components/run/TeamSynergyBar.tsx`
- Test: `tests/screens/TeamSynergyBar.test.tsx`

**Interfaces:**
- Produces: `TeamSynergyBar({ team: DraftedWizard[]; synergies: ActiveSynergy[] })` — a horizontal strip: per member a compact portrait + name + `Lv. {level ?? 1}`, plus the active synergy chips. Reuses `SquadPanel` (or its building blocks) and the synergy rendering pattern from `TeamScreen`/`SynergyRibbon`.

- [ ] **Step 1: Failing test**

```tsx
// tests/screens/TeamSynergyBar.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'

const team = [
  { wizard: { id: 'a', name: 'Harry', house: 'Grifondoro' }, level: 3, stats: {}, maxHp: 100, spell: { id: 'x' } },
  { wizard: { id: 'b', name: 'Ron', house: 'Grifondoro' }, level: 1, stats: {}, maxHp: 100, spell: { id: 'y' } },
] as any

describe('TeamSynergyBar', () => {
  it('renders each member with name and level, plus synergies', () => {
    render(<TeamSynergyBar team={team} synergies={[{ synergy: { id: 's', name: 'Coraggio' }, memberIds: ['a','b'] }] as any} />)
    expect(screen.getByText('Harry')).toBeInTheDocument()
    expect(screen.getByText(/Lv\.?\s*3/i)).toBeInTheDocument()
    expect(screen.getByText(/Coraggio/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run → FAIL**; **Step 3: Implement** the component (read `SquadPanel.tsx`, `SynergyRibbon.tsx`, `TeamScreen.tsx` first; reuse their primitives and Tailwind theme). **Step 4: Run → PASS**; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(run-ui): TeamSynergyBar — compact persistent team + synergy strip"
```

---

## Task D2: Mount the bar in RunBRunner

**Files:**
- Modify: `components/screens/RunBRunner.tsx`
- Test: `tests/screens/RunBRunner.test.tsx` (extend)

- [ ] **Step 1: Failing test** — after `draft → map`, the team member names and synergies are visible on the map view (and on recruit/relic/levelup). Assert a starter's name is in the document while on the map.

- [ ] **Step 2: Implement** — wrap `renderView()` so that for phases in `{map, recruit, relic, levelup}` the `TeamSynergyBar` (reading `c.run.team`, `c.run.activeSynergies`) renders as a fixed strip above/below the view. Hide it for `draft`, `win`, `defeat`. In `battle`, keep the existing in-battle synergy display and suppress the bar (avoid duplication).

- [ ] **Step 3: Run → PASS**; tsc clean; full suite green.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(run-ui): persistent team+synergy bar across map/recruit/relic/levelup"
```

---

# PHASE E — Visual restyle (mockup-driven, LAST)

> These tasks run after A–D land (levels + synergy bar change what these screens display). Each uses the brainstorming **visual companion**: produce 2–3 layout variants in the browser, get the user's pick, THEN implement with the frontend-design skill. No final code is pre-written here because the layout is chosen interactively; that is by design, not a placeholder.

## Task E1: Restyle the challenge tree (MapScreen)

**Files:** Modify `components/screens/MapScreen.tsx`; reuse `PortraitImage`, `RarityFrame`, `GlowPanel`, `Chip`, `Tooltip`, `houseTheme`.

- [ ] **Step 1:** Produce 2–3 browser mockups of the tree layout (node framing by type, reachable-node glow, current-node emphasis, floor flow). Get the user's choice.
- [ ] **Step 2:** Implement the chosen layout, keeping the existing data contract (`map`, `currentNodeId`, `reachableIds`, `onChoose`, `area`, `areasTotal`) and the `data-testid={`node-${id}`}` hooks so `MapScreen.area.test.tsx` still passes.
- [ ] **Step 3:** Run `npx vitest run tests/screens/MapScreen.area.test.tsx`; tsc clean. Visually verify via the run skill.
- [ ] **Step 4:** Commit `feat(run-ui): restyle challenge-tree map`.

## Task E2: Restyle the relic choice (RelicNodeScreen)

**Files:** Modify `components/screens/RelicNodeScreen.tsx`; reuse `RelicCard`, `GlowPanel`, `Chip`, `Tooltip`.

- [ ] **Step 1:** Mockups (rarity glow, owned-vs-new grouping, synergy/effect hint). User picks.
- [ ] **Step 2:** Implement; keep the contract (`offer`, `owned`, `onPick`) and existing test hooks so `RelicNodeScreen.test.tsx` passes.
- [ ] **Step 3:** Run the relic screen test; tsc clean; visual check.
- [ ] **Step 4:** Commit `feat(run-ui): restyle relic choice`.

## Task E3: Restyle the recruitment (RecruitScreen)

**Files:** Modify `components/screens/RecruitScreen.tsx`; reuse `WizardCard`, `WizardCardRow`, `PortraitImage`, `Chip`.

- [ ] **Step 1:** Mockups (real portraits, tier/house chips, synergy-impact preview, clearer replace-when-full). User picks.
- [ ] **Step 2:** Implement; keep the contract (`offer`, `team`, `teamMax`, `onPick`) and test hooks so `RecruitScreen.test.tsx` passes.
- [ ] **Step 3:** Run the recruit screen test; tsc clean; visual check.
- [ ] **Step 4:** Commit `feat(run-ui): restyle recruitment screen`.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** A1 (cooldown wait), A2 (rebalance/no-stalemate), A3 (Protego self/ally/maxima, spells-only), A4 (player+derived enemy levels), B (no-house 2-of-5 draft + no recruit house-bias), C (two nearest map options), D (persistent team+synergy panel), E (restyle Map/Relic/Recruit), F (rarity verified — no task needed). All spec sections map to a task.
- **Placeholders:** Engine-critical tasks (A1, A3, A4, C1, B2) carry full code; UI/visual tasks carry exact files, interfaces, and test code. Phase E is intentionally mockup-gated (documented), not vague.
- **Type consistency:** `confirmDraftPicks`, `STARTER_PICKS`, `consumeWard`, `deriveEnemyLevel`, `enemyLevel`, `TeamSynergyBar({team,synergies})`, EffectSpec `protego{count}`, status id `protego`, `RunPhase 'draft'`, `LogFlag 'wait'` — names used consistently across tasks.

## Execution order

A1 → A2 → A3 → A4 → C1 → B1 → B2 → B3 → B4 → D1 → D2 → E1 → E2 → E3.
