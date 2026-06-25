# Combat & UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make combat readable and engaging — graduated 2/3/4 synergies, percentage-based graded debuffs that actually matter, more frequent control/freeze, a 5↑/5↓ battle layout with an info hierarchy + action focus, explicit status UI, and a relic-choice screen that shows the squad.

**Architecture:** Most of the change is **data** (`data/synergies.ts`, `data/statuses.ts`, `data/traits.ts`, `data/wizards.ts`) plus **UI/React** (`BattleArena`, `UnitBust`, `RelicChoiceScreen`, `CampaignRunner`). Only one real engine change: `detectSynergies` must keep the highest active tier per house/role family. Percentage stat-mods (`statMod.pct`) and DOM-measured projectiles already exist, so no engine work is needed for debuffs or the new layout.

**Tech Stack:** Next.js (custom fork — read `node_modules/next/dist/docs/` before any Next-specific code), React, TypeScript, framer-motion, lucide-react, Tailwind, Vitest + Testing Library.

## Global Constraints

- Test runner: `npm run test` (Vitest). **Vitest does NOT typecheck** — after editing any `.ts`/`.tsx`, also run `npx tsc --noEmit` and confirm 0 errors.
- All user-facing copy is **Italian** (match existing strings).
- Deterministic combat: never introduce `Math.random()`/`Date.now()` into engine or data. RNG comes from the seeded `Rng`.
- Group synergies (Golden Trio, Weasley, Order, Death Eaters, Marauders, DA) are **unchanged**.
- Engine change is limited to `detectSynergies` tier suppression. No other `game/engine/**` logic changes.
- Commit after every task. Work on `master`, push when the user signals done (per repo memory: push without asking once work is complete).
- Before committing, verify `git rev-parse HEAD` matches expectation (repo may have a concurrent writer).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `data/synergies.ts` | 2/3/4 house+role synergy entries with `family` | Modify |
| `types/synergy.ts` | add optional `family` to `Synergy` | Modify |
| `game/engine/synergy.ts` | `detectSynergies` keeps highest tier per family | Modify |
| `data/statuses.ts` | graded percentage debuffs (`weaken1/2/3`, `expose1/2/3`, `slow1/2/3`), freeze dur 2 | Modify |
| `data/traits.ts` | rebalance Logoramento/Sifone, add Frantumazione + Gelo, control 18→30% | Modify |
| `data/wizards.ts` | assign `frantumazione` / `gelo` to a few wizards | Modify |
| `components/battle/UnitBust.tsx` | percentage-aware status pills, role badge, detail panel | Modify |
| `components/battle/BattleArena.tsx` | 5↑/5↓ layout, action-focus dim | Modify |
| `components/battle/StatusPill.tsx` | (optional split) explicit status pill text | Create |
| `components/screens/RelicChoiceScreen.tsx` | show squad + active synergies | Modify |
| `components/screens/CampaignRunner.tsx` | pass `team`+`synergies` to RelicChoiceScreen | Modify |
| `tests/...` | unit/data/UI tests per task | Create/Modify |

---

## Task 1: `family` field on synergies + tier suppression in `detectSynergies`

**Files:**
- Modify: `types/synergy.ts`
- Modify: `game/engine/synergy.ts:33-40`
- Test: `tests/synergyTiers.test.ts` (create)

**Interfaces:**
- Consumes: `Synergy`, `DraftedWizard`, `ActiveSynergy` from `@/types`; `detectSynergies(team)` from `@/game/engine/synergy`.
- Produces: `Synergy.family?: string`. `detectSynergies` returns at most one `ActiveSynergy` per `family` value (the highest-threshold active one). Synergies with no `family` are never suppressed.

- [ ] **Step 1: Write the failing test**

Create `tests/synergyTiers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import type { DraftedWizard, Synergy } from '@/types'

// Minimal drafted wizard for synergy detection (only fields membersFor reads).
function dw(id: string, house: string, role = 'Attaccante'): DraftedWizard {
  return { wizard: { id, name: id, house, role, tier: 3, ranges: { hp: [1,1], atk: [1,1], def: [1,1], spd: [1,1] }, spellPool: [], tags: [] } } as unknown as DraftedWizard
}

describe('detectSynergies tier suppression', () => {
  it('keeps only the highest active tier per family', () => {
    // 4 Grifondoro present → tier-4 active; tier-2 and tier-3 of the same family suppressed.
    const team = [dw('a','Grifondoro'), dw('b','Grifondoro'), dw('c','Grifondoro'), dw('d','Grifondoro')]
    const active = detectSynergies(team)
    const houseG = active.filter(a => a.synergy.family === 'house:Grifondoro')
    expect(houseG).toHaveLength(1)
    expect(houseG[0]!.synergy.requires.count).toBe(4)
  })

  it('keeps tier-2 when only 2 members (tier-3/4 inactive)', () => {
    const team = [dw('a','Grifondoro'), dw('b','Grifondoro')]
    const houseG = detectSynergies(team).filter(a => a.synergy.family === 'house:Grifondoro')
    expect(houseG).toHaveLength(1)
    expect(houseG[0]!.synergy.requires.count).toBe(2)
  })

  it('never suppresses family-less (group) synergies', () => {
    const team = [dw('harry','Grifondoro'), dw('ron','Grifondoro'), dw('hermione','Grifondoro')]
    const active = detectSynergies(team)
    expect(active.some(a => a.synergy.id === 'goldenTrio')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- synergyTiers`
Expected: FAIL — tier-2/3/4 entries don't exist yet AND suppression not implemented (multiple house:Grifondoro entries or none).

- [ ] **Step 3: Add `family` to the Synergy type**

In `types/synergy.ts`, add to the `Synergy` interface (after `kind`):

```ts
export interface Synergy {
  id: string
  name: string
  kind: 'house' | 'role' | 'group' | 'origin'
  /** Mutually-exclusive tier group, e.g. 'house:Grifondoro'. Only the highest active tier in a family applies. Undefined = standalone (groups). */
  family?: string
  requires: SynergyRequirement
  bonus: SynergyBonus
}
```

- [ ] **Step 4: Implement suppression in `detectSynergies`**

Replace `detectSynergies` in `game/engine/synergy.ts:33-40` with:

```ts
export function detectSynergies(team: DraftedWizard[]): ActiveSynergy[] {
  const all: ActiveSynergy[] = []
  for (const syn of SYNERGIES) {
    const members = membersFor(syn, team)
    if (members) all.push({ synergy: syn, memberIds: members })
  }
  // Within a family, keep only the highest threshold that is active.
  const bestByFamily = new Map<string, ActiveSynergy>()
  const out: ActiveSynergy[] = []
  for (const a of all) {
    const fam = a.synergy.family
    if (!fam) { out.push(a); continue }
    const cur = bestByFamily.get(fam)
    if (!cur || synergyThreshold(a.synergy) > synergyThreshold(cur.synergy)) {
      bestByFamily.set(fam, a)
    }
  }
  out.push(...bestByFamily.values())
  return out
}
```

Note: `synergyThreshold` is defined lower in the same file (line 67) — it is hoisted (function declaration), so calling it above its definition is fine.

- [ ] **Step 5: Add the tiered entries to `data/synergies.ts`**

Replace the house + role section (lines 4-13) with the 2/3/4 ladders, each tagged with `family`:

```ts
  // Houses (2/3/4) — flavour stat preserved; family keeps only the highest active tier.
  { id: 'gryffindor2', name: '2 Grifondoro', kind: 'house', family: 'house:Grifondoro', requires: { house: 'Grifondoro', count: 2 }, bonus: { def: 10 } },
  { id: 'gryffindor3', name: '3 Grifondoro', kind: 'house', family: 'house:Grifondoro', requires: { house: 'Grifondoro', count: 3 }, bonus: { def: 22 } },
  { id: 'gryffindor4', name: '4 Grifondoro', kind: 'house', family: 'house:Grifondoro', requires: { house: 'Grifondoro', count: 4 }, bonus: { def: 40 } },
  { id: 'slytherin2', name: '2 Serpeverde', kind: 'house', family: 'house:Serpeverde', requires: { house: 'Serpeverde', count: 2 }, bonus: { atk: 10 } },
  { id: 'slytherin3', name: '3 Serpeverde', kind: 'house', family: 'house:Serpeverde', requires: { house: 'Serpeverde', count: 3 }, bonus: { atk: 22 } },
  { id: 'slytherin4', name: '4 Serpeverde', kind: 'house', family: 'house:Serpeverde', requires: { house: 'Serpeverde', count: 4 }, bonus: { atk: 40 } },
  { id: 'ravenclaw2', name: '2 Corvonero', kind: 'house', family: 'house:Corvonero', requires: { house: 'Corvonero', count: 2 }, bonus: { spd: 10 } },
  { id: 'ravenclaw3', name: '3 Corvonero', kind: 'house', family: 'house:Corvonero', requires: { house: 'Corvonero', count: 3 }, bonus: { spd: 22 } },
  { id: 'ravenclaw4', name: '4 Corvonero', kind: 'house', family: 'house:Corvonero', requires: { house: 'Corvonero', count: 4 }, bonus: { spd: 40 } },
  { id: 'hufflepuff2', name: '2 Tassorosso', kind: 'house', family: 'house:Tassorosso', requires: { house: 'Tassorosso', count: 2 }, bonus: { regen: 6 } },
  { id: 'hufflepuff3', name: '3 Tassorosso', kind: 'house', family: 'house:Tassorosso', requires: { house: 'Tassorosso', count: 3 }, bonus: { regen: 12 } },
  { id: 'hufflepuff4', name: '4 Tassorosso', kind: 'house', family: 'house:Tassorosso', requires: { house: 'Tassorosso', count: 4 }, bonus: { regen: 22 } },
  // Roles (2/3/4)
  { id: 'attackers2', name: '2 Attaccanti', kind: 'role', family: 'role:Attaccante', requires: { role: 'Attaccante', count: 2 }, bonus: { atk: 8 } },
  { id: 'attackers3', name: '3 Attaccanti', kind: 'role', family: 'role:Attaccante', requires: { role: 'Attaccante', count: 3 }, bonus: { atk: 15 } },
  { id: 'attackers4', name: '4 Attaccanti', kind: 'role', family: 'role:Attaccante', requires: { role: 'Attaccante', count: 4 }, bonus: { atk: 28 } },
  { id: 'tanks2', name: '2 Tank', kind: 'role', family: 'role:Tank', requires: { role: 'Tank', count: 2 }, bonus: { def: 9 } },
  { id: 'tanks3', name: '3 Tank', kind: 'role', family: 'role:Tank', requires: { role: 'Tank', count: 3 }, bonus: { def: 18 } },
  { id: 'tanks4', name: '4 Tank', kind: 'role', family: 'role:Tank', requires: { role: 'Tank', count: 4 }, bonus: { def: 34 } },
  { id: 'supports2', name: '2 Supporti', kind: 'role', family: 'role:Supporto', requires: { role: 'Supporto', count: 2 }, bonus: { regen: 5 } },
  { id: 'supports3', name: '3 Supporti', kind: 'role', family: 'role:Supporto', requires: { role: 'Supporto', count: 3 }, bonus: { regen: 10 } },
  { id: 'supports4', name: '4 Supporti', kind: 'role', family: 'role:Supporto', requires: { role: 'Supporto', count: 4 }, bonus: { regen: 18 } },
  { id: 'controllers2', name: '2 Controllo', kind: 'role', family: 'role:Controllo', requires: { role: 'Controllo', count: 2 }, bonus: { spd: 8 } },
  { id: 'controllers3', name: '3 Controllo', kind: 'role', family: 'role:Controllo', requires: { role: 'Controllo', count: 3 }, bonus: { spd: 15 } },
  { id: 'controllers4', name: '4 Controllo', kind: 'role', family: 'role:Controllo', requires: { role: 'Controllo', count: 4 }, bonus: { spd: 28 } },
```

Leave the group synergies (Golden Trio … DA) exactly as they are, with no `family`.

- [ ] **Step 6: Run the new test + full suite**

Run: `npm run test -- synergyTiers` → PASS
Run: `npm run test` → note any synergy-related fixtures that now fail (they will be fixed in their own tasks; record them).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add types/synergy.ts game/engine/synergy.ts data/synergies.ts tests/synergyTiers.test.ts
git commit -m "feat(synergy): graduated 2/3/4 house+role tiers with highest-per-family suppression"
```

---

## Task 2: Fix synergy-dependent fixtures broken by Task 1

**Files:**
- Modify: any test that asserts on the old single-tier synergy set (likely `tests/ui/synergyTracker.test.tsx`, `tests/ui/synergyGraph.test.tsx`, `tests/ui/synergyRibbon.test.tsx`, `tests/ui/teamScreen.test.tsx`, and possibly `tests/ui/campaignBalance` / `tests/hooks/useRun.test.ts`).

**Interfaces:**
- Consumes: updated `SYNERGIES` (Task 1).
- Produces: green suite except for the intentionally-deferred `campaignBalance` floor (Task 7).

- [ ] **Step 1: Identify failures**

Run: `npm run test 2>&1 | grep -E "FAIL|✗|×"`
Record each failing file. For each, open it and see whether it (a) counts total synergies, (b) asserts a specific synergy id/name is present/active, or (c) asserts a stat outcome.

- [ ] **Step 2: Fix count-based assertions**

The synergy count went from 14 to 14−8+24 = **30**. Update any hardcoded `SYNERGIES.length`/`toHaveLength(14)` to the new total, or better, derive dynamically. Example fix pattern:

```ts
// before: expect(allSynergies).toHaveLength(14)
// after: assert on a stable subset instead of total count
expect(SYNERGIES.filter(s => s.kind === 'group')).toHaveLength(6)
```

- [ ] **Step 3: Fix activation/outcome assertions**

Where a test built a 3-house team and expected `3 Grifondoro` (+def 22) — that still holds (tier-3 value preserved at 22). Where a test expected `+def 20`, update to `+def 22`. Where a 4-member team is used, expect the tier-4 entry. Apply the smallest change that reflects the new numbers; do **not** weaken assertions to vacuous ones.

- [ ] **Step 4: Run suite**

Run: `npm run test`
Expected: all green except `campaignBalance` (deferred to Task 7). If `campaignBalance` is the only red, proceed.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add tests/
git commit -m "test(synergy): update fixtures for 2/3/4 tier set (30 synergies)"
```

---

## Task 3: Graded percentage debuff statuses

**Files:**
- Modify: `data/statuses.ts`
- Test: `tests/percentDebuffs.test.ts` (create)

**Interfaces:**
- Consumes: `effectiveStats` from `@/game/engine/status` (already applies `statMod.pct` as `stat × (1 + delta/100)` with `kind:'debuff'` → negative sign).
- Produces: status ids `weaken1|weaken2|weaken3`, `expose1|expose2|expose3`, `slow1|slow2|slow3`, each `kind:'debuff'`, `statMod.pct:true`. `freeze.defaultDuration` becomes 2. (Legacy `slow` kept for back-compat.)

- [ ] **Step 1: Write the failing test**

Create `tests/percentDebuffs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyStatus, effectiveStats } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

function unit(atk: number, def: number, spd: number): BattleUnit {
  return {
    buffedStats: { hp: 100, atk, def, spd },
    statusEffects: [], cooldowns: {},
  } as unknown as BattleUnit
}

describe('graded percentage debuffs', () => {
  it('weaken2 reduces atk by 25% of the unit\'s own atk', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'weaken2')
    expect(effectiveStats(u).atk).toBe(30) // 40 * 0.75
  })
  it('weaken3 reduces atk by 40%', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'weaken3')
    expect(effectiveStats(u).atk).toBe(24) // 40 * 0.6
  })
  it('expose2 reduces def by 25%', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'expose2')
    expect(effectiveStats(u).def).toBe(15) // 20 * 0.75
  })
  it('slow1 reduces spd by 15% (rounded)', () => {
    const u = unit(40, 20, 30)
    applyStatus(u, 'slow1')
    expect(effectiveStats(u).spd).toBe(26) // round(30 * 0.85) = 25.5 → 26
  })
})
```

(Verify the rounding expectation against `effectiveStats`: it uses `Math.round`. 30×0.85 = 25.5 → `Math.round` → 26.)

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- percentDebuffs`
Expected: FAIL — `weaken2` etc. not defined (`applyStatus` no-ops on unknown id).

- [ ] **Step 3: Add the graded debuff defs**

In `data/statuses.ts`, after the `slow` entry (line 13) add:

```ts
  // Graded percentage debuffs (engine applies statMod.pct as stat*(1+delta/100); debuff → negative).
  { id: 'weaken1', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 15, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'weaken2', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 25, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'weaken3', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 40, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'expose1', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 15, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'expose2', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 25, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'expose3', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 40, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow1', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 15, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow2', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 25, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow3', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 40, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
```

Note: `StatusDef` has no `family` field for *statuses* — wait. Check `types/status.ts`: `StatusDef` has `family: StatusFamily` (required, values `'control'|'dot'|'regen'|'shield'|'buff'|'debuff'`). So `family: 'debuff'` here is the **StatusFamily** (correct, not the synergy family). Keep `family: 'debuff'`.

Also change the `freeze` entry's `defaultDuration` from `1` to `2`.

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test -- percentDebuffs` → PASS

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add data/statuses.ts tests/percentDebuffs.test.ts
git commit -m "feat(status): graded percentage debuffs (weaken/expose/slow 15/25/40%), freeze dur 2"
```

---

## Task 4: Trait rebalance — Logoramento/Sifone + Frantumazione + Gelo + control 30%

**Files:**
- Modify: `data/traits.ts`
- Modify: `data/wizards.ts` (assign new traits)
- Test: `tests/traitRebalance.test.ts` (create)

**Interfaces:**
- Consumes: status ids from Task 3 (`weaken2`, `slow1`, `expose2`), `freeze`. `TRAITS`, `TRAIT_BY_ID` from `@/data/traits`.
- Produces: traits `frantumazione`, `gelo`; `CONTROL_CHANCE = 0.3`; `Logoramento`→`weaken2`@0.5; `Sifone`→`slow1` always.

- [ ] **Step 1: Write the failing test**

Create `tests/traitRebalance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID } from '@/data/traits'
import { STATUS_BY_ID } from '@/data/statuses'

function appliedStatusId(traitId: string): string | undefined {
  const t = TRAIT_BY_ID[traitId]!
  const eff = (t.trigger as any).effects?.()?.[0]
  return eff?.statusId
}

describe('trait rebalance', () => {
  it('Logoramento applies weaken2 (real -atk%)', () => {
    expect(appliedStatusId('logoramento')).toBe('weaken2')
  })
  it('Sifone applies slow1', () => {
    expect(appliedStatusId('sifone')).toBe('slow1')
  })
  it('Frantumazione exists and applies expose2', () => {
    expect(TRAIT_BY_ID['frantumazione']).toBeDefined()
    expect(appliedStatusId('frantumazione')).toBe('expose2')
  })
  it('Gelo exists and applies freeze', () => {
    expect(TRAIT_BY_ID['gelo']).toBeDefined()
    expect(appliedStatusId('gelo')).toBe('freeze')
  })
  it('every status id referenced by a trait exists', () => {
    for (const t of Object.values(TRAIT_BY_ID)) {
      const eff = (t.trigger as any).effects?.()?.[0]
      if (eff?.statusId) expect(STATUS_BY_ID[eff.statusId], `${t.id} → ${eff.statusId}`).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- traitRebalance`
Expected: FAIL — Logoramento still inline `slow`, Frantumazione/Gelo undefined.

- [ ] **Step 3: Edit `data/traits.ts`**

Change the control constant (line 13):

```ts
const CONTROL_CHANCE = 0.3
```

Replace the `sifone` trait body's effect (line 72) with a real graded status:

```ts
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'slow1' }],
```

Replace the `logoramento` trait body's effect (line 120) with:

```ts
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'weaken2', chance: ATTRITION_CHANCE, duration: ATTRITION_DURATION }],
```

Update the two descriptions to reflect reality:
- `sifone.desc`: `'I suoi colpi rallentano il bersaglio (-VEL%).'`
- `logoramento.desc`: `'I suoi colpi indeboliscono il bersaglio (-ATT%).'`

Add two new traits to the `TRAITS` array (after `vendetta`):

```ts
  {
    id: 'frantumazione', name: 'Frantumazione',
    desc: 'I suoi colpi aprono la difesa del bersaglio (-DIF%).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'expose2', chance: 0.5, duration: 2 }],
    },
  },
  {
    id: 'gelo', name: 'Gelo',
    desc: 'I suoi colpi possono congelare il bersaglio (salta il turno).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'freeze', chance: 0.25, duration: 2 }],
    },
  },
```

- [ ] **Step 4: Assign new traits to a few wizards in `data/wizards.ts`**

Pick wizards already coherent with the effect. Add `gelo` to 1–2 Corvonero wizards and `frantumazione` to 1–2 Attaccante/Controllo wizards. **Append** to their existing `traits` array (do not replace).

Find a Corvonero wizard (e.g. search `house: 'Corvonero'`) and add `'gelo'` to its `traits`. Find an Attaccante and add `'frantumazione'`. Example shape:

```ts
    traits: ['veleno', 'frantumazione'],
```

Keep changes minimal: 2 wizards get `gelo`, 2 get `frantumazione`. Record exactly which ids you edited (the trait-coverage guard test from a prior task may assert role-pool coherence — if it fails, the new trait must be added to that role's allowed pool in the guard's data; see `tests` referencing trait role pools).

- [ ] **Step 5: Run tests**

Run: `npm run test -- traitRebalance` → PASS
Run: `npm run test` → fix any trait-role-pool guard that rejects `frantumazione`/`gelo` by adding them to the appropriate role pool list in that test's fixture (do not weaken the guard's intent — these are combat traits valid for Controllo/Attaccante and Corvonero respectively).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add data/traits.ts data/wizards.ts tests/traitRebalance.test.ts tests/
git commit -m "feat(traits): real -ATT/-DIF debuffs (Logoramento/Frantumazione), Gelo freeze, control 30%"
```

---

## Task 5: Status pills show explicit value (percentage-aware)

**Files:**
- Modify: `components/battle/UnitBust.tsx:68-101` (`describeEffect`, `effectCount`, pill render 186-203)
- Test: `tests/ui/statusPill.test.tsx` (create)

**Interfaces:**
- Consumes: `ActiveEffect` (carries `kind`, `statusId?`, `stat?`, `amount?`, `remaining`). `STATUS_BY_ID` from `@/data/statuses` for pct lookup.
- Produces: pill renders explicit text. For a percentage debuff, badge shows e.g. `-25%`; tooltip says `Indebolimento atk -25%, 2 turni`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/statusPill.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit, ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 40, def: 20, spd: 30, baseAtk: 40, baseDef: 20, baseSpd: 30,
  spell: { id: 's', name: 'Incantesimo', cooldown: 0 },
} as unknown as ReplayUnit

it('weaken pill shows percentage value', () => {
  const eff = { kind: 'debuff', statusId: 'weaken2', remaining: 2, stat: 'atk', amount: 25 } as unknown as ActiveEffect
  render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  const pill = screen.getByTitle(/Indebolimento atk -25%/)
  expect(pill.textContent).toContain('-25%')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- statusPill`
Expected: FAIL — current pill shows `remaining` (2), title uses flat `-${amount}`.

- [ ] **Step 3: Make `describeEffect` + pill percentage-aware**

In `UnitBust.tsx`, add a helper to resolve whether a status is percentage-based (look up `STATUS_BY_ID`). Import it: add `import { STATUS_BY_ID } from '@/data/statuses'` at top.

Add:

```ts
/** True if this effect's statMod is percentage-based. */
function isPct(e: ActiveEffect): boolean {
  return !!(e.statusId && STATUS_BY_ID[e.statusId]?.statMod?.pct)
}
/** Magnitude label for a stat debuff/buff pill: '-25%' or '+10'. */
function magnitudeLabel(e: ActiveEffect): string {
  const amt = e.amount ?? 0
  const sign = e.kind === 'debuff' ? '-' : '+'
  return isPct(e) ? `${sign}${amt}%` : `${sign}${amt}`
}
```

Update `describeEffect` buff/debuff cases to use percentage when applicable:

```ts
    case 'buff':
      return `Potenziamento ${stat} ${magnitudeLabel(e)}, ${turns}`
    case 'debuff':
      return `Indebolimento ${stat} ${magnitudeLabel(e)}, ${turns}`
```

Update the pill body (render block ~196-199) so debuff/buff stat pills show the magnitude instead of the turn count, while control/dot/shield keep `effectCount`:

```tsx
                <Icon size={11} aria-hidden />
                {(e.kind === 'buff' || e.kind === 'debuff') ? magnitudeLabel(e) : effectCount(e)}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test -- statusPill` → PASS

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/battle/UnitBust.tsx tests/ui/statusPill.test.tsx
git commit -m "feat(battle-ui): status pills show explicit magnitude (-25% etc.)"
```

---

## Task 6: 5↑/5↓ battle layout + role badge + action focus

**Files:**
- Modify: `components/battle/BattleArena.tsx:83-99` (layout), `:65-81` (pass `acting` for dim)
- Modify: `components/battle/UnitBust.tsx` (role label for all roles; dim when an action is in progress and this unit is neither actor nor target)
- Test: `tests/ui/battleLayout.test.tsx` (create); update `tests/ui/battle.test.tsx` if it asserts left/right ordering.

**Interfaces:**
- Consumes: `Replay`, `hp`, `entry` (already passed). `ReplayUnit.role`.
- Produces: enemies render in a top row, player squad in a bottom row, each row `flex-nowrap`. A `data-side="enemies"` / `data-side="player"` attribute marks the rows for tests. UnitBust shows role label for every role.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/battleLayout.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import type { Replay } from '@/game/engine/combat/replay'

// Minimal replay with one unit per side.
const replay = {
  units: [
    { key: 'left:a', id: 'a', name: 'A', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 'S', cooldown: 0 } },
    { key: 'right:b', id: 'b', name: 'B', side: 'right', house: 'Serpeverde', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 'S', cooldown: 0 } },
  ],
  frames: [{ statusEffects: {}, cooldowns: {} }],
} as unknown as Replay

it('enemies row sits above the player row in the DOM', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} />)
  const enemies = screen.getByTestId('row-enemies')
  const player = screen.getByTestId('row-player')
  // enemies appears before player in document order
  expect(enemies.compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- battleLayout`
Expected: FAIL — no `row-enemies`/`row-player` testids; current layout is left/right.

- [ ] **Step 3: Rewrite the BattleArena layout**

Replace the `return (...)` block (lines 83-99) with a column layout: enemies (right side = the opponents) on top, player (left) on the bottom. Keep `arenaRef`, `renderSide`, `SpellFx` untouched.

```tsx
  return (
    <div ref={arenaRef} data-testid="battle-arena" className="relative flex flex-col items-center gap-4 w-full">
      <section className="flex flex-col items-center gap-2 w-full">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
        <div data-testid="row-enemies" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(right, true)}</div>
      </section>

      <div className="font-display text-2xl text-white/30 select-none">VS</div>

      <section className="flex flex-col items-center gap-2 w-full">
        <div data-testid="row-player" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
      </section>

      {!blocked && <SpellFx entry={entry} from={fx?.from} to={fx?.to} fxKey={frameKey} />}
    </div>
  )
```

(Enemies top with title above; player bottom with title below — keeps each team's label adjacent to the field edge.)

- [ ] **Step 4: Add action-focus dim**

In `renderSide` (lines 65-81), compute whether an action is in progress and dim non-participants. Change the wrapper:

```tsx
  const anyAction = !!actingKey
  const renderSide = (units: ReplayUnit[], mirrored: boolean) =>
    units.map(u => {
      const involved = u.key === actingKey || u.key === targetKey
      return (
        <div key={u.key} className="relative transition-opacity duration-200" style={{ opacity: anyAction && !involved ? 0.45 : 1 }}>
          <UnitBust
            unit={u}
            hp={hp[u.key] ?? 0}
            acting={u.key === actingKey}
            targeted={u.key === targetKey}
            mirrored={mirrored}
            float={u.key === targetKey ? float : null}
            floatKey={frameKey}
            effects={statusEffects[u.key] ?? []}
            cooldown={cooldowns[u.key]?.[u.spell.id] ?? 0}
          />
          {u.key === targetKey && <ShieldFx active={blocked} fxKey={frameKey} />}
        </div>
      )
    })
```

- [ ] **Step 5: Show role label for every role in UnitBust**

Replace the Tank-only badge block (UnitBust.tsx:174-184) with a role badge shown for all roles (Tank keeps its "Prov." emphasis). Add a role→label/icon map near the other maps:

```tsx
const ROLE_LABEL: Record<string, string> = { Tank: 'Tank', Attaccante: 'Att.', Controllo: 'Contr.', Supporto: 'Sup.' }
```

Replace the block with:

```tsx
      <div className={cn('absolute bottom-14 pointer-events-none', mirrored ? 'right-1' : 'left-1')}>
        <span
          title={unit.role === 'Tank' ? 'Provocazione: i nemici attaccano questo bersaglio per primi' : unit.role}
          className={cn('inline-flex items-center gap-0.5 rounded bg-black/55 px-0.5 text-[9px] font-semibold',
            unit.role === 'Tank' ? 'text-sky-300' : 'text-white/70')}
        >
          <Shield size={9} aria-hidden />
          {unit.role === 'Tank' ? 'Prov.' : ROLE_LABEL[unit.role] ?? unit.role}
        </span>
      </div>
```

- [ ] **Step 6: Run layout test + fix the existing battle fixture**

Run: `npm run test -- battleLayout` → PASS
Run: `npm run test -- battle` → if `tests/ui/battle.test.tsx` asserts old left/right ordering or the Tank-only badge, update those assertions to the new rows/role badge. Keep assertions meaningful.

- [ ] **Step 7: Full suite + typecheck**

Run: `npm run test` (expect green except deferred campaignBalance)
Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add components/battle/BattleArena.tsx components/battle/UnitBust.tsx tests/ui/battleLayout.test.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): 5-up/5-down layout, role badges, action-focus dim"
```

---

## Task 7: Re-base campaign balance floor

**Files:**
- Modify: the campaign balance test (search: `grep -rl "clearRate\|campaignBalance" tests/`)

**Interfaces:**
- Consumes: the new combat numbers (Tasks 1,3,4).

- [ ] **Step 1: Measure the new clear-rate deterministically**

Open the campaign balance test. It runs N seeded campaigns and asserts `clearRate >= FLOOR`. Temporarily log the measured `clearRate` (or read the assertion failure message) across the fixed seed set.

Run: `npm run test -- campaignBalance 2>&1 | tail -20`
Record the actual measured rate.

- [ ] **Step 2: Re-base the floor with margin**

Set `FLOOR` to ~60% of the measured rate (documented margin), matching the precedent comment style already in that file. Add/extend the comment explaining the re-base and date (2026-06-25) and cause (graduated synergies + stronger debuffs/control lowered optimal clear-rate).

- [ ] **Step 3: Verify determinism**

Run: `npm run test -- campaignBalance` three times. Same result each time (no flake).

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add tests/
git commit -m "test(balance): re-base clear-rate floor for graduated synergies + stronger debuffs"
```

---

## Task 8: Relic-choice screen shows the squad + active synergies

**Files:**
- Modify: `components/screens/RelicChoiceScreen.tsx`
- Modify: `components/screens/CampaignRunner.tsx:108-116` (pass `team` + `synergies`)
- Test: `tests/ui/relicChoiceScreen.test.tsx` (update/extend)

**Interfaces:**
- Consumes: `c.run.team` (`DraftedWizard[]`, current survivors) and `detectSynergies(c.run.team)` (`ActiveSynergy[]`) available in `CampaignRunner`. `SquadPanel` from `@/components/draft/SquadPanel`.
- Produces: `RelicChoiceScreen` gains props `team: DraftedWizard[]` and `synergies: ActiveSynergy[]`; renders the squad + active-synergy chips below the relic cards.

- [ ] **Step 1: Write the failing test**

Update `tests/ui/relicChoiceScreen.test.tsx` (add a case):

```tsx
import { detectSynergies } from '@/game/engine/synergy'
// ... existing imports: render, screen, RelicChoiceScreen, sample relics

it('shows the squad and active synergies while choosing', () => {
  const team = [/* build 3 Grifondoro DraftedWizard fixtures */] as any
  const synergies = detectSynergies(team)
  render(<RelicChoiceScreen choices={sampleChoices} owned={[]} team={team} synergies={synergies} onChoose={() => {}} />)
  // squad members visible
  expect(screen.getByTestId('relic-squad')).toBeInTheDocument()
  // at least one active-synergy chip rendered
  expect(screen.getByTestId('relic-synergies')).toBeInTheDocument()
})
```

(Reuse the existing fixture builder in that test file for `DraftedWizard`; if none exists, build three with `house: 'Grifondoro'` so a tier-3 synergy is active.)

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- relicChoiceScreen`
Expected: FAIL — props `team`/`synergies` not accepted; testids absent.

- [ ] **Step 3: Extend RelicChoiceScreen**

Rewrite `components/screens/RelicChoiceScreen.tsx`:

```tsx
'use client'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, Relic } from '@/types'
import { RelicCard } from '@/components/relics/RelicCard'
import { RelicBar } from '@/components/relics/RelicBar'
import { SquadPanel } from '@/components/draft/SquadPanel'

export function RelicChoiceScreen({
  choices, owned, team, synergies, onChoose,
}: {
  choices: Relic[]
  owned: ActiveRelic[]
  team: DraftedWizard[]
  synergies: ActiveSynergy[]
  onChoose: (relic: Relic) => void
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-4xl">Scegli una reliquia</h1>
      <div className="flex flex-wrap justify-center gap-5">
        {choices.map((relic) => (
          <RelicCard key={relic.id} relic={relic} onClick={() => onChoose(relic)} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-white/40">La tua squadra</p>
        <div data-testid="relic-squad" className="w-full">
          <SquadPanel picks={team} layout="row" />
        </div>
        {synergies.length > 0 && (
          <div data-testid="relic-synergies" className="flex flex-wrap justify-center gap-1.5">
            {synergies.map((s) => (
              <span key={s.synergy.id} className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-200">
                ✦ {s.synergy.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-white/40">Le tue reliquie</p>
        <RelicBar relics={owned} />
      </div>
    </main>
  )
}
```

**Before coding:** open `components/draft/SquadPanel.tsx` and confirm its actual prop name (the plan assumes `picks: DraftedWizard[]` and `layout`). If the prop is named differently (e.g. `wizards`, `members`), use the real name. Adjust the call to match.

- [ ] **Step 4: Wire CampaignRunner**

In `components/screens/CampaignRunner.tsx`, import `detectSynergies` (`import { detectSynergies } from '@/game/engine/synergy'`) and pass the squad + synergies (relic-choice case, ~line 108):

```tsx
    case 'relic-choice':
      view = (
        <RelicChoiceScreen
          choices={c.relicChoices}
          owned={c.run.relics}
          team={c.run.team}
          synergies={detectSynergies(c.run.team)}
          onChoose={c.chooseRelic}
        />
      )
      break
```

(Confirm `c.run.team` is the field holding current `DraftedWizard[]` — verified in `hooks/useRun.ts`. If the survivors live under a different field, use that.)

- [ ] **Step 5: Run test, verify pass**

Run: `npm run test -- relicChoiceScreen` → PASS

- [ ] **Step 6: Full suite + typecheck**

Run: `npm run test` → all green (campaignBalance now re-based in Task 7)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 7: Commit**

```bash
git add components/screens/RelicChoiceScreen.tsx components/screens/CampaignRunner.tsx tests/ui/relicChoiceScreen.test.tsx
git commit -m "feat(relics): show squad + active synergies on the relic-choice screen"
```

---

## Task 9: Final verification + build

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `npm run test`
Expected: all green.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, all routes prerender.

- [ ] **Step 4: Confirm HEAD then push**

```bash
git rev-parse HEAD
git log --oneline -9
git push origin master
```

(Verify HEAD is what this session produced before pushing — repo may have a concurrent writer.)

---

## Self-Review notes

- **Spec coverage:** Part 1 → Tasks 1–2; Part 2 → Tasks 3–4 (+balance Task 7); Part 3 → Task 6; Part 4 status UI → Task 5, relic squad → Task 8. All covered.
- **Type consistency:** `family` on `Synergy` (Task 1) is the *synergy* family (string); `family` on `StatusDef` (Task 3) is the pre-existing `StatusFamily` enum — distinct fields on distinct types, no collision. Status ids `weaken2/slow1/expose2/freeze` defined in Task 3 are exactly the ids referenced in Task 4. `RelicChoiceScreen` props added in Task 8 match the `CampaignRunner` call.
- **Deferred-failure flow:** Task 1 may turn `campaignBalance` red; it stays red through Tasks 2–6 and is fixed in Task 7. Each task's "expect green except campaignBalance" reflects this.
- **Assumption to verify at execution:** `SquadPanel` prop name (Task 8 Step 3) and `c.run.team` survivors field (Task 8 Step 4) — both flagged inline to confirm before coding.
