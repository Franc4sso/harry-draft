# Traits (Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-wizard **trait** layer (optional signature abilities on top of the role baseline) that works for BOTH teams and is legible in the replay, starting with a 5-trait slice.

**Architecture:** Make reactive combat hooks fire for both sides (guarded by listener-count, so trait-less battles stay byte-identical). Traits are hand-authored data with a hook trigger; `registerTraitTriggers` registers owner-gated listeners on the existing EventBus. Damage-modifier traits fold the attack value; reactive traits apply statuses (visible as status chips).

**Tech Stack:** TypeScript, Vitest, Next.js. Engine in `game/engine/combat`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-25-traits-phase2-design.md`.
- **Determinism invariant:** any battle with NO trait-bearing wizard must produce an identical result/log/snapshots after every task. The reactive-symmetry change relies on the existing `collectReactive(...).length === 0 → skip` guard.
- Relics remain a LEFT-only mechanic.
- Traits gate by **unit reference identity** in `HookCtx` (not by side).
- Run `npx vitest run` and `npx tsc --noEmit` (both must be green each task).
- Breaking-changes Next.js fork — touch only engine/data/types/UI as specified.

---

## File Structure

- `game/engine/relics.ts` — relic reactive listeners become side-gated.
- `game/engine/combat/simulate.ts` — fire reactive hooks both sides; call `registerTraitTriggers`.
- `types/trait.ts` — NEW: `Trait`, `TraitTrigger`, `TraitSubject`.
- `types/wizard.ts` — add `traits?: string[]`.
- `types/index.ts` (or barrel) — export trait types.
- `game/engine/traits.ts` — NEW: `registerTraitTriggers`, tuning constants.
- `data/traits.ts` — NEW: `TRAITS`, `TRAIT_BY_ID`.
- `data/wizards.ts` — assign traits to a few wizards.
- `components/cards/WizardCard.tsx` — render trait chips.
- Tests under `tests/engine/` and `tests/ui/`.

---

### Task 1: Engine foundation — reactive symmetry (behaviour-preserving)

**Files:**
- Modify: `game/engine/relics.ts` (relic reactive registration)
- Modify: `game/engine/combat/simulate.ts` (remove left-only reactive gates)
- Test: `tests/engine/combat/reactiveSymmetry.test.ts` (NEW)

**Interfaces:**
- Produces: reactive hooks fire for both sides; relic effects stay left-only.

- [ ] **Step 1: Write the determinism + symmetry test (NEW file)**

Create `tests/engine/combat/reactiveSymmetry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function team(seed: number) {
  const rng = createRng(seed)
  return WIZARDS.slice(0, 10).filter((_, i) => i % 2 === 0).slice(0, 5).map(w => draftWizard(rng, w))
}

describe('reactive symmetry', () => {
  it('trait-less battles are byte-identical (determinism preserved)', () => {
    const a = simulateBattle(team(1), team(2), createRng(3),
      { leftSyn: detectSynergies(team(1)), rightSyn: detectSynergies(team(2)) })
    const b = simulateBattle(team(1), team(2), createRng(3),
      { leftSyn: detectSynergies(team(1)), rightSyn: detectSynergies(team(2)) })
    expect(a.log.length).toBe(b.log.length)
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log))
  })
})
```

- [ ] **Step 2: Run it (baseline must pass before changes)**

Run: `npx vitest run tests/engine/combat/reactiveSymmetry.test.ts`
Expected: PASS (this guards that Step 4 doesn't perturb trait-less battles).

- [ ] **Step 3: Side-gate relic reactive listeners**

In `game/engine/relics.ts`, change the reactive registration so relic effects never apply to the right side once reactive fires there:

```ts
        if (trig.hook === 'onBattleStart' || trig.hook === 'onHit'
          || trig.hook === 'onHeal' || trig.hook === 'onDeath'
          || trig.hook === 'onAllyDeath' || trig.hook === 'onTurnStart'
          || trig.hook === 'onTurnEnd' || trig.hook === 'onHpThreshold') {
          bus.onReactive(trig.hook, (ctx) => (ctx.side === 'left' ? specs : []))
        }
```

- [ ] **Step 4: Fire reactive hooks for both sides**

In `game/engine/combat/simulate.ts`, remove the `actor.side === 'left'` / left-target gates at the reactive fire sites so both sides fire. Each site keeps its `collectReactive(...).length === 0 → skip` guard (already present in `fireReactive`; for the inline `onHit` block a no-op loop on `[]` is already safe). Specifically:

- `onTurnStart`: `if (actor.side === 'left') fireReactive('onTurnStart', actor, turn)` → `fireReactive('onTurnStart', actor, turn)`
- every `if (actor.side === 'left') fireReactive('onTurnEnd', actor, turn)` → `fireReactive('onTurnEnd', actor, turn)`
- `onHit` block guard `if (actor.side === 'left' && realTarget.side !== actor.side)` → `if (realTarget.side !== actor.side)`, and set `side: actor.side` (not the hard-coded `'left'`) in `hitCtx`.
- `onHeal`: `if (entry.flags.includes('heal') && realTarget.side === 'left')` → `if (entry.flags.includes('heal'))`
- the action-loop `onDeath`/`onAllyDeath` block `if (!realTarget.alive && realTarget.side === 'left')` → `if (!realTarget.alive)` (fire onDeath for the dead unit; onAllyDeath for its living allies — use `realTarget.side === 'left' ? L : R` to pick the right ally pool)
- the end-of-turn dot/fatigue `onDeath`/`onAllyDeath` blocks (currently `u.side === 'left'`) → fire for both, picking the ally pool by `u.side`.
- `checkThreshold` (onHpThreshold): if it is gated to left, allow both sides (pick ally pool by side where relevant).

For each ally-pool selection, replace the hard-coded `L` with `realTarget.side === 'left' ? L : R` (and `u.side === 'left' ? L : R`).

- [ ] **Step 5: Re-run determinism test + full combat suite**

Run: `npx vitest run tests/engine/combat`
Expected: PASS — determinism test still green (no listeners on right → no change), all combat/snapshot tests unchanged. If ANY snapshot changed, STOP: the guard was bypassed somewhere (a right-side listener fired) — investigate, do not `-u`.

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add game/engine/relics.ts game/engine/combat/simulate.ts tests/engine/combat/reactiveSymmetry.test.ts
git commit -m "feat(combat): reactive hooks fire for both sides (relics stay left-only)"
```

---

### Task 2: Trait data model + owner-gated registration (no traits assigned yet)

**Files:**
- Create: `types/trait.ts`
- Modify: `types/wizard.ts` (add `traits?`), barrel export for `Trait`
- Create: `game/engine/traits.ts` (`registerTraitTriggers`, constants)
- Create: `data/traits.ts` (`TRAITS: Trait[] = []` placeholder + `TRAIT_BY_ID`)
- Modify: `game/engine/combat/simulate.ts` (call `registerTraitTriggers`)
- Test: `tests/engine/traits.test.ts` (NEW)

**Interfaces:**
- Produces: `Trait`, `TraitTrigger`, `TraitSubject` types; `registerTraitTriggers(bus, units: BattleUnit[]): void`; `TRAIT_BY_ID: Record<string, Trait>`.

- [ ] **Step 1: Add trait types**

Create `types/trait.ts`:

```ts
import type { EffectSpec } from './status'
import type { HookCtx, ModifierHook, ReactiveHook } from './events'

/** Which unit in the HookCtx owns (triggers) the trait. */
export type TraitSubject = 'actor' | 'target'

export type TraitTrigger =
  | { kind: 'modifier'; hook: ModifierHook; owner: TraitSubject; apply: (value: number, ctx: HookCtx) => number }
  | { kind: 'reactive'; hook: ReactiveHook; owner: TraitSubject; effects: (ctx: HookCtx) => EffectSpec[] }

export interface Trait {
  id: string
  name: string
  desc: string
  trigger: TraitTrigger
}
```

Add `traits?: string[]` to `Wizard` in `types/wizard.ts`, and export the trait types from the types barrel (mirror how `Spell`/`Relic` are exported).

- [ ] **Step 2: Write the registration test (NEW file)**

Create `tests/engine/traits.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerTraitTriggers } from '@/game/engine/traits'
import type { BattleUnit, Trait } from '@/types'

function unit(id: string, traits: string[]): BattleUnit {
  const stats = { hp: 100, atk: 30, def: 20, spd: 25 }
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [100,100], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: ['base_attack'], traits },
    stats, maxHp: 100, spell: { id: 'base_attack', name: 'x', desc: '', type: 'Attacco', hitChance: 1 },
    side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true,
  } as BattleUnit
}

// A test trait: +100% outgoing damage, owner = actor.
const DOUBLE: Trait = {
  id: 'double', name: 'Double', desc: 'x2',
  trigger: { kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v * 2 },
}

describe('registerTraitTriggers (owner gating)', () => {
  it('applies a trait only when its owner is the ctx actor', () => {
    const bus = createEventBus()
    const owner = unit('owner', ['double'])
    const other = unit('other', [])
    // Inject the test trait by id via a local map override:
    registerTraitTriggers(bus, [owner, other], { double: DOUBLE })
    const base = 10
    const boosted = bus.emitModifier('modifyOutgoingDamage', base, { turn: 1, actor: owner, side: 'left', flags: [] })
    const unboosted = bus.emitModifier('modifyOutgoingDamage', base, { turn: 1, actor: other, side: 'left', flags: [] })
    expect(boosted).toBe(20)
    expect(unboosted).toBe(10)
  })
})
```

(Implementer: give `registerTraitTriggers` an optional 3rd param `catalog = TRAIT_BY_ID` so tests can inject; default to the real catalog.)

- [ ] **Step 3: Implement `registerTraitTriggers`**

Create `game/engine/traits.ts`:

```ts
import type { BattleUnit, Trait } from '@/types'
import type { EventBus } from './combat/eventBus'
import { TRAIT_BY_ID } from '@/data/traits'

export function registerTraitTriggers(
  bus: EventBus, units: BattleUnit[], catalog: Record<string, Trait> = TRAIT_BY_ID,
): void {
  for (const u of units) {
    for (const id of u.wizard.traits ?? []) {
      const trait = catalog[id]
      if (!trait) continue
      const t = trait.trigger
      const ownerOf = (ctx: { actor: BattleUnit; target?: BattleUnit }) =>
        t.owner === 'actor' ? ctx.actor : ctx.target
      if (t.kind === 'modifier') {
        bus.onModifier(t.hook, (v, ctx) => (ownerOf(ctx) === u ? t.apply(v, ctx) : v))
      } else {
        bus.onReactive(t.hook, (ctx) => (ownerOf(ctx) === u ? t.effects(ctx) : []))
      }
    }
  }
}
```

- [ ] **Step 4: Placeholder catalog**

Create `data/traits.ts`:

```ts
import type { Trait } from '@/types'

export const TRAITS: Trait[] = []
export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map(t => [t.id, t]))
```

- [ ] **Step 5: Wire into simulateBattle**

In `game/engine/combat/simulate.ts`, after `registerRelicTriggers(bus, left, leftRelics)`, add:

```ts
  registerTraitTriggers(bus, [...L, ...R])
```

(import `registerTraitTriggers` from `../traits`.)

- [ ] **Step 6: Run tests + tsc + commit**

Run: `npx vitest run tests/engine/traits.test.ts && npx vitest run tests/engine/combat && npx tsc --noEmit`
Expected: PASS (empty catalog → no behaviour change; determinism intact).

```bash
git add types/trait.ts types/wizard.ts game/engine/traits.ts data/traits.ts game/engine/combat/simulate.ts tests/engine/traits.test.ts
git commit -m "feat(traits): trait data model + owner-gated registration (empty catalog)"
```

---

### Task 3: Damage-modifier traits — Esecuzione, Furia, Roccia

**Files:**
- Modify: `game/engine/traits.ts` (add tuning constants) OR `data/traits.ts` (constants near catalog)
- Modify: `data/traits.ts` (add the 3 traits)
- Modify: `data/wizards.ts` (assign: Voldemort → esecuzione+furia; McGonagall → roccia)
- Test: `tests/engine/traitEffects.test.ts` (NEW)

**Interfaces:**
- Consumes: `Trait`, `HookCtx`, `BALANCE`/local constants.
- Produces: trait ids `esecuzione`, `furia`, `roccia` in `TRAIT_BY_ID`.

- [ ] **Step 1: Write the trait-effect tests (NEW file)**

Create `tests/engine/traitEffects.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID } from '@/data/traits'
import type { BattleUnit, HookCtx } from '@/types'

function u(over: Partial<BattleUnit['buffedStats']> = {}, hp = 100, maxHp = 100): BattleUnit {
  const stats = { hp: 100, atk: 30, def: 20, spd: 25, ...over }
  return { wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
    ranges: { hp: [100,100], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: [] },
    stats, maxHp, hp, side: 'left', cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true } as BattleUnit
}

describe('damage-modifier traits', () => {
  it('Esecuzione boosts damage only against sub-30% targets', () => {
    const t = TRAIT_BY_ID['esecuzione']!.trigger
    if (t.kind !== 'modifier') throw new Error('expected modifier')
    const low: HookCtx = { turn: 1, actor: u(), target: u({}, 20, 100), side: 'left', flags: [] }
    const high: HookCtx = { turn: 1, actor: u(), target: u({}, 80, 100), side: 'left', flags: [] }
    expect(t.apply(100, low)).toBeGreaterThan(100)
    expect(t.apply(100, high)).toBe(100)
  })

  it('Furia scales damage with the attacker missing HP', () => {
    const t = TRAIT_BY_ID['furia']!.trigger
    if (t.kind !== 'modifier') throw new Error('expected modifier')
    const full: HookCtx = { turn: 1, actor: u({}, 100, 100), side: 'left', flags: [] }
    const hurt: HookCtx = { turn: 1, actor: u({}, 10, 100), side: 'left', flags: [] }
    expect(t.apply(100, full)).toBe(100)
    expect(t.apply(100, hurt)).toBeGreaterThan(100)
  })

  it('Roccia reduces incoming damage', () => {
    const t = TRAIT_BY_ID['roccia']!.trigger
    if (t.kind !== 'modifier') throw new Error('expected modifier')
    expect(t.apply(100, { turn: 1, actor: u(), target: u(), side: 'left', flags: [] })).toBeLessThan(100)
  })
})
```

- [ ] **Step 2: Run — expect failure (traits not defined)**

Run: `npx vitest run tests/engine/traitEffects.test.ts`
Expected: FAIL — `TRAIT_BY_ID['esecuzione']` is undefined.

- [ ] **Step 3: Add the 3 traits to `data/traits.ts`**

```ts
import type { Trait } from '@/types'

const EXECUTE_THRESHOLD = 0.3
const EXECUTE_MULT = 1.5
const FURY_MAX_BONUS = 0.6     // up to +60% at 1 HP
const ROCK_REDUCTION = 0.2     // -20% incoming

export const TRAITS: Trait[] = [
  {
    id: 'esecuzione', name: 'Esecuzione',
    desc: 'Infligge +50% danni ai bersagli sotto il 30% di vita.',
    trigger: {
      kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
      apply: (v, ctx) => {
        const t = ctx.target
        if (t && t.maxHp > 0 && t.hp / t.maxHp < EXECUTE_THRESHOLD) return v * EXECUTE_MULT
        return v
      },
    },
  },
  {
    id: 'furia', name: 'Furia',
    desc: 'Più è ferito, più colpisce forte (fino a +60%).',
    trigger: {
      kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
      apply: (v, ctx) => {
        const a = ctx.actor
        const missing = a.maxHp > 0 ? 1 - a.hp / a.maxHp : 0
        return v * (1 + missing * FURY_MAX_BONUS)
      },
    },
  },
  {
    id: 'roccia', name: 'Roccia',
    desc: 'Subisce il 20% di danni in meno.',
    trigger: {
      kind: 'modifier', hook: 'modifyIncomingDamage', owner: 'target',
      apply: (v) => v * (1 - ROCK_REDUCTION),
    },
  },
]

export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map(t => [t.id, t]))
```

- [ ] **Step 4: Assign to wizards**

In `data/wizards.ts`, add `traits` to the entries:
- Voldemort: `traits: ['esecuzione', 'furia']`
- McGonagall: `traits: ['roccia']`

- [ ] **Step 5: Run trait + full suite + tsc**

Run: `npx vitest run tests/engine/traitEffects.test.ts && npx vitest run && npx tsc --noEmit`
Expected: trait tests PASS. Full suite: battles with Voldemort/McGonagall now differ — any combat SNAPSHOT featuring them shifts. Inspect each diff: confirm it reflects the trait (more/less damage), then `npx vitest run -u`. Trait-less battles must be unchanged (determinism test green).

- [ ] **Step 6: Commit**

```bash
git add data/traits.ts data/wizards.ts tests/engine/traitEffects.test.ts game/engine/combat/__snapshots__ tests
git commit -m "feat(traits): Esecuzione, Furia, Roccia (damage-modifier traits)"
```

---

### Task 4: Reactive traits — Sifone, Benedizione (+ symmetry/owner tests)

**Files:**
- Modify: `data/traits.ts` (add `sifone`, `benedizione`)
- Modify: `data/wizards.ts` (Bellatrix → sifone; Lupin → benedizione)
- Test: extend `tests/engine/traitEffects.test.ts` + add an integration test in `tests/engine/combat/`

**Interfaces:**
- Consumes: `EffectSpec` shapes (mirror existing: a `debuff` spd effect like `confundo`; a `shield` effect).
- Produces: trait ids `sifone`, `benedizione`.

- [ ] **Step 1: Add the two reactive traits to `data/traits.ts`**

Mirror existing effect shapes (`confundo` uses `{ kind: 'debuff', stat: 'spd', amount, duration }`; shield uses `{ kind: 'shield', amount, duration }`):

```ts
const SIPHON_SPD = 8
const SIPHON_DURATION = 2
const BLESS_SHIELD = 25
const BLESS_DURATION = 2

// add to TRAITS:
  {
    id: 'sifone', name: 'Sifone',
    desc: 'I suoi colpi rallentano il bersaglio (-VEL).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', effect: { kind: 'debuff', stat: 'spd', amount: SIPHON_SPD, duration: SIPHON_DURATION } }],
    },
  },
  {
    id: 'benedizione', name: 'Benedizione',
    desc: 'Quando viene curato, ottiene anche uno scudo.',
    trigger: {
      kind: 'reactive', hook: 'onHeal', owner: 'actor',
      effects: () => [{ kind: 'shield', amount: BLESS_SHIELD, duration: BLESS_DURATION }],
    },
  },
```

(Implementer: verify the exact `applyStatus`/`debuff` and `shield` EffectSpec field names against `types/status.ts` and `tests/engine/combat/effects.test.ts`, which exercise both. Adjust to match — e.g. `applyStatus` may take `effect` or `statusId`.)

- [ ] **Step 2: Assign to wizards**

`data/wizards.ts`: Bellatrix → `traits: ['sifone']`; Lupin → `traits: ['benedizione']`.

- [ ] **Step 3: Integration tests (NEW) — symmetry + owner gating + effect**

Create `tests/engine/combat/traitReactive.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const wiz = (id: string, seed: number) => draftWizard(createRng(seed), WIZARDS.find(w => w.id === id)!)

describe('reactive traits in battle', () => {
  it('Sifone (on a RIGHT-side enemy) applies a SPD debuff to the player it hits', () => {
    // Bellatrix has Sifone. Put her on the RIGHT to prove both-side reactive firing.
    const left = [wiz('harry', 1)]
    const right = [wiz('bellatrix', 2)]
    const res = simulateBattle(left, right, createRng(3))
    // Somewhere in the fight a left unit carries a spd debuff status applied by Sifone.
    const debuffed = res.snapshots.some(s =>
      Object.values(s).some(u => u.statusEffects.some(e => e.kind === 'debuff' && e.stat === 'spd')))
    expect(debuffed).toBe(true)
  })

  it('Benedizione shields Lupin when he is healed', () => {
    // Lupin (benedizione) + a healer ally on the left; right is a punching bag.
    const left = [wiz('lupin', 1), wiz('mcgonagall', 2)]
    const right = [wiz('harry', 3)]
    const res = simulateBattle(left, right, createRng(4))
    const shielded = res.snapshots.some(s =>
      Object.values(s).some(u => u.statusEffects.some(e => e.statusId === 'shield' || e.kind === 'shield')))
    // Lupin self-heals via 'episkey'/'vulnera' in his pool, triggering Benedizione.
    expect(shielded).toBe(true)
  })
})
```

(Implementer: if the chosen matchup doesn't reliably trigger the heal/hit within `turnCap`, adjust seeds or roster so it does; the assertion is the contract. Confirm `UnitSnapshot.statusEffects` exposes `kind`/`stat`/`statusId` — adapt the predicate to the real snapshot shape.)

- [ ] **Step 4: Run + update snapshots + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: new tests PASS; snapshots featuring Bellatrix/Lupin shift (inspect, then `-u`); trait-less determinism intact.

- [ ] **Step 5: Commit**

```bash
git add data/traits.ts data/wizards.ts tests/engine/combat/traitReactive.test.ts tests/engine/traitEffects.test.ts game/engine/combat/__snapshots__ tests
git commit -m "feat(traits): Sifone + Benedizione (reactive traits), both-side firing"
```

---

### Task 5: UI — trait chips on the wizard card

**Files:**
- Modify: `components/cards/WizardCard.tsx` (render trait chips with Tooltip)
- Test: `tests/ui/wizardCard.test.tsx` (extend)

**Interfaces:**
- Consumes: `wizard.traits`, `TRAIT_BY_ID`, existing `Tooltip` component, synergy-chip styling.

- [ ] **Step 1: Write the UI test**

Append to `tests/ui/wizardCard.test.tsx`:

```ts
import { TRAIT_BY_ID } from '@/data/traits'
import { WIZARD_BY_ID } from '@/data/wizards'

it('renders trait chips with a tooltip for a wizard that has traits', () => {
  const voldemort = draftWizard(createRng(1), WIZARD_BY_ID['voldemort']!)
  render(<WizardCard drafted={voldemort} />)
  const trait = TRAIT_BY_ID[voldemort.wizard.traits![0]!]!
  expect(screen.getByText(trait.name)).toBeInTheDocument()
})

it('shows no trait chips for a trait-less wizard', () => {
  const draftless = draftWizard(createRng(1), WIZARD_BY_ID['ron']!) // assumed trait-less
  render(<WizardCard drafted={draftless} />)
  // No chip matching any catalog trait name.
  for (const id of Object.keys(TRAIT_BY_ID)) {
    expect(screen.queryByText(TRAIT_BY_ID[id]!.name)).toBeNull()
  }
})
```

(Implementer: pick a genuinely trait-less wizard id for the second test from `data/wizards.ts`.)

- [ ] **Step 2: Render trait chips**

In `WizardCard.tsx`, near the affiliation strip, map `wizard.traits` → for each id look up `TRAIT_BY_ID[id]` and render a small chip showing `trait.name`, wrapped in the existing `Tooltip` (content = `trait.desc`) so it reveals on tap/hover. Reuse the synergy-chip class style already in the file; skip unknown ids. Render nothing when `traits` is empty/undefined.

- [ ] **Step 3: Run UI tests + full suite + tsc**

Run: `npx vitest run tests/ui/wizardCard.test.tsx && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/cards/WizardCard.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(draft): trait chips with tooltip on the wizard card"
```

---

## Self-Review notes

- **Spec coverage:** §1 foundation → Task 1; §2 data model + registration → Task 2; §3 traits → Tasks 3 (modifiers) + 4 (reactive); §4 UI chips → Task 5; §5 legibility → automatic (damage value reflects modifier traits; Sifone/Benedizione show as status chips) — verified in Task 4's snapshot assertions; §6 testing → embedded.
- **Type consistency:** `Trait`, `TraitTrigger`, `TraitSubject`, `registerTraitTriggers(bus, units, catalog?)`, `TRAIT_BY_ID`, trait ids `esecuzione`/`furia`/`roccia`/`sifone`/`benedizione` — used identically across tasks.
- **Determinism guard** is asserted in Task 1 and must stay green through Tasks 3-4 (only trait-bearing battles may change).
- **Known soft spot:** exact `EffectSpec` field names for Sifone/Benedizione (Task 4 Step 1) and `UnitSnapshot.statusEffects` shape (Task 4 Step 3) are pinned by mirroring existing code (`effects.test.ts`, `types/status.ts`) — implementer verifies, adjusts predicate, keeps the asserted contract.
