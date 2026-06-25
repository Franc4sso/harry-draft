# Traits Phase 3 — 10 New Generic Traits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the trait catalog from 5 to 15 by adding 10 generic, reusable traits — using only hooks the engine already fires and effects it already supports.

**Architecture:** Pure data additions to `data/traits.ts`. Each trait is a `Trait` with a `reactive` trigger whose `effects(ctx)` returns `EffectSpec[]`. No engine, type, or UI changes. Tests assert on each trigger's `effects()` output directly (no battle seeds), plus one integration smoke test for both-side firing.

**Tech Stack:** TypeScript, Vitest. Existing modules: `data/traits.ts`, `types/trait.ts`, `types/status.ts`, `game/engine/combat/effects.ts`.

## Global Constraints

- **Zero engine changes.** Only `data/traits.ts` and test files are touched.
- Reactive traits use only fired hooks: `onHit`, `onHeal`, `onTurnStart`, `onTurnEnd`, `onAllyDeath`. NOT `onBattleStart` / `onHpThreshold` / `onDeath`.
- `heal`/`shield`/`damage` EffectSpecs always hit `ctx.target` — no target selector. On `onHit`, `ctx.target` is the ENEMY. So self-effects on `onHit` MUST use `applyStatus` with `target: 'self'`.
- `applyStatus` honors `chance?: number` (rng-gated) and `target: 'self' | 'enemy'`.
- Status IDs available: `stun`, `freeze`, `silence`, `disarm`, `burn` (dot), `regen`, `shield`, `atkUp`, `defUp`, `slow`. Inline `effect: { kind, stat, amount, duration }` also supported.
- Trait `desc` is Italian (matches the existing 5). Names Italian.
- Do NOT assign traits to wizards — out of scope.
- All constants are named `const` at the top of `data/traits.ts`, matching existing style.

---

## File Structure

- **Modify:** `data/traits.ts` — append 10 entries to `TRAITS`. `TRAIT_BY_ID` updates automatically (built from `TRAITS`).
- **Create:** `tests/engine/traitsPhase3.test.ts` — one test per trait asserting its trigger's `effects()` output; chance-gated traits assert `chance` is set; symmetry smoke test.

Reference for the `effects()` assertion pattern: `tests/engine/traitEffects.test.ts` (modifier traits call `t.apply(...)`; reactive traits call `t.effects(ctx)`).

---

## Task 1: Control-on-hit traits (Pietrificazione, Bavaglio, Disarmo)

Three `onHit` traits that apply a control status to the enemy with ~18% chance.

**Files:**
- Modify: `data/traits.ts`
- Test: `tests/engine/traitsPhase3.test.ts` (create)

**Interfaces:**
- Consumes: `Trait` from `@/types`; `TRAIT_BY_ID` from `@/data/traits`; `HookCtx`, `BattleUnit` from `@/types`.
- Produces: traits `pietrificazione`, `bavaglio`, `disarmo` in `TRAIT_BY_ID`. Each `trigger.kind === 'reactive'`, `hook === 'onHit'`, `owner === 'actor'`, `effects(ctx)` returns one `applyStatus` spec with `target: 'enemy'`, `statusId`, `chance: CONTROL_CHANCE`, `duration`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/traitsPhase3.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID } from '@/data/traits'
import type { BattleUnit, HookCtx, EffectSpec } from '@/types'

const STUB_SPELL = { id: 'stub', name: 'Stub', desc: '', type: 'Attacco' as const, hitChance: 1 }

function u(hp = 100, maxHp = 100): BattleUnit {
  const stats = { hp: 100, atk: 30, def: 20, spd: 25 }
  return { wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
    ranges: { hp: [100,100], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: [] },
    stats, maxHp, hp, spell: STUB_SPELL, side: 'left', cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true } as BattleUnit
}

const ctx = (): HookCtx => ({ turn: 1, actor: u(), target: u(), side: 'left', flags: [] })

/** Pull the EffectSpec list off a reactive trait, asserting it is reactive. */
function reactiveEffects(id: string): EffectSpec[] {
  const t = TRAIT_BY_ID[id]!.trigger
  if (t.kind !== 'reactive') throw new Error(`${id} expected reactive`)
  return t.effects(ctx())
}

describe('Phase 3 control-on-hit traits', () => {
  it('Pietrificazione applies a chance-gated stun to the enemy on hit', () => {
    const t = TRAIT_BY_ID['pietrificazione']!.trigger
    expect(t.kind).toBe('reactive')
    if (t.kind !== 'reactive') return
    expect(t.hook).toBe('onHit')
    expect(t.owner).toBe('actor')
    const [eff] = t.effects(ctx())
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'stun' })
    if (eff.kind === 'applyStatus') {
      expect(eff.chance).toBeGreaterThan(0)
      expect(eff.chance).toBeLessThan(0.5)
    }
  })

  it('Bavaglio applies a chance-gated silence to the enemy on hit', () => {
    const [eff] = reactiveEffects('bavaglio')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'silence' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0)
  })

  it('Disarmo applies a chance-gated disarm to the enemy on hit', () => {
    const [eff] = reactiveEffects('disarmo')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'disarm' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- traitsPhase3`
Expected: FAIL — `TRAIT_BY_ID['pietrificazione']` is undefined (`Cannot read properties of undefined`).

- [ ] **Step 3: Add the three traits to `data/traits.ts`**

Add constants near the existing ones (top of file, after the current `const` block):

```typescript
const CONTROL_CHANCE = 0.18
const STUN_DURATION = 1
const SILENCE_DURATION = 2
const DISARM_DURATION = 2
```

Append to the `TRAITS` array (before the closing `]`):

```typescript
  {
    id: 'pietrificazione', name: 'Pietrificazione',
    desc: 'I suoi colpi possono stordire il bersaglio.',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'stun', chance: CONTROL_CHANCE, duration: STUN_DURATION }],
    },
  },
  {
    id: 'bavaglio', name: 'Bavaglio',
    desc: 'I suoi colpi possono silenziare il bersaglio (niente incantesimi).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'silence', chance: CONTROL_CHANCE, duration: SILENCE_DURATION }],
    },
  },
  {
    id: 'disarmo', name: 'Disarmo',
    desc: 'I suoi colpi possono disarmare il bersaglio (niente attacchi).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'disarm', chance: CONTROL_CHANCE, duration: DISARM_DURATION }],
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- traitsPhase3`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add data/traits.ts tests/engine/traitsPhase3.test.ts
git commit -m "feat(traits): Pietrificazione, Bavaglio, Disarmo (control on hit)"
```

---

## Task 2: Damage-over-time + slow on hit (Veleno, Logoramento)

Two more `onHit` enemy-debuff traits with higher chance.

**Files:**
- Modify: `data/traits.ts`
- Test: `tests/engine/traitsPhase3.test.ts`

**Interfaces:**
- Consumes: same as Task 1.
- Produces: traits `veleno` (statusId `burn`, chance `POISON_CHANCE`) and `logoramento` (statusId `slow`, chance `ATTRITION_CHANCE`), both `onHit` / `target: 'enemy'`.

- [ ] **Step 1: Write the failing test**

Append inside `tests/engine/traitsPhase3.test.ts` (new describe block):

```typescript
describe('Phase 3 dot + slow traits', () => {
  it('Veleno applies a burn (dot) to the enemy on hit', () => {
    const [eff] = reactiveEffects('veleno')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'burn' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0.18)
  })

  it('Logoramento applies a slow (spd debuff) to the enemy on hit', () => {
    const [eff] = reactiveEffects('logoramento')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'slow' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0.18)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- traitsPhase3`
Expected: FAIL — `veleno` / `logoramento` undefined.

- [ ] **Step 3: Add the two traits to `data/traits.ts`**

Add constants:

```typescript
const POISON_CHANCE = 0.5
const POISON_DURATION = 2
const ATTRITION_CHANCE = 0.4
const ATTRITION_DURATION = 2
```

Append to `TRAITS`:

```typescript
  {
    id: 'veleno', name: 'Veleno',
    desc: 'I suoi colpi avvelenano: danno nel tempo al bersaglio.',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'burn', chance: POISON_CHANCE, duration: POISON_DURATION }],
    },
  },
  {
    id: 'logoramento', name: 'Logoramento',
    desc: 'I suoi colpi rallentano il bersaglio (-VEL).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'slow', chance: ATTRITION_CHANCE, duration: ATTRITION_DURATION }],
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- traitsPhase3`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add data/traits.ts tests/engine/traitsPhase3.test.ts
git commit -m "feat(traits): Veleno (dot) + Logoramento (slow) on hit"
```

---

## Task 3: Self-buff-on-hit (Ferocia)

A trait that buffs the actor's attack each time it lands a hit. Because `onHit`'s `ctx.target` is the enemy, the self-buff MUST use `applyStatus` with `target: 'self'`.

**Files:**
- Modify: `data/traits.ts`
- Test: `tests/engine/traitsPhase3.test.ts`

**Interfaces:**
- Produces: trait `ferocia` — `onHit`, `effects()` returns one `applyStatus` with `target: 'self'`, `statusId: 'atkUp'`.

- [ ] **Step 1: Write the failing test**

Append (new describe):

```typescript
describe('Phase 3 self-buff-on-hit trait', () => {
  it('Ferocia buffs the ACTOR (self) on hit, not the enemy', () => {
    const [eff] = reactiveEffects('ferocia')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'self', statusId: 'atkUp' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- traitsPhase3`
Expected: FAIL — `ferocia` undefined.

- [ ] **Step 3: Add the trait to `data/traits.ts`**

Add constant:

```typescript
const FEROCITY_DURATION = 2
```

Append to `TRAITS`:

```typescript
  {
    id: 'ferocia', name: 'Ferocia',
    desc: 'Ogni colpo che mette a segno aumenta il suo attacco.',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', statusId: 'atkUp', duration: FEROCITY_DURATION }],
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- traitsPhase3`
Expected: PASS (6 total).

- [ ] **Step 5: Commit**

```bash
git add data/traits.ts tests/engine/traitsPhase3.test.ts
git commit -m "feat(traits): Ferocia (self atk buff on hit)"
```

---

## Task 4: Turn-start self traits (Rigenerazione, Anticipo)

Two `onTurnStart` traits. Hook fires on the acting unit; effects resolve to self. `target: 'self'` is used for clarity even though turn-start ctx has no enemy.

**Files:**
- Modify: `data/traits.ts`
- Test: `tests/engine/traitsPhase3.test.ts`

**Interfaces:**
- Produces: `rigenerazione` (`onTurnStart`, `applyStatus self statusId: 'regen'`) and `anticipo` (`onTurnStart`, `applyStatus self` inline `{ kind: 'buff', stat: 'spd', amount: ANTICIPATE_SPD }`).

Note: turn-start ctx has no `target`. The test ctx helper provides one, which is harmless — the trait declares `target: 'self'` so resolution uses `ctx.actor`.

- [ ] **Step 1: Write the failing test**

Append (new describe):

```typescript
describe('Phase 3 turn-start self traits', () => {
  it('Rigenerazione grants the actor regen at turn start', () => {
    const [eff] = reactiveEffects('rigenerazione')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'self', statusId: 'regen' })
    const t = TRAIT_BY_ID['rigenerazione']!.trigger
    if (t.kind === 'reactive') expect(t.hook).toBe('onTurnStart')
  })

  it('Anticipo grants the actor a spd buff at turn start', () => {
    const [eff] = reactiveEffects('anticipo')
    expect(eff.kind).toBe('applyStatus')
    if (eff.kind === 'applyStatus') {
      expect(eff.target).toBe('self')
      expect(eff.effect).toMatchObject({ kind: 'buff', stat: 'spd' })
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- traitsPhase3`
Expected: FAIL — traits undefined.

- [ ] **Step 3: Add the traits to `data/traits.ts`**

Add constants:

```typescript
const REGEN_DURATION = 3
const ANTICIPATE_SPD = 10
const ANTICIPATE_DURATION = 1
```

Append to `TRAITS`:

```typescript
  {
    id: 'rigenerazione', name: 'Rigenerazione',
    desc: 'Si rigenera un poco di vita ogni turno.',
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', statusId: 'regen', duration: REGEN_DURATION }],
    },
  },
  {
    id: 'anticipo', name: 'Anticipo',
    desc: 'A inizio turno guadagna velocità.',
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'spd', amount: ANTICIPATE_SPD, duration: ANTICIPATE_DURATION } }],
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- traitsPhase3`
Expected: PASS (8 total).

- [ ] **Step 5: Commit**

```bash
git add data/traits.ts tests/engine/traitsPhase3.test.ts
git commit -m "feat(traits): Rigenerazione + Anticipo (turn-start self buffs)"
```

---

## Task 5: Conditional self-buff traits (Crescendo, Vendetta)

Crescendo (`onTurnStart`, escalating atk) and Vendetta (`onAllyDeath`, atk spike). Crescendo's "grows every turn" behavior depends on how repeated inline buffs stack — this task includes an explicit stacking verification.

**Files:**
- Modify: `data/traits.ts`
- Test: `tests/engine/traitsPhase3.test.ts`

**Interfaces:**
- Produces: `crescendo` (`onTurnStart`, `applyStatus self` inline `{ kind: 'buff', stat: 'atk', amount: CRESCENDO_ATK, duration: CRESCENDO_DURATION }`) and `vendetta` (`onAllyDeath`, `applyStatus self` inline `{ kind: 'buff', stat: 'atk', amount: VENDETTA_ATK, duration: VENDETTA_DURATION }`).

- [ ] **Step 1: Write the failing trait-shape test**

Append (new describe):

```typescript
describe('Phase 3 conditional self-buff traits', () => {
  it('Crescendo buffs the actor atk at turn start', () => {
    const [eff] = reactiveEffects('crescendo')
    expect(eff.kind).toBe('applyStatus')
    if (eff.kind === 'applyStatus') {
      expect(eff.target).toBe('self')
      expect(eff.effect).toMatchObject({ kind: 'buff', stat: 'atk' })
    }
    const t = TRAIT_BY_ID['crescendo']!.trigger
    if (t.kind === 'reactive') expect(t.hook).toBe('onTurnStart')
  })

  it('Vendetta buffs the actor atk when an ally dies', () => {
    const [eff] = reactiveEffects('vendetta')
    expect(eff.kind).toBe('applyStatus')
    if (eff.kind === 'applyStatus') {
      expect(eff.target).toBe('self')
      expect(eff.effect).toMatchObject({ kind: 'buff', stat: 'atk' })
    }
    const t = TRAIT_BY_ID['vendetta']!.trigger
    if (t.kind === 'reactive') expect(t.hook).toBe('onAllyDeath')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- traitsPhase3`
Expected: FAIL — traits undefined.

- [ ] **Step 3: Add the traits to `data/traits.ts`**

Add constants:

```typescript
const CRESCENDO_ATK = 6
const CRESCENDO_DURATION = 3
const VENDETTA_ATK = 30
const VENDETTA_DURATION = 3
```

Append to `TRAITS`:

```typescript
  {
    id: 'crescendo', name: 'Crescendo',
    desc: 'Più dura lo scontro, più diventa forte.',
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'atk', amount: CRESCENDO_ATK, duration: CRESCENDO_DURATION } }],
    },
  },
  {
    id: 'vendetta', name: 'Vendetta',
    desc: 'Quando un alleato cade, si infuria (+ATT).',
    trigger: {
      kind: 'reactive', hook: 'onAllyDeath', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'atk', amount: VENDETTA_ATK, duration: VENDETTA_DURATION } }],
    },
  },
```

- [ ] **Step 4: Run trait-shape test to verify it passes**

Run: `npm run test -- traitsPhase3`
Expected: PASS (10 total).

- [ ] **Step 5: Verify Crescendo stacking behavior (decision step)**

Read `applyInlineEffect` and the inline-buff stack policy:

Run: `grep -n "applyInlineEffect" game/engine/status*.ts game/engine/**/status*.ts`

Then read that function. Determine: when the SAME inline atk buff is applied on consecutive turns, does the actor's effective atk **increase** (stack/extend) or merely **refresh** (cap at one instance)?

- If it stacks/increases → Crescendo works as designed. Add this assertion to the Crescendo test and re-run:

```typescript
  it('Crescendo stacks: applying it twice raises effective atk more than once', () => {
    // Build a unit, apply the inline buff twice via the same path the engine uses,
    // and assert effectiveStats(unit).atk grew on the second application.
    // Use applyInlineEffect + effectiveStats imported from the engine status module.
  })
```

  Fill the test body using the real `applyInlineEffect` / `effectiveStats` signatures discovered above (import paths from `game/engine/status`). Assert second application yields strictly higher `atk` than first.

- If it only refreshes (no growth) → Crescendo does NOT grow. Fix: change its desc to "+ATT costante mentre combatte" OR convert to a stacking inline effect if the policy supports a `stack` field. Pick the option that needs no engine change. Update the Crescendo trait + test to match the actual behavior. Document the choice in the commit message.

- [ ] **Step 6: Commit**

```bash
git add data/traits.ts tests/engine/traitsPhase3.test.ts
git commit -m "feat(traits): Crescendo + Vendetta (conditional atk buffs)"
```

---

## Task 6: Both-side firing smoke test + full verification

Confirm a Phase 3 trait actually fires inside a real battle on the RIGHT side (proving symmetry), mirroring the Phase 2 `traitReactive.test.ts` approach — but WITHOUT assigning traits to wizards. Instead, build a `BattleUnit` whose `wizard.traits` includes a Phase 3 trait id, and run it through `simulateBattle`.

**Files:**
- Test: `tests/engine/traitsPhase3.test.ts`

**Interfaces:**
- Consumes: `simulateBattle` from `@/game/engine/combat/simulate`; `draftWizard` from `@/game/engine/statRoll`; `createRng` from `@/game/engine/rng`; `WIZARDS` from `@/data/wizards`.

- [ ] **Step 1: Inspect how `wizard.traits` flows into registration**

Run: `grep -rn "traits" game/engine/combat/simulate.ts game/engine/traits.ts`

Confirm `simulateBattle` reads `unit.wizard.traits` (or equivalent) to register trait triggers. Note the exact property path — the test must set it on a drafted wizard.

- [ ] **Step 2: Write the symmetry smoke test**

Append (new describe). Adapt the trait-injection to the property path found in Step 1:

```typescript
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

describe('Phase 3 traits fire in real battle on both sides', () => {
  it('Logoramento on a RIGHT-side unit slows the LEFT player it hits', () => {
    const harry = draftWizard(createRng(1), WIZARDS.find(w => w.id === 'harry')!)
    const enemyBase = WIZARDS.find(w => w.id === 'bellatrix')!
    // Inject the trait without editing data/wizards.ts (out of scope).
    const enemy = draftWizard(createRng(2), { ...enemyBase, traits: ['logoramento'] })
    // Try a few seeds so at least one lets the enemy land 2+ hits on Harry.
    const slowed = [4, 5, 6, 7, 8].some(seed => {
      const res = simulateBattle([harry], [enemy], createRng(seed))
      return res.snapshots.some(s =>
        Object.values(s).some(unit =>
          unit.statusEffects.some(e =>
            (e.statusId === 'slow') || (e.kind === 'debuff' && e.stat === 'spd'))))
    })
    expect(slowed).toBe(true)
  })
})
```

- [ ] **Step 3: Run the smoke test**

Run: `npm run test -- traitsPhase3`
Expected: PASS. If no seed in `[4,5,6,7,8]` triggers a slow (e.g. Bellatrix dies turn 1 every time), widen the seed list to `[1..15]` until one lands, or pick a tankier enemy id whose stats let it survive and attack. Document the working seed set in a code comment.

- [ ] **Step 4: Full suite + typecheck**

Run: `npm run test`
Expected: all tests pass (previous 481 + new Phase 3 tests, none broken).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Production build sanity**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit + push**

```bash
git add tests/engine/traitsPhase3.test.ts
git commit -m "test(traits): Phase 3 both-side firing smoke test"
git push origin master
```

---

## Self-Review

**Spec coverage:**
- 10 traits — Tasks 1-5 (3+2+1+2+2 = 10). ✅ Pietrificazione, Bavaglio, Disarmo, Veleno, Logoramento, Ferocia, Rigenerazione, Anticipo, Crescendo, Vendetta.
- Zero engine changes — only `data/traits.ts` + tests touched. ✅
- Chance ~18% control / higher dot+slow — Tasks 1-2. ✅
- Lifesteal/thorns excluded — not in any task. ✅
- Both-side firing verified — Task 6. ✅
- Crescendo stacking uncertainty — Task 5 Step 5 resolves it explicitly. ✅
- No wizard assignment — Task 6 injects traits via spread, data/wizards.ts untouched. ✅

**Placeholder scan:** Task 5 Step 5 and Task 6 Steps 1/3 contain conditional/discovery steps, but each gives the exact command to run and the exact decision rule — not "TBD". Acceptable: they hinge on engine facts the implementer must read (stack policy, trait property path) and the plan tells them precisely what to look for and how to branch.

**Type consistency:** All traits use `kind: 'reactive'`, `owner: 'actor'`, `effects: () => EffectSpec[]` — matches `types/trait.ts`. `applyStatus` specs use `target`, `statusId`/`effect`, `chance`, `duration` — matches `types/status.ts` `EffectSpec`. Test helper `u()` / `ctx()` mirror `tests/engine/traitEffects.test.ts`. ✅
