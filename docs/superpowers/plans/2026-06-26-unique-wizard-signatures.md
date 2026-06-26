# Unique Wizard Signatures — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every one of the 60 wizards a fixed, unique, always-on passive "signature" ability, scaled by tier, shown on the draft card.

**Architecture:** A `Signature` is a 1:1-per-wizard bundle of `TraitTrigger`s (the exact shape traits already use). A new `registerSignatures(bus, units)` mirrors `registerTraitTriggers`, looking each unit's signature up by `wizard.id` and wiring its triggers onto the same EventBus. It runs for ALL units (player + enemy), so enemies get their signatures for free. No new hooks, no new effect primitives, no combat-loop changes.

**Tech Stack:** TypeScript, Vitest, Next.js (App Router), framer-motion. Combat is the deterministic EventBus simulator in `game/engine/combat/`.

## Global Constraints

- **This is NOT the Next.js you know** (per AGENTS.md): for any UI/framework code, read the relevant guide in `node_modules/next/dist/docs/` before writing it. The UI task here only edits an existing client component, but heed deprecation notices.
- **Determinism is sacred:** a hook with zero listeners must draw NO rng. The EventBus already guarantees this (`collectReactive(...).length === 0` short-circuits in `simulate.ts`'s `fireReactive`, and `emitModifier` is a no-op with no listeners). Reactive `effects()` that return `[]` when a condition is unmet therefore cost no rng. Never read rng inside a trigger closure — `HookCtx` has no rng by design.
- **`onHpThreshold` is OFF-LIMITS for signatures.** The engine only fires it for thresholds registered by *relics* (`registeredThresholds` in `simulate.ts`), and the reactive trigger carries no threshold value. "When wounded" effects MUST use `onTurnStart` with an internal HP-fraction gate on `ctx.actor`.
- **Reuse existing primitives.** Statuses available in `data/statuses.ts`: `stun, freeze, silence, disarm, burn, regen, shield, atkUp, defUp, slow, weaken1/2/3, expose1/2/3, slow1/2/3`. Effect kinds: `damage, heal, shield, applyStatus` (with `statusId` OR inline `effect`).
- **Spec:** `docs/superpowers/specs/2026-06-26-unique-wizard-signatures-design.md` (catalog of all 60 is section 5; budget table is section 3).
- **Run tests from repo root** (`C:/Users/Francesco/Desktop/wa/harry-draft`) with `npx vitest run <path>`. Typecheck with `npx tsc --noEmit`.

---

## File Structure

- Create `types/signature.ts` — the `Signature` interface.
- Modify `types/index.ts` — re-export `Signature`.
- Create `game/engine/signatures.ts` — `registerSignatures(bus, units, catalog?)`.
- Modify `game/engine/combat/simulate.ts` — one call site after `registerTraitTriggers`.
- Create `data/signatures.ts` — budget constants, trigger builders, the 60-entry catalog, `SIGNATURE_BY_ID`.
- Create `tests/engine/signatures.test.ts` — engine behavior + data-integrity tests.
- Modify `components/cards/WizardCardRow.tsx` — render the signature chip + tooltip.
- Modify `tests/...` fixtures as needed — regenerate seed-dependent snapshots (Task 4).
- Possibly modify `data/constants.ts` — recalibrate menace/relic if the band drifts (Task 4).

---

## Task 1: Signature type + engine + wiring

**Files:**
- Create: `types/signature.ts`
- Modify: `types/index.ts`
- Create: `game/engine/signatures.ts`
- Modify: `game/engine/combat/simulate.ts:90` (after `registerTraitTriggers`)
- Test: `tests/engine/signatures.test.ts`

**Interfaces:**
- Consumes: `TraitTrigger`, `BattleUnit` (`@/types`), `EventBus` (`./combat/eventBus`).
- Produces:
  - `interface Signature { id: string; name: string; desc: string; triggers: TraitTrigger[] }`
  - `function registerSignatures(bus: EventBus, units: BattleUnit[], catalog?: Record<string, Signature>): void`

- [ ] **Step 1: Write the `Signature` type**

Create `types/signature.ts`:

```ts
import type { TraitTrigger } from './trait'

/** A fixed, unique ability bound 1:1 to a wizard by id. Reuses the trait trigger
 *  shape; tier-1 legends carry 2 triggers, everyone else 1. */
export interface Signature {
  id: string        // === wizard.id
  name: string
  desc: string
  triggers: TraitTrigger[]
}
```

- [ ] **Step 2: Re-export from the type barrel**

In `types/index.ts`, add alongside the other exports (match the existing `export * from './trait'` style):

```ts
export * from './signature'
```

Run `npx tsc --noEmit` — expect PASS (type only, no consumers yet).

- [ ] **Step 3: Write the failing engine test**

Create `tests/engine/signatures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { BattleUnit, Signature, Wizard } from '@/types'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerSignatures } from '@/game/engine/signatures'

function unit(id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3, ranges: { hp: [1, 1], atk: [1, 1], def: [1, 1], spd: [1, 1] }, spellPool: [] } as Wizard
  const stats = { hp: 100, atk: 20, def: 10, spd: 20 }
  return {
    wizard, stats, maxHp: 100, spell: { id: 's', name: 's', desc: '', type: 'Attacco', hitChance: 1 },
    side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over,
  }
}

describe('registerSignatures', () => {
  it('applies a modifier only to the owning unit', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const other = unit('b')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [{ kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v * 2 }] },
    }
    registerSignatures(bus, [owner, other], catalog)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: owner, side: 'left', flags: [] })).toBe(20)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: other, side: 'left', flags: [] })).toBe(10)
  })

  it('collects reactive effects only for the owning unit', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const other = unit('b')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [{ kind: 'reactive', hook: 'onTurnStart', owner: 'actor', effects: () => [{ kind: 'shield', amount: 5 }] }] },
    }
    registerSignatures(bus, [owner, other], catalog)
    expect(bus.collectReactive('onTurnStart', { turn: 1, actor: owner, side: 'left', flags: [] })).toHaveLength(1)
    expect(bus.collectReactive('onTurnStart', { turn: 1, actor: other, side: 'left', flags: [] })).toHaveLength(0)
  })

  it('registers every trigger of a multi-trigger signature', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [
        { kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v + 1 },
        { kind: 'reactive', hook: 'onHit', owner: 'actor', effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'stun' }] },
      ] },
    }
    registerSignatures(bus, [owner], catalog)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: owner, side: 'left', flags: [] })).toBe(11)
    expect(bus.collectReactive('onHit', { turn: 1, actor: owner, target: owner, side: 'left', flags: [] })).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/engine/signatures.test.ts`
Expected: FAIL — `Cannot find module '@/game/engine/signatures'`.

- [ ] **Step 5: Implement `registerSignatures`**

Create `game/engine/signatures.ts` (mirrors `game/engine/traits.ts`, but keyed by `wizard.id` and iterating `triggers`):

```ts
import type { BattleUnit, Signature } from '@/types'
import type { EventBus } from './combat/eventBus'
import { SIGNATURE_BY_ID } from '@/data/signatures'

export function registerSignatures(
  bus: EventBus, units: BattleUnit[], catalog: Record<string, Signature> = SIGNATURE_BY_ID,
): void {
  for (const u of units) {
    const sig = catalog[u.wizard.id]
    if (!sig) continue
    for (const t of sig.triggers) {
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

> NOTE: This imports `SIGNATURE_BY_ID` from `@/data/signatures`, created in Task 2. To keep Task 1 independently runnable, create a **temporary stub** now and replace it in Task 2:
> Create `data/signatures.ts` with just:
> ```ts
> import type { Signature } from '@/types'
> export const SIGNATURES: Signature[] = []
> export const SIGNATURE_BY_ID: Record<string, Signature> = {}
> ```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/engine/signatures.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Wire into the simulator**

In `game/engine/combat/simulate.ts`, add the import near the other engine imports (line ~8):

```ts
import { registerSignatures } from '../signatures'
```

And immediately after `registerTraitTriggers(bus, [...L, ...R])` (line ~90):

```ts
registerSignatures(bus, [...L, ...R])
```

- [ ] **Step 8: Typecheck + full suite (expect known fixture failures only)**

Run: `npx tsc --noEmit` → expect PASS.
Run: `npx vitest run tests/engine/signatures.test.ts` → expect PASS.
(The empty catalog means no behavior change yet; the broader suite stays green. Seed fixtures shift only once real signatures exist — handled in Task 4.)

- [ ] **Step 9: Commit**

```bash
git add types/signature.ts types/index.ts game/engine/signatures.ts game/engine/combat/simulate.ts data/signatures.ts tests/engine/signatures.test.ts
git commit -m "feat(engine): signature ability system (type, registrar, wiring)"
```

---

## Task 2: Full 60-signature catalog + data integrity

**Files:**
- Modify (replace stub): `data/signatures.ts`
- Test: `tests/engine/signatures.test.ts` (append integrity tests)

**Interfaces:**
- Consumes: `Signature`, `TraitTrigger`, `EffectSpec`, `Stat`, `HookCtx` (`@/types`); `WIZARDS` (`@/data/wizards`); `STATUS_BY_ID` (`@/data/statuses`).
- Produces: `SIGNATURES: Signature[]` (60 entries) and `SIGNATURE_BY_ID: Record<string, Signature>`.

- [ ] **Step 1: Write the failing integrity tests**

Append to `tests/engine/signatures.test.ts`:

```ts
import { SIGNATURES, SIGNATURE_BY_ID } from '@/data/signatures'
import { WIZARDS } from '@/data/wizards'
import { STATUS_BY_ID } from '@/data/statuses'
import type { HookCtx } from '@/types'

describe('signature catalog integrity', () => {
  it('has exactly one signature per wizard, ids matching', () => {
    expect(SIGNATURES).toHaveLength(WIZARDS.length)
    for (const w of WIZARDS) expect(SIGNATURE_BY_ID[w.id], `missing signature for ${w.id}`).toBeDefined()
    for (const s of SIGNATURES) expect(WIZARDS.some(w => w.id === s.id), `orphan signature ${s.id}`).toBe(true)
  })

  it('tier-1 signatures carry 2 triggers; everyone has at least 1', () => {
    for (const w of WIZARDS) {
      const sig = SIGNATURE_BY_ID[w.id]!
      expect(sig.triggers.length, `${w.id} trigger count`).toBeGreaterThanOrEqual(1)
      if (w.tier === 1) expect(sig.triggers.length, `${w.id} is tier 1`).toBe(2)
    }
  })

  it('every referenced statusId exists and no trigger throws', () => {
    // Stub a wounded actor vs a low-HP target so wounded/execute branches run.
    const mk = (id: string) => ({
      wizard: WIZARDS[0], stats: { hp: 100, atk: 20, def: 10, spd: 20 }, maxHp: 100,
      spell: { id, name: id, desc: '', type: 'Attacco', hitChance: 1 },
      side: 'left', hp: 5, cooldowns: {}, statusEffects: [], buffedStats: { hp: 100, atk: 20, def: 10, spd: 30 }, alive: true,
    }) as any
    const actor = mk('a'); const target = mk('b'); target.buffedStats.spd = 5
    const ctx: HookCtx = { turn: 1, actor, target, side: 'left', flags: [] }
    for (const sig of SIGNATURES) {
      for (const t of sig.triggers) {
        if (t.kind === 'modifier') {
          expect(() => t.apply(10, ctx), `${sig.id} modifier throws`).not.toThrow()
        } else {
          const effs = t.effects(ctx)
          for (const e of effs) {
            if (e.kind === 'applyStatus' && e.statusId) {
              expect(STATUS_BY_ID[e.statusId], `${sig.id} → unknown status ${e.statusId}`).toBeDefined()
            }
          }
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/signatures.test.ts`
Expected: FAIL — `expect(SIGNATURES).toHaveLength(60)` gets 0 (stub is empty).

- [ ] **Step 3: Replace `data/signatures.ts` with builders + full catalog**

Overwrite `data/signatures.ts` entirely:

```ts
import type { EffectSpec, HookCtx, Signature, Stat, TraitTrigger } from '@/types'

// ─── Budget constants (single tuning surface; see spec §3) ───────────────────
// Tier 1 (legends)
const T1_DMG = 0.30          // dumbledore flat OD
const T1_EXEC = 0.50         // voldemort OD vs sub-threshold
const T1_EXEC_HP = 0.40
const T1_FURY = 0.70         // harry OD scaling
const T1_STUN = 0.40         // dumbledore onHit stun chance
const T1_FEAR = 0.35         // voldemort onHit weaken3 chance
const T1_WOUND_HP = 0.50     // harry regen-when-wounded gate
// Tier 2
const T2_DMG = 0.30
const T2_EXEC = 0.45
const T2_EXEC_HP = 0.35
const T2_ID = 0.30           // mcgonagall soak
const T2_PROC = 0.40
const T2_BURN = 0.55
const T2_EXPOSE = 0.35
const T2_BUFF_ATK = 22
const T2_WOUND_ATK = 25
const T2_WOUND_HP = 0.50
// Tier 3
const T3_DMG = 0.18
const T3_EXEC = 0.20
const T3_EXEC_HP = 0.50
const T3_ID = 0.16
const T3_PROC = 0.30
const T3_FREEZE = 0.25
const T3_BURN = 0.40
const T3_COMBO = 0.35
const T3_HEAL = 0.20
const T3_BUFF = 12
const T3_AD_ATK = 18
const T3_SHIELD = 30
const T3_WOUND_HP = 0.40
// Tier 4
const T4_DMG = 0.10
const T4_EXEC = 0.20
const T4_ID = 0.10
const T4_PROC = 0.18
const T4_BUFF = 5
const T4_AD_ATK = 6
const T4_SHIELD = 18
const T4_WOUND_SPD = 6
const T4_WOUND_HP = 0.35

// ─── Trigger builders ────────────────────────────────────────────────────────
const od = (pct: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v * (1 + pct),
})
const odExecute = (pct: number, hpFrac: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
  apply: (v, ctx) => {
    const t = ctx.target
    return t && t.maxHp > 0 && t.hp / t.maxHp < hpFrac ? v * (1 + pct) : v
  },
})
const odFury = (maxBonus: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
  apply: (v, ctx) => {
    const a = ctx.actor
    const missing = a.maxHp > 0 ? 1 - a.hp / a.maxHp : 0
    return v * (1 + missing * maxBonus)
  },
})
const odIfFaster = (pct: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
  apply: (v, ctx) => (ctx.target && ctx.actor.buffedStats.spd > ctx.target.buffedStats.spd ? v * (1 + pct) : v),
})
const idReduce = (pct: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyIncomingDamage', owner: 'target', apply: (v) => v * (1 - pct),
})
const healMod = (pct: number): TraitTrigger => ({
  // owner 'actor' → boosts heals the owner CASTS (heal handler emits modifyHealing with actor=healer).
  kind: 'modifier', hook: 'modifyHealing', owner: 'actor', apply: (v) => v * (1 + pct),
})
const hitStatus = (statusId: string, chance: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'enemy', statusId, chance, duration }],
})
const hitStatuses = (list: Array<{ statusId: string; chance: number; duration?: number }>): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => list.map(s => ({ kind: 'applyStatus', target: 'enemy', statusId: s.statusId, chance: s.chance, duration: s.duration })),
})
const hitSelfStatus = (statusId: string, chance: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', statusId, chance, duration }],
})
const tsSelfStatus = (statusId: string, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', statusId, duration }],
})
const tsSelfBuff = (stat: Stat, amount: number, duration: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount, duration } }],
})
const tsWoundedSelfStatus = (statusId: string, hpFrac: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (ctx: HookCtx): EffectSpec[] => {
    const a = ctx.actor
    return a.maxHp > 0 && a.hp / a.maxHp < hpFrac ? [{ kind: 'applyStatus', target: 'self', statusId, duration }] : []
  },
})
const tsWoundedSelfBuff = (stat: Stat, amount: number, duration: number, hpFrac: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (ctx: HookCtx): EffectSpec[] => {
    const a = ctx.actor
    return a.maxHp > 0 && a.hp / a.maxHp < hpFrac ? [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount, duration } }] : []
  },
})
const adBuff = (stat: Stat, amount: number, duration: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onAllyDeath', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount, duration } }],
})
const healShield = (amount: number, duration: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHeal', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'shield', amount, duration }],
})

const sig = (id: string, name: string, desc: string, ...triggers: TraitTrigger[]): Signature => ({ id, name, desc, triggers })

// ─── Catalog (60) ─────────────────────────────────────────────────────────────
export const SIGNATURES: Signature[] = [
  // Tier 1 — 2 triggers each
  sig('dumbledore', 'Bacchetta di Sambuco', 'Infligge +30% danni e i suoi colpi possono stordire.', od(T1_DMG), hitStatus('stun', T1_STUN, 1)),
  sig('voldemort', 'Terrore Immortale', 'Devasta i bersagli morenti (+50% sotto il 40% HP) e i suoi colpi seminano terrore (-ATT).', odExecute(T1_EXEC, T1_EXEC_HP), hitStatus('weaken3', T1_FEAR, 2)),
  sig('harry', 'Coraggio del Grifondoro', 'Più è ferito più colpisce forte (fino a +70%); sotto metà vita l’amore lo rigenera.', odFury(T1_FURY), tsWoundedSelfStatus('regen', T1_WOUND_HP, 3)),

  // Tier 2
  sig('snape', 'Pozioni Letali', 'I suoi colpi avvelenano e possono esporre la difesa del bersaglio.', hitStatuses([{ statusId: 'burn', chance: T2_BURN, duration: 2 }, { statusId: 'expose2', chance: T2_EXPOSE, duration: 2 }])),
  sig('bellatrix', 'Tortura Cruciatus', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T2_PROC, 1)),
  sig('mcgonagall', 'Trasfigurazione Marziale', 'Subisce il 30% di danni in meno.', idReduce(T2_ID)),
  sig('sirius', 'Lealtà Feroce', 'Mettendo a segno un colpo può rinforzare il proprio attacco.', hitSelfStatus('atkUp', T2_PROC, 2)),
  sig('lupin', 'Furia Lupesca', 'Sotto metà vita la bestia si scatena: +ATT a ogni turno.', tsWoundedSelfBuff('atk', T2_WOUND_ATK, 2, T2_WOUND_HP)),
  sig('moody', 'Vigilanza Costante', 'Subisce -22% danni e mantiene sempre la guardia alta (+DIF).', idReduce(0.22), tsSelfStatus('defUp', 1)),
  sig('lucius', 'Esecutore Spietato', 'Infligge +45% danni ai bersagli sotto il 35% di vita.', odExecute(T2_EXEC, T2_EXEC_HP)),
  sig('kingsley', 'Pugno dell’Auror', 'I suoi colpi possono rallentare pesantemente il bersaglio.', hitStatus('slow2', T2_PROC, 2)),
  sig('fleur', 'Fascino Veela', 'I suoi colpi possono disarmare il bersaglio incantato.', hitStatus('disarm', T2_PROC, 2)),
  sig('viktor', 'Tuffo del Cercatore', 'Infligge +30% danni quando è più veloce del bersaglio.', odIfFaster(T2_DMG)),

  // Tier 3
  sig('hermione', 'Mente Brillante', 'I suoi colpi possono silenziare il bersaglio.', hitStatus('silence', T3_PROC, 2)),
  sig('ron', 'Mossa del Cavaliere', 'Subisce -16% danni.', idReduce(T3_ID)),
  sig('draco', 'Tocco Velenoso', 'I suoi colpi possono avvelenare il bersaglio.', hitStatus('burn', T3_BURN, 2)),
  sig('ginny', 'Maleficio Pipistrello', 'I suoi colpi possono indebolire l’attacco del bersaglio.', hitStatus('weaken2', T3_PROC, 2)),
  sig('neville', 'Coraggio Tardivo', 'Quando un alleato cade, si infuria (+ATT).', adBuff('atk', T3_AD_ATK, 3)),
  sig('luna', 'Serenità', 'Si rigenera vita a ogni turno.', tsSelfStatus('regen', 3)),
  sig('fred', 'Caos Gemello', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T3_PROC, 1)),
  sig('george', 'Sorpresa Esplosiva', 'Infligge +18% danni.', od(T3_DMG)),
  sig('molly', 'Istinto Materno', 'Quando viene curata ottiene anche uno scudo.', healShield(T3_SHIELD, 2)),
  sig('arthur', 'Tocco Premuroso', 'Le sue cure sono più efficaci (+20%).', healMod(T3_HEAL)),
  sig('tonks', 'Riflessi Mutanti', 'A inizio turno guadagna velocità.', tsSelfBuff('spd', 10, 1)),
  sig('narcissa', 'Patto Materno', 'Sotto il 40% di vita si rigenera.', tsWoundedSelfStatus('regen', T3_WOUND_HP, 3)),
  sig('dolohov', 'Maledizione Viola', 'I suoi colpi possono avvelenare e rallentare.', hitStatuses([{ statusId: 'burn', chance: T3_COMBO, duration: 2 }, { statusId: 'slow1', chance: T3_COMBO, duration: 2 }])),
  sig('greyback', 'Morso Selvaggio', 'Infligge +20% danni ai bersagli sotto metà vita.', odExecute(T3_EXEC, T3_EXEC_HP)),
  sig('cho', 'Lacrime Gelide', 'I suoi colpi possono congelare il bersaglio.', hitStatus('freeze', T3_FREEZE, 2)),
  sig('cedric', 'Gioco Leale', 'Mettendo a segno un colpo può rinforzare il proprio attacco.', hitSelfStatus('atkUp', T3_PROC, 2)),
  sig('slughorn', 'Favori Utili', 'Le sue cure sono più efficaci (+20%).', healMod(T3_HEAL)),
  sig('hagrid', 'Forza del Gigante', 'Colpi pesanti: infligge +18% danni.', od(T3_DMG)),
  sig('flitwick', 'Maestro di Incantesimi', 'I suoi colpi possono silenziare il bersaglio.', hitStatus('silence', T3_PROC, 2)),
  sig('sprout', 'Mandragole', 'Si rigenera vita a ogni turno.', tsSelfStatus('regen', 3)),

  // Tier 4
  sig('seamus', 'Tendenza Esplosiva', 'I suoi colpi possono incendiare il bersaglio.', hitStatus('burn', T4_PROC, 2)),
  sig('dean', 'Mano Ferma', 'Infligge +10% danni.', od(T4_DMG)),
  sig('parvati', 'Divinazione', 'I suoi colpi possono indebolire il bersaglio.', hitStatus('weaken1', T4_PROC, 2)),
  sig('lavender', 'Devozione', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('pansy', 'Lingua Tagliente', 'I suoi colpi possono silenziare il bersaglio.', hitStatus('silence', T4_PROC, 2)),
  sig('goyle', 'Stazza', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('crabbe', 'Stazza', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('marcus', 'Gioco Duro', 'Più è ferito più colpisce forte (fino a +20%).', odFury(T4_EXEC)),
  sig('pettigrew', 'Codardia Vigile', 'Sotto il 35% di vita scatta più veloce.', tsWoundedSelfBuff('spd', T4_WOUND_SPD, 2, T4_WOUND_HP)),
  sig('padma', 'Studio Attento', 'I suoi colpi possono disarmare il bersaglio.', hitStatus('disarm', T4_PROC, 2)),
  sig('terry', 'Concentrazione', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T4_PROC, 1)),
  sig('michael', 'Slancio', 'Infligge +10% danni.', od(T4_DMG)),
  sig('roger', 'Resistenza', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('marietta', 'Cautela', 'A inizio turno rinforza la difesa.', tsSelfBuff('def', T4_BUFF, 1)),
  sig('anthony', 'Disciplina', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('hannah', 'Gentilezza', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('susan', 'Memoria di Famiglia', 'Si rigenera vita a ogni turno.', tsSelfStatus('regen', 3)),
  sig('ernie', 'Orgoglio Tassorosso', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('justin', 'Determinazione', 'Infligge +10% danni.', od(T4_DMG)),
  sig('zacharias', 'Spavalderia', 'I suoi colpi possono indebolire il bersaglio.', hitStatus('weaken1', T4_PROC, 2)),
  sig('leanne', 'Lealtà', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('eloise', 'Caparbietà', 'Quando un alleato cade, si infuria (+ATT).', adBuff('atk', T4_AD_ATK, 2)),
  sig('theodore', 'Calcolo Freddo', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T4_PROC, 1)),
  sig('blaise', 'Eleganza Tagliente', 'I suoi colpi possono incendiare il bersaglio.', hitStatus('burn', T4_PROC, 2)),
  sig('astoria', 'Grazia', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('penelope', 'Prefetto Diligente', 'A inizio turno rinforza la difesa.', tsSelfBuff('def', T4_BUFF, 1)),
  sig('megan', 'Discrezione', 'I suoi colpi possono rallentare il bersaglio.', hitStatus('slow1', T4_PROC, 2)),
]

export const SIGNATURE_BY_ID: Record<string, Signature> = Object.fromEntries(
  SIGNATURES.map(s => [s.id, s]),
)
```

- [ ] **Step 4: Run integrity + engine tests**

Run: `npx vitest run tests/engine/signatures.test.ts`
Expected: PASS (3 engine + 3 integrity tests). If "missing signature for X" — a wizard id is absent; if "unknown status X" — a `statusId` typo. Fix and re-run.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If a builder's inline `effect`/`applyStatus` literal mismatches `EffectSpec`, the `: EffectSpec[]` return annotations will surface it here.)

- [ ] **Step 6: Commit**

```bash
git add data/signatures.ts tests/engine/signatures.test.ts
git commit -m "feat(data): author 60 unique wizard signatures with tier budgets"
```

---

## Task 3: Show the signature on the draft card

**Files:**
- Modify: `components/cards/WizardCardRow.tsx`
- Test: `tests/components/WizardCardRow.signature.test.tsx` (create)

**Interfaces:**
- Consumes: `SIGNATURE_BY_ID` (`@/data/signatures`), existing `Tooltip` component.
- Produces: a labelled "Abilità" row with the signature name + tooltip showing its `desc`.

- [ ] **Step 1: Write the failing component test**

Create `tests/components/WizardCardRow.signature.test.tsx`. First check an existing component test (e.g. under `tests/components/`) for the render setup (jsdom, how a `DraftedWizard` is built) and mirror it. Minimal target:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SIGNATURE_BY_ID } from '@/data/signatures'
import { SPELL_BY_ID } from '@/data/spells'

function drafted(id: string) {
  const wizard = WIZARD_BY_ID[id]!
  const spell = SPELL_BY_ID[wizard.spellPool[0]!]!
  return { wizard, stats: { hp: 100, atk: 20, def: 10, spd: 20 }, maxHp: 100, spell }
}

describe('WizardCardRow signature', () => {
  it('renders the wizard signature name', () => {
    render(<WizardCardRow drafted={drafted('dumbledore')} />)
    expect(screen.getByText(SIGNATURE_BY_ID['dumbledore']!.name)).toBeInTheDocument()
  })
})
```

> Verify `SPELL_BY_ID` is the correct export name in `data/spells.ts`; if it differs (e.g. `SPELLS_BY_ID`), use the real one. If existing component tests use a shared `makeDrafted` helper, prefer it over the inline builder.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/WizardCardRow.signature.test.tsx`
Expected: FAIL — signature name not in document.

- [ ] **Step 3: Render the signature row**

In `components/cards/WizardCardRow.tsx`:

1. Add the import near the `TRAIT_BY_ID` import (line ~14):

```tsx
import { SIGNATURE_BY_ID } from '@/data/signatures'
```

2. After the `traitChips` computation (line ~57-59), add:

```tsx
const signature = SIGNATURE_BY_ID[wizard.id]
```

3. Insert a new block **above** the Traits block (the signature is the headline ability; line ~138, before `{traitChips.length > 0 && (`):

```tsx
{signature && (
  <div className="flex flex-wrap items-center gap-1">
    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-300/60">Abilità</span>
    <Tooltip content={signature.desc}>
      <span
        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ color: '#f3e0b0', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(120,90,40,0.28)' }}
      >
        <span aria-hidden className="text-amber-300">★</span>
        {signature.name}
      </span>
    </Tooltip>
  </div>
)}
```

(Amber/gold marks the signature as unique, distinct from the blue trait chips and gold round synergy chips. The `★` glyph differs from the traits' `✦`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/WizardCardRow.signature.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint the component**

Run: `npx tsc --noEmit` → expect PASS.

- [ ] **Step 6: Commit**

```bash
git add components/cards/WizardCardRow.tsx tests/components/WizardCardRow.signature.test.tsx
git commit -m "feat(ui): show unique signature ability on the draft card"
```

---

## Task 4: Rebalance + refresh fixtures

Adding signatures to both teams raises the absolute power floor and shifts the rng stream in any battle where a signature fires. This task restores the brutal-difficulty band and regenerates deterministic fixtures.

**Files:**
- Modify (if needed): `data/signatures.ts` (budget constants) and/or `data/constants.ts` (menace/relic).
- Modify: any seed-dependent fixture/snapshot tests that now fail.
- Test: `tests/engine/campaignBalance.test.ts`, `tests/engine/balance.test.ts`, full suite.

**Interfaces:**
- Consumes: the campaign harness in `tests/engine/campaignBalance.test.ts` (targets: `clearRate` ∈ (0.08, 0.18), `firstStageWinRate` > 0.65, `bossWinRate` ∈ (0, 0.30), `cappedRate` < 0.05).

- [ ] **Step 1: Establish the new baseline**

Run: `npx vitest run tests/engine/campaignBalance.test.ts tests/engine/balance.test.ts`
Record which assertions fail and by how much (the test prints the rates indirectly; if not, temporarily `console.log(stats)` in the harness — revert before committing).

- [ ] **Step 2: Inventory the broken fixtures**

Run the full suite to see every seed-dependent failure:

Run: `npx vitest run`
Expected: signatures + integrity + UI PASS; some battle-log/replay/snapshot fixtures FAIL due to rng-stream shift (same class as commit `e4aa093 "refresh seed-dependent fixtures after enemy empowerment"`).

- [ ] **Step 3: Recalibrate to the band (only if Step 1 failed)**

If `clearRate` is too **high** (player too strong) or `firstStageWinRate`/`bossWinRate` drift out of band, adjust in this order (smallest blast radius first):
1. Trim signature budget constants in `data/signatures.ts` (e.g. lower `T1_*`/`T2_*` proc chances or `*_DMG`) — these are the new lever.
2. Only if still out of band, nudge `data/constants.ts` menace/relic values (the brutal-difficulty knobs).

Re-run `npx vitest run tests/engine/campaignBalance.test.ts` after each change. Iterate until all four assertions pass. Make the **minimum** change that lands in-band; note the final values in the commit message.

- [ ] **Step 4: Regenerate fixtures**

For each failing deterministic fixture, confirm the new output is *correct* (not a regression) by spot-reading one battle log, then update the fixture to the new expected value. If the repo has an update command (check `package.json` scripts for `vitest -u` / snapshot update), use it: `npx vitest run -u`. Otherwise hand-update the expected literals.

Run: `npx vitest run`
Expected: ALL PASS.

- [ ] **Step 5: Typecheck + final full run**

Run: `npx tsc --noEmit` → PASS.
Run: `npx vitest run` → ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "balance: recalibrate band and refresh fixtures for wizard signatures"
```

---

## Manual verification (after all tasks)

- [ ] `npx next dev` (heed AGENTS.md: this is not stock Next.js), open the draft, confirm each card shows a gold "Abilità ★ <name>" chip with a working tooltip, and that names match the wizard.
- [ ] Watch one battle and confirm signature effects appear (e.g. a `stun`/`burn`/shield in the log) and nothing throws in the console.

## Self-review notes (author)

- **Spec coverage:** type+engine (§2) → Task 1; catalog+budget (§3,§5) → Task 2; UI on draft card (§6) → Task 3; balance+fixtures (§7,§8) → Task 4. Data-integrity tests (§8) → Task 2 Step 1.
- **onHpThreshold avoidance (§4 ⚠️):** all "wounded" signatures (harry, lupin, narcissa, pettigrew) use `tsWoundedSelf*` on `onTurnStart` — no `onHpThreshold`.
- **Type consistency:** `registerSignatures` signature identical in Task 1 Interfaces, Step 5, and the engine import in Task 2. `SIGNATURE_BY_ID`/`SIGNATURES` names consistent across Tasks 1–3. Builders' return literals annotated `: EffectSpec[]` so tsc catches drift.
- **Determinism:** every reactive builder either always emits or returns `[]` (wounded gates) — never reads rng. Empty returns cost no rng/log per the EventBus guard.
