# Role Counters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 4 roles into a legible rock-paper-scissors counter system (Tank→Attaccante→Supporto→Controllo→Tank) via a light damage matrix plus role-based signature passives.

**Architecture:** A new `roleCounter.ts` module centralises the matchup table and hard-control helpers. The damage matrix hooks into `computeDamage`; the "stunned Tank loses taunt" Global Rule hooks into `threatScore`; Attaccante's Affondo into `selectTarget`; Supporto's Tenacia (control-duration halving) into the `applyStatus` handler + a per-turn `controlResist` flag; Purificazione (cleanse) into the turn loop; the spell↔role bias into `pickSpell`. All passives are role-based, independent of the equipped spell.

**Tech Stack:** TypeScript, Vitest, React (Next.js). Pure engine functions; deterministic RNG.

## Global Constraints

- **Counter cycle:** `ROLE_PREY = { Tank:'Attaccante', Attaccante:'Supporto', Supporto:'Controllo', Controllo:'Tank' }`.
- **Matrix:** attacker deals `×(1 + matchupBonus)` = **×1.25** to its prey only; ×1.0 otherwise.
- **Hard control** = the kinds `stun`, `freeze`, `silence` (NOT `disarm`, NOT graded slows/debuffs).
- **Global Rule:** a Tank under hard-control loses its Provocazione for the duration.
- **Tenacia:** while a side has a live Supporto, incoming hard-control on that side is halved (min 1) via a per-turn `controlResist` flag; a Supporto also cleanses 1 hard-control from an ally each of its turns.
- **Spell bias is soft:** never a hard lock; venom + enemy `preferOffense`/`guaranteeOffense` still override.
- Reuse existing helpers; no new spells or statuses. Determinism preserved (one `rng.pick` per draft).
- Max-5-enemies cap and all prior invariants unchanged.

---

### Task 1: `roleCounter` module + constants + shared test util

**Files:**
- Create: `game/engine/combat/roleCounter.ts`
- Create: `tests/engine/combat/_roleTestUtils.ts`
- Modify: `data/constants.ts:503-516` (add `matchupBonus`, `tenaciaControlDurationMult`; keep the old two for now — removed in Task 2)
- Test: `tests/engine/combat/roleCounter.test.ts`

**Interfaces:**
- Produces: `ROLE_PREY: Record<Role,Role>`, `roleMult(attacker: Role, defender: Role): number`, `HARD_CONTROL_KINDS: Set<string>`, `isUnderHardControl(u: BattleUnit): boolean`, `countHardControl(u: BattleUnit): number`, and test helper `mkUnit(over): BattleUnit`.

- [ ] **Step 1: Add constants.** In `data/constants.ts`, inside `roles:` (after `tauntBonus: 1000,`) add:
```ts
    matchupBonus: 0.25,                // ×1.25 damage vs the role you prey on
    tenaciaControlDurationMult: 0.5,   // Supporto aura: incoming hard-control duration ×this
```

- [ ] **Step 2: Write the module.** Create `game/engine/combat/roleCounter.ts`:
```ts
import type { BattleUnit, Role } from '@/types'
import { BALANCE } from '@/data/constants'

/** The counter cycle: each role deals bonus damage to the role it preys on. */
export const ROLE_PREY: Record<Role, Role> = {
  Tank: 'Attaccante', Attaccante: 'Supporto', Supporto: 'Controllo', Controllo: 'Tank',
}

/** Damage multiplier for a role matchup: ×(1+matchupBonus) vs your prey, ×1 otherwise. */
export function roleMult(attacker: Role, defender: Role): number {
  return 1 + (ROLE_PREY[attacker] === defender ? BALANCE.roles.matchupBonus : 0)
}

/** "Hard" control that disables a unit — the family that suppresses a Tank's taunt and
 *  that Supporto's Tenacia resists. Excludes disarm and graded slows/debuffs. */
export const HARD_CONTROL_KINDS = new Set(['stun', 'freeze', 'silence'])

export function countHardControl(u: BattleUnit): number {
  return u.statusEffects.filter(e => HARD_CONTROL_KINDS.has(e.kind)).length
}

export function isUnderHardControl(u: BattleUnit): boolean {
  return u.statusEffects.some(e => HARD_CONTROL_KINDS.has(e.kind))
}
```

- [ ] **Step 3: Add the shared test helper.** Create `tests/engine/combat/_roleTestUtils.ts`:
```ts
import type { BattleUnit, Role } from '@/types'

/** Minimal BattleUnit for targeting/damage unit tests. Only the fields the role-counter
 *  code reads are meaningful (wizard.role, stats, statusEffects, hp/alive/side). */
export function mkUnit(over: { id: string; role: Role } & Partial<BattleUnit>): BattleUnit {
  const { id, role, ...rest } = over
  return {
    wizard: { id, name: id, house: 'Grifondoro', role, spellPool: ['base_attack'] } as never,
    stats: { hp: 100, atk: 20, def: 10, spd: 10 },
    hp: 100, maxHp: 100, alive: true, side: 'right',
    statusEffects: [], cooldowns: {},
    spell: { id: 'base_attack', name: 'Colpo', type: 'Attacco', hitChance: 1 } as never,
    ...rest,
  } as BattleUnit
}
```

- [ ] **Step 4: Write the failing test.** Create `tests/engine/combat/roleCounter.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { roleMult, ROLE_PREY, isUnderHardControl, countHardControl } from '@/game/engine/combat/roleCounter'
import { mkUnit } from './_roleTestUtils'

describe('roleCounter', () => {
  it('roleMult is 1.25 vs prey, 1.0 otherwise, for the whole cycle', () => {
    for (const [atk, prey] of Object.entries(ROLE_PREY)) {
      expect(roleMult(atk as never, prey as never)).toBeCloseTo(1.25)
    }
    expect(roleMult('Attaccante', 'Tank')).toBe(1)      // Tank is not Attaccante's prey
    expect(roleMult('Tank', 'Tank')).toBe(1)
  })
  it('detects hard control (stun/freeze/silence) but not disarm/slow', () => {
    expect(isUnderHardControl(mkUnit({ id: 'a', role: 'Tank' }))).toBe(false)
    expect(isUnderHardControl(mkUnit({ id: 'b', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never] }))).toBe(true)
    const disarmed = mkUnit({ id: 'c', role: 'Tank', statusEffects: [{ kind: 'disarm', remaining: 1, stacks: 1 } as never] })
    expect(isUnderHardControl(disarmed)).toBe(false)
    const doubled = mkUnit({ id: 'd', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never, { kind: 'silence', remaining: 1, stacks: 1 } as never] })
    expect(countHardControl(doubled)).toBe(2)
  })
})
```

- [ ] **Step 5: Run — expect FAIL then PASS.** Run: `npx vitest run tests/engine/combat/roleCounter.test.ts`. Fix until PASS. Then `npx tsc --noEmit`.

- [ ] **Step 6: Commit.**
```bash
git add game/engine/combat/roleCounter.ts tests/engine/combat/_roleTestUtils.ts tests/engine/combat/roleCounter.test.ts data/constants.ts
git commit -m "feat(combat): role-counter module (matchup table + hard-control helpers)"
```

---

### Task 2: Damage matrix in `computeDamage` (replaces Controllo mult)

**Files:**
- Modify: `game/engine/combat/effects.ts:11-26`
- Modify: `data/constants.ts` (remove `controlVsBackline`, `controlVsTank`)
- Test: `tests/engine/combat/roleDamageMatrix.test.ts`
- Update: any existing test referencing `controlVsTank`/`controlVsBackline` (grep first).

**Interfaces:**
- Consumes: `roleMult` from Task 1.

- [ ] **Step 1: Grep for old-constant references.** Run: `grep -rn "controlVsTank\|controlVsBackline" game tests`. Every hit must be updated in this task.

- [ ] **Step 2: Write the failing test.** Create `tests/engine/combat/roleDamageMatrix.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeDamage } from '@/game/engine/combat/effects'
import { createRng } from '@/game/engine/rng'
import { mkUnit } from './_roleTestUtils'

// A deterministic rng where chance() never crits (so we read the base number).
const noCrit = { ...createRng('x'), chance: () => false } as never

describe('role damage matrix', () => {
  it('an Attaccante deals +25% to a Supporto (its prey) vs a neutral role', () => {
    const atk = mkUnit({ id: 'att', role: 'Attaccante', side: 'left', stats: { hp: 100, atk: 50, def: 10, spd: 10 } })
    const prey = mkUnit({ id: 'sup', role: 'Supporto', stats: { hp: 100, atk: 10, def: 10, spd: 10 } })
    const neutral = mkUnit({ id: 'ctl', role: 'Controllo', stats: { hp: 100, atk: 10, def: 10, spd: 10 } })
    const dPrey = computeDamage(noCrit, atk, prey, 1, [])
    const dNeutral = computeDamage(noCrit, atk, neutral, 1, [])
    expect(dPrey).toBeGreaterThan(dNeutral)
    expect(dPrey / dNeutral).toBeCloseTo(1.25, 1)
  })
})
```

- [ ] **Step 3: Run — expect FAIL** (`npx vitest run tests/engine/combat/roleDamageMatrix.test.ts`): the ratio is 1.0 (no matrix yet).

- [ ] **Step 4: Implement.** In `effects.ts`, add the import and replace the Controllo block. Add at top: `import { roleMult } from './roleCounter'`. Replace lines 17-20:
```ts
  let dmg = atk * power - def * c.defenseK
  if (actor.wizard.role === 'Controllo') {
    dmg *= target.wizard.role === 'Tank' ? BALANCE.roles.controlVsTank : BALANCE.roles.controlVsBackline
  }
```
with:
```ts
  let dmg = atk * power - def * c.defenseK
  // Role matchup: +25% vs the role you prey on (Tank→Att→Sup→Ctrl→Tank). Replaces the old
  // Controllo-specific multiplier — Controllo's real anti-Tank power is now its passive.
  dmg *= roleMult(actor.wizard.role, target.wizard.role)
```

- [ ] **Step 5: Remove dead constants.** In `data/constants.ts` delete the `controlVsBackline` and `controlVsTank` lines (and their comment block at 509-513). Update any test the grep found (replace assertions on the old mults with the matrix behaviour, or delete if now covered by Task 2's test).

- [ ] **Step 6: Run tests + typecheck.** `npx vitest run tests/engine/combat/roleDamageMatrix.test.ts` PASS; `npx tsc --noEmit` clean; `npx vitest run tests/engine/combat` green.

- [ ] **Step 7: Commit.**
```bash
git add game/engine/combat/effects.ts data/constants.ts tests/engine/combat/roleDamageMatrix.test.ts
git commit -m "feat(combat): role matchup damage matrix (replaces Controllo-vs-Tank mult)"
```

---

### Task 3: Global Rule — a stunned Tank loses Provocazione

**Files:**
- Modify: `types/combat.ts` (add `controlResist?: boolean` to `BattleUnit`)
- Modify: `game/engine/combat/targeting.ts:64-68` (`threatScore`)
- Test: `tests/engine/combat/globalRuleTaunt.test.ts`

**Interfaces:**
- Consumes: `isUnderHardControl` from Task 1.
- Produces: `BattleUnit.controlResist` (used by Task 5/6).

- [ ] **Step 1: Add the field.** In `types/combat.ts`, on the `BattleUnit` interface add near `ignoresTaunt`:
```ts
  /** Set each turn: true while this unit's side has a live Supporto (Tenacia aura). */
  controlResist?: boolean
```

- [ ] **Step 2: Write the failing test.** Create `tests/engine/combat/globalRuleTaunt.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { threatScore } from '@/game/engine/combat/targeting'
import { mkUnit } from './_roleTestUtils'

describe('Global Rule: stunned Tank loses taunt', () => {
  it('a healthy Tank carries the taunt threat term; a stunned Tank does not', () => {
    const tank = mkUnit({ id: 't', role: 'Tank' })
    const stunnedTank = mkUnit({ id: 't2', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never] })
    expect(threatScore(tank)).toBeGreaterThan(threatScore(stunnedTank))
    // stunned tank's score is just atk+spd (no +tauntBonus)
    expect(threatScore(stunnedTank)).toBeLessThan(1000)
  })
})
```

- [ ] **Step 3: Run — expect FAIL** (stunned tank still gets +1000).

- [ ] **Step 4: Implement.** In `targeting.ts` add `import { isUnderHardControl } from './roleCounter'` and change `threatScore`:
```ts
export function threatScore(u: BattleUnit, ignoresTaunt = false): number {
  const s = effectiveStats(u)
  // Provocazione is suppressed while the Tank is under hard-control (Global Rule):
  // a stunned/frozen/silenced wall can't provoke, so it stops drawing fire.
  const provoking = u.wizard.role === 'Tank' && !ignoresTaunt && !isUnderHardControl(u)
  return s.atk + s.spd + (provoking ? BALANCE.roles.tauntBonus : 0)
}
```

- [ ] **Step 5: Run test + typecheck.** PASS; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit.**
```bash
git add types/combat.ts game/engine/combat/targeting.ts tests/engine/combat/globalRuleTaunt.test.ts
git commit -m "feat(combat): stunned Tank loses Provocazione (Global Rule)"
```

---

### Task 4: Affondo — Attaccante dives the enemy Supporto when free

**Files:**
- Modify: `game/engine/combat/targeting.ts:120-123` (Attaccante branch of `selectTarget`; add a `diveTarget` helper)
- Test: `tests/engine/combat/affondo.test.ts`

**Interfaces:**
- Consumes: `isUnderHardControl` (Task 1), `highestThreat`/`threatScore` (existing).

- [ ] **Step 1: Write the failing test.** Create `tests/engine/combat/affondo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { selectTarget } from '@/game/engine/combat/targeting'
import { mkUnit } from './_roleTestUtils'

describe('Affondo (Attaccante dive)', () => {
  const attacker = mkUnit({ id: 'att', role: 'Attaccante', side: 'left' })
  it('hits the enemy Tank while its taunt is active (taunt wins)', () => {
    const tank = mkUnit({ id: 'tank', role: 'Tank' })
    const sup = mkUnit({ id: 'sup', role: 'Supporto' })
    expect(selectTarget(attacker, [attacker], [tank, sup])?.wizard.id).toBe('tank')
  })
  it('dives the enemy Supporto when the Tank is stunned (taunt suppressed)', () => {
    const tank = mkUnit({ id: 'tank', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never] })
    const sup = mkUnit({ id: 'sup', role: 'Supporto' })
    expect(selectTarget(attacker, [attacker], [tank, sup])?.wizard.id).toBe('sup')
  })
  it('dives the enemy Supporto when there is no Tank at all', () => {
    const sup = mkUnit({ id: 'sup', role: 'Supporto' })
    const ctl = mkUnit({ id: 'ctl', role: 'Controllo' })
    expect(selectTarget(attacker, [attacker], [ctl, sup])?.wizard.id).toBe('sup')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (dive cases return the wrong unit / tank).

- [ ] **Step 3: Implement.** In `targeting.ts` add a helper above `selectTarget`:
```ts
// Attaccante identity (Affondo): with no active enemy taunt, hunt the enemy backline —
// Supporto first (its prey), then Controllo, then whatever is most dangerous.
function diveTarget(enemies: BattleUnit[], ignoresTaunt: boolean): BattleUnit | undefined {
  const byThreat = (pool: BattleUnit[]) => pool.slice().sort((a, b) =>
    threatScore(b, ignoresTaunt) - threatScore(a, ignoresTaunt) || a.wizard.id.localeCompare(b.wizard.id))[0]
  const supports = enemies.filter(e => e.wizard.role === 'Supporto')
  if (supports.length) return byThreat(supports)
  const controllers = enemies.filter(e => e.wizard.role === 'Controllo')
  if (controllers.length) return byThreat(controllers)
  return highestThreat(enemies, ignoresTaunt)
}
```
Then replace the Attaccante branch (lines 120-122):
```ts
    case 'Attaccante':
    default:
      return highestThreat(enemyPool, actor.ignoresTaunt ?? false)
```
with:
```ts
    case 'Attaccante':
    default: {
      const ign = actor.ignoresTaunt ?? false
      // If an enemy Tank is actively taunting, it wins (Tank beats Attaccante). Otherwise dive.
      const tauntActive = !ign && enemyPool.some(e => e.wizard.role === 'Tank' && !isUnderHardControl(e))
      return tauntActive ? highestThreat(enemyPool, ign) : diveTarget(enemyPool, ign)
    }
```
(`isUnderHardControl` is already imported from Task 3.)

- [ ] **Step 4: Run test + typecheck + full targeting suite.** `npx vitest run tests/engine/combat/affondo.test.ts` PASS; `npx tsc --noEmit`; `npx vitest run tests/engine/combat`.

- [ ] **Step 5: Commit.**
```bash
git add game/engine/combat/targeting.ts tests/engine/combat/affondo.test.ts
git commit -m "feat(combat): Attaccante Affondo — dives the enemy backline when unblocked"
```

---

### Task 5: Tenacia in the status handler + drop Controllo-vs-Tank halving

**Files:**
- Modify: `game/engine/combat/effects.ts:138-149` (the `applyStatus` handler duration + flag block)
- Test: `tests/engine/combat/tenaciaDuration.test.ts`

**Interfaces:**
- Consumes: `HARD_CONTROL_KINDS` (Task 1), `BattleUnit.controlResist` (Task 3).

- [ ] **Step 1: Write the failing test.** Create `tests/engine/combat/tenaciaDuration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { createRng } from '@/game/engine/rng'
import { mkUnit } from './_roleTestUtils'

const alwaysRng = { ...createRng('x'), chance: () => true } as never

describe('Tenacia: control duration halved on a side with a live Supporto', () => {
  it('a 2-turn stun becomes 1 turn when the target has controlResist', () => {
    const actor = mkUnit({ id: 'ctl', role: 'Controllo', side: 'left' })
    const protectedTank = mkUnit({ id: 'tank', role: 'Tank', side: 'right', controlResist: true })
    EFFECT_HANDLERS.applyStatus(
      { rng: alwaysRng, turn: 1, actor, target: protectedTank, flags: [] } as never,
      { kind: 'applyStatus', target: 'enemy', statusId: 'stun', duration: 2 } as never,
    )
    expect(protectedTank.statusEffects.find(e => e.kind === 'stun')?.remaining).toBe(1)
  })
  it('no Supporto (controlResist falsy) → full duration', () => {
    const actor = mkUnit({ id: 'ctl', role: 'Controllo', side: 'left' })
    const tank = mkUnit({ id: 'tank2', role: 'Tank', side: 'right' })
    EFFECT_HANDLERS.applyStatus(
      { rng: alwaysRng, turn: 1, actor, target: tank, flags: [] } as never,
      { kind: 'applyStatus', target: 'enemy', statusId: 'stun', duration: 2 } as never,
    )
    expect(tank.statusEffects.find(e => e.kind === 'stun')?.remaining).toBe(2)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (duration is 2 in both cases).

- [ ] **Step 3: Implement.** In `effects.ts` add `import { HARD_CONTROL_KINDS } from './roleCounter'`. Replace the duration block (lines 138-147) — which currently halves Controllo debuffs vs Tank — with:
```ts
      const maxStacks = eff.statusId === 'veleno' && ctx.actor.velenoUncapped ? Infinity : undefined
      const def = STATUS_BY_ID[eff.statusId]
      // Supporto Tenacia: while the target's side has a live Supporto (controlResist),
      // incoming HARD control (stun/freeze/silence) lasts half as long (min 1). This is
      // how Supporto beats Controllo. (The old Controllo-vs-Tank debuff halving is removed:
      // Controllo's debuffs now land full-duration on Tanks — armor-shred works.)
      const base = eff.duration ?? def?.defaultDuration
      const resisted = eff.target === 'enemy' && unit.controlResist && def && HARD_CONTROL_KINDS.has(def.kind)
      const duration = resisted && base != null
        ? Math.max(1, Math.ceil(base * BALANCE.roles.tenaciaControlDurationMult))
        : eff.duration
      applyStatus(unit, eff.statusId, { duration, sourceId: sourceId(ctx.actor), maxStacks })
      if (def?.kind === 'stun' || def?.kind === 'freeze') ctx.flags.push('stun')
      if (def?.kind === 'dot') ctx.flags.push('dot')
```

- [ ] **Step 4: Run test + typecheck.** PASS; `npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add game/engine/combat/effects.ts tests/engine/combat/tenaciaDuration.test.ts
git commit -m "feat(combat): Supporto Tenacia halves hard-control; Controllo debuffs land full on Tanks"
```

---

### Task 6: Wire the per-turn `controlResist` flag in the sim

**Files:**
- Modify: `game/engine/combat/roleCounter.ts` (add `applyTenaciaAura`)
- Modify: `game/engine/combat/simulate.ts` (top of the `while (turn…)` loop, after `turn++` at line 198)
- Test: `tests/engine/combat/tenaciaAura.test.ts`

**Interfaces:**
- Produces: `applyTenaciaAura(L: BattleUnit[], R: BattleUnit[]): void` — sets `controlResist` on every unit per its side's live-Supporto status. Called once per turn (consumed by Task 5's handler).

- [ ] **Step 1: Write the failing test.** Create `tests/engine/combat/tenaciaAura.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyTenaciaAura } from '@/game/engine/combat/roleCounter'
import { mkUnit } from './_roleTestUtils'

describe('applyTenaciaAura', () => {
  it('grants controlResist to a side with a live Supporto, not to one without', () => {
    const L = [mkUnit({ id: 'sup', role: 'Supporto', side: 'left' }), mkUnit({ id: 'att', role: 'Attaccante', side: 'left' })]
    const R = [mkUnit({ id: 'tank', role: 'Tank', side: 'right' })]
    applyTenaciaAura(L, R)
    expect(L.every(u => u.controlResist)).toBe(true)
    expect(R.every(u => u.controlResist)).toBe(false)
  })
  it('drops the aura when the last Supporto is dead', () => {
    const L = [mkUnit({ id: 'sup', role: 'Supporto', side: 'left', alive: false }), mkUnit({ id: 'att', role: 'Attaccante', side: 'left' })]
    applyTenaciaAura(L, [])
    expect(L.every(u => u.controlResist)).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`applyTenaciaAura` not defined).

- [ ] **Step 3: Implement the helper.** In `roleCounter.ts` add:
```ts
/** Set `controlResist` on every unit: true iff its side has a live Supporto (Tenacia aura).
 *  Call once per turn so the aura drops when the last Supporto dies. */
export function applyTenaciaAura(L: BattleUnit[], R: BattleUnit[]): void {
  const has = (side: BattleUnit[]) => side.some(u => u.alive && u.wizard.role === 'Supporto')
  const l = has(L), r = has(R)
  for (const u of L) u.controlResist = l
  for (const u of R) u.controlResist = r
}
```

- [ ] **Step 4: Wire in the sim.** In `simulate.ts`, immediately after `turn++` (line 198) and before the `order` sort, insert (add `applyTenaciaAura` to the `roleCounter` import):
```ts
      applyTenaciaAura(L, R) // Supporto Tenacia: refresh controlResist for both sides
```

- [ ] **Step 5: Run test + full combat suite + typecheck.** `npx vitest run tests/engine/combat`; `npx tsc --noEmit`.

- [ ] **Step 6: Commit.**
```bash
git add game/engine/combat/roleCounter.ts game/engine/combat/simulate.ts tests/engine/combat/tenaciaAura.test.ts
git commit -m "feat(combat): per-turn Tenacia aura (controlResist) wiring"
```

---

### Task 7: Purificazione — Supporto cleanses one hard-control each turn

**Files:**
- Modify: `game/engine/combat/roleCounter.ts` (add `cleanseOneControl`)
- Modify: `game/engine/combat/simulate.ts` (in the actor loop, after the `canAct` gate ~line 214)
- Test: `tests/engine/combat/purificazione.test.ts`

**Interfaces:**
- Produces: `cleanseOneControl(allies: BattleUnit[]): BattleUnit | undefined` (returns the cleansed ally, or undefined).

- [ ] **Step 1: Write the failing test.** Create `tests/engine/combat/purificazione.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cleanseOneControl } from '@/game/engine/combat/roleCounter'
import { mkUnit } from './_roleTestUtils'

describe('Purificazione', () => {
  it('removes one hard-control effect from the most-disabled living ally', () => {
    const clean = mkUnit({ id: 'a', role: 'Attaccante' })
    const stunned = mkUnit({ id: 'b', role: 'Attaccante', statusEffects: [{ kind: 'stun', remaining: 2, stacks: 1 } as never, { kind: 'silence', remaining: 2, stacks: 1 } as never] })
    const who = cleanseOneControl([clean, stunned])
    expect(who?.wizard.id).toBe('b')
    expect(stunned.statusEffects.filter(e => ['stun','freeze','silence'].includes(e.kind)).length).toBe(1)
  })
  it('returns undefined when no ally is hard-controlled', () => {
    expect(cleanseOneControl([mkUnit({ id: 'a', role: 'Tank' })])).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement the helper.** In `roleCounter.ts` add (needs `effectiveStats`):
```ts
import { effectiveStats } from '../status'

/** Remove ONE hard-control effect from the most-disabled living ally (tiebreak: carry, then
 *  id). Returns the ally cleansed, or undefined if none is hard-controlled. Mutates in place. */
export function cleanseOneControl(allies: BattleUnit[]): BattleUnit | undefined {
  const disabled = allies.filter(a => a.alive && countHardControl(a) > 0)
  if (!disabled.length) return undefined
  disabled.sort((a, b) =>
    countHardControl(b) - countHardControl(a) ||
    effectiveStats(b).atk - effectiveStats(a).atk ||
    a.wizard.id.localeCompare(b.wizard.id))
  const target = disabled[0]!
  const idx = target.statusEffects.findIndex(e => HARD_CONTROL_KINDS.has(e.kind))
  if (idx >= 0) target.statusEffects.splice(idx, 1)
  return target
}
```

- [ ] **Step 4: Wire in the sim.** In `simulate.ts`, inside the actor loop, right after the `canAct` gate passes (after line 214, before `let spell = selectSpell(actor)`), insert:
```ts
      // Supporto Purificazione: a Supporto that can act cleanses one hard-control from an
      // ally each turn (free — does not consume its spell). Part of Supporto beats Controllo.
      if (actor.wizard.role === 'Supporto') {
        const allyPool = (actor.side === 'left' ? L : R).filter(a => a.alive)
        const cleansed = cleanseOneControl(allyPool)
        if (cleansed) pushLog({ turn, actorId: actor.wizard.id, actorSide: actor.side,
          action: 'Purificazione', targetId: cleansed.wizard.id, targetSide: cleansed.side,
          type: 'system', flags: [] })
      }
```
Add `cleanseOneControl` to the existing `roleCounter` import in `simulate.ts` (or add the import).

- [ ] **Step 5: Run tests + full combat suite + typecheck.** PASS; `npx tsc --noEmit`.

- [ ] **Step 6: Commit.**
```bash
git add game/engine/combat/roleCounter.ts game/engine/combat/simulate.ts tests/engine/combat/purificazione.test.ts
git commit -m "feat(combat): Supporto Purificazione — cleanse one hard-control per turn"
```

---

### Task 8: Spell↔role bias in `pickSpell`

**Files:**
- Modify: `game/engine/statRoll.ts:49-75` (`pickSpell`)
- Test: `tests/engine/spellRoleBias.test.ts`

**Interfaces:**
- Produces: `ROLE_SPELL_TYPES: Record<Role, SpellType[]>` (exported from statRoll for reuse in Task 9).

- [ ] **Step 1: Write the failing test.** Create `tests/engine/spellRoleBias.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { pickSpell } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import type { Wizard } from '@/types'

const ctl: Wizard = {
  id: 'w', name: 'W', house: 'Corvonero', role: 'Controllo',
  ranges: { hp: [80,80], atk: [20,20], def: [10,10], spd: [10,10] },
  spellPool: ['bombarda', 'confundo', 'reducto'], // one Controllo spell among attacks
} as never

describe('spell↔role bias', () => {
  it('a Controllo equips a Controllo-type spell when its pool has one (any seed)', () => {
    for (const s of ['a','b','c','d','e','f']) {
      expect(pickSpell(createRng(s), ctl).type).toBe('Controllo')
    }
  })
  it('falls back to the whole pool when no role-type spell exists', () => {
    const noCtl = { ...ctl, spellPool: ['bombarda', 'reducto'] } as never
    expect(['Attacco']).toContain(pickSpell(createRng('a'), noCtl).type)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (random pick sometimes non-Controllo).

- [ ] **Step 3: Implement.** In `statRoll.ts` add near the top (after imports):
```ts
import type { Role, SpellType } from '@/types'

/** Preferred spell type(s) per role — the soft bias applied when equipping (not a lock). */
export const ROLE_SPELL_TYPES: Record<Role, SpellType[]> = {
  Attaccante: ['Attacco'], Controllo: ['Controllo'], Supporto: ['Cura', 'Difesa'], Tank: ['Difesa'],
}
```
Then in `pickSpell`, set the role-biased base BEFORE the venom/preferOffense overrides. Replace `let candidates = wizard.spellPool` (line 61) with:
```ts
  let candidates = wizard.spellPool
  // Role bias (default for player AND enemy): prefer a spell of the role's type so a role
  // actually plays its part (esp. a Controllo needs a control spell for the Global Rule).
  // Soft: falls back to the whole pool if the pool has none. Venom / preferOffense below
  // still OVERRIDE this base (enemy offensive guarantee wins).
  const roleTypes = ROLE_SPELL_TYPES[wizard.role]
  if (roleTypes) {
    const roleMatch = wizard.spellPool.filter(id => roleTypes.includes(SPELL_BY_ID[id]?.type as SpellType))
    if (roleMatch.length > 0) candidates = roleMatch
  }
```
(The existing `venom`/`preferOffense` `if/else` block that follows already reassigns `candidates`, so precedence is correct.)

- [ ] **Step 4: Run test + typecheck + broader draft suite.** `npx vitest run tests/engine/spellRoleBias.test.ts`; `npx tsc --noEmit`; `npx vitest run tests/engine` (expect some balance harnesses to shift — handled in Task 11; other draft tests should stay green).

- [ ] **Step 5: Commit.**
```bash
git add game/engine/statRoll.ts tests/engine/spellRoleBias.test.ts
git commit -m "feat(draft): soft spell↔role bias so roles equip role-appropriate spells"
```

---

### Task 9: Pool guarantee — every wizard has ≥1 role-type spell

**Files:**
- Modify: `data/wizards.ts` (fill pools that lack a role-type spell)
- Test: `tests/data/rolePoolInvariant.test.ts`

**Interfaces:**
- Consumes: `ROLE_SPELL_TYPES` (Task 8), `SPELL_BY_ID`, `WIZARDS`.

- [ ] **Step 1: Write the invariant test.** Create `tests/data/rolePoolInvariant.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { ROLE_SPELL_TYPES } from '@/game/engine/statRoll'

describe('role spell-pool invariant', () => {
  it('every wizard has at least one spell of its role type in its pool', () => {
    const violators = WIZARDS.filter(w => {
      const types = ROLE_SPELL_TYPES[w.role]
      return !w.spellPool.some(id => types.includes(SPELL_BY_ID[id]?.type as never))
    }).map(w => `${w.id} (${w.role})`)
    expect(violators, `wizards missing a role-type spell:\n${violators.join('\n')}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect FAIL** listing violators: `npx vitest run tests/data/rolePoolInvariant.test.ts`.

- [ ] **Step 3: Fix data.** For each violator the test prints, add ONE role-appropriate spell id to that wizard's `spellPool` in `data/wizards.ts`, choosing by role:
  - `Attaccante` → an `Attacco` spell (e.g. `reducto`, `bombarda`, `diffindo`).
  - `Controllo` → a `Controllo` spell (e.g. `confundo`, `petrificus`, `langlock`, `glacius`, `silencio`).
  - `Supporto` → a `Cura` or `Difesa` spell (e.g. `episkey`, `protego`, `ferula`).
  - `Tank` → a `Difesa` spell (e.g. `protego`, `fianto`, `aegis`).
  Pick something thematically sensible for the character; keep existing off-role spells (flavour). Re-run Step 2 until green.

- [ ] **Step 4: Full suite + typecheck.** `npx vitest run`; `npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add data/wizards.ts tests/data/rolePoolInvariant.test.ts
git commit -m "data(wizards): guarantee each pool has a role-type spell (+ invariant test)"
```

---

### Task 10: Legibility — role-matchup UI

**Files:**
- Modify: `lib/roleInfo.ts` (add `rolePreyOf`/`roleMatchupText`)
- Modify: `components/screens/MapScreen.tsx` (EnemyPreview: show "forte vs {prey}" per enemy role) and/or a wizard card component
- Test: `tests/lib/roleInfo.test.ts` (matchup helper) + `tests/screens/spellForgeAndHp.test.tsx` extend (EnemyPreview shows matchup)

**Interfaces:**
- Consumes: `ROLE_PREY` (Task 1).

- [ ] **Step 1: Write the failing helper test.** In `tests/lib/roleInfo.test.ts` add:
```ts
import { rolePreyOf } from '@/lib/roleInfo'
it('rolePreyOf returns the countered role', () => {
  expect(rolePreyOf('Attaccante')).toBe('Supporto')
  expect(rolePreyOf('Controllo')).toBe('Tank')
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement helper.** In `lib/roleInfo.ts` add:
```ts
import { ROLE_PREY } from '@/game/engine/combat/roleCounter'
import type { Role } from '@/types'
export function rolePreyOf(role: Role): Role { return ROLE_PREY[role] }
```

- [ ] **Step 4: Show it in the enemy preview.** In `MapScreen.tsx` `EnemyPreview`, under each enemy's name/role add a tiny line `forte vs {emoji/label of rolePreyOf(role)}`. Use the existing role label/icon utilities. Keep it one small muted line so the card stays compact.

- [ ] **Step 5: Verify visually.** Rebuild the screenshot driver (see [[screenshot-harness]] memory / scratchpad `shoot.js`), capture `map-elite-hover.png`, and confirm the matchup line reads clearly and doesn't overflow the card. Adjust styling if it wraps badly.

- [ ] **Step 6: Run tests + typecheck + commit.**
```bash
git add lib/roleInfo.ts components/screens/MapScreen.tsx tests/lib/roleInfo.test.ts
git commit -m "feat(ui): show role matchup (forte vs …) on the enemy preview"
```

---

### Task 11: Re-anchor the balance harnesses + playtest note

**Files:**
- Modify: `tests/engine/campaignBalanceRestricted.test.ts`, `tests/engine/campaignBalanceB.test.ts` (relax/re-anchor winRate assertions to smoke checks with a comment; capture the new numbers)
- Modify: any role-specific test invalidated by the new mechanics (grep `controlVsTank`, `controlVsBackline`, old Controllo-duration expectations)

- [ ] **Step 1: Run the full suite; list failures.** `npx vitest run 2>&1 | tail -40`. Expect the two campaign-balance harnesses (and possibly a role/targeting test) to shift because role damage + targeting + spell bias all changed.

- [ ] **Step 2: Re-anchor.** For each shifted balance harness, run it with `--reporter=verbose --disableConsoleIntercept` to read the new winRate, and update the assertion to a smoke check (`>0`, `<=1`) with a comment noting the new observed value and that **counters aren't understood by the bot → user playtest is the real gauge**. Do NOT chase a specific winRate here.

- [ ] **Step 3: Fix any stale unit test.** Update assertions that encoded the removed Controllo-vs-Tank behaviour to the new matrix/passive behaviour (or delete if now covered by Tasks 2/5).

- [ ] **Step 4: Full green + typecheck.** `npx vitest run`; `npx tsc --noEmit`.

- [ ] **Step 5: Commit.**
```bash
git add tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts
git commit -m "test(balance): re-anchor harnesses after role-counter system (smoke checks)"
```

---

## Post-implementation

- Drive the app with the screenshot harness: play a battle, confirm the matchup reads and the passives feel right (a stunned Tank stops soaking; a dived Supporto dies; a Supporto team shrugs off control).
- Report the observed balance numbers and hand back to the user for the real feel-check playtest.
