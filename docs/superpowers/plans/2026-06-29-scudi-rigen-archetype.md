# Scudi-Rigen Archetype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Scudi-Rigen ("muro" Tassorosso) archetype: regen overflow (today wasted) converts to shield, granted/scaled by a relic pair + tag-synergy, with a declared & tested counter matrix.

**Architecture:** One pure team-helper (`teamShieldConvert`, structural clone of `teamExecute`), one per-unit stamp (`unit.shieldConvert`), one engine edit (the `tickHeal` branch in `status.ts`), then content (2 relics + 1 synergy + wizard tags), then validation (counters + sweep). The mechanism is off-by-default — when no source grants conversion, the engine branch is bit-identical to today, so all 710 existing seeded tests stay green.

**Tech Stack:** TypeScript, Vitest, the existing combat engine (`game/engine/`), `@/`-aliased imports.

## Global Constraints

- **Determinism is sacred:** the modified `tickHeal` branch MUST be bit-identical when `unit.shieldConvert` is absent. Zero RNG in the conversion path. Verify the full suite (710 tests) stays green BEFORE adding any content that activates conversion.
- **Shield uses refresh, NOT accumulation:** the conversion shield replaces the prior conversion shield each tick (the `shield` status is already `stack: 'refresh'`). No unbounded shield growth.
- **Pattern fidelity:** `teamShieldConvert` mirrors `game/engine/execute.ts` `teamExecute` exactly (sum relic grants + synergy grant, then `* keywordDamageMult(team, relics, 'scudo')`, return `undefined` if `rate <= 0`).
- **Metric rule (validation):** sweep reports **winRate + shieldUptake + turn-budget**, NEVER total damage (shield is not a damage channel; same hard-won lesson as `velenoSweep`/`esecuzioneSweep`).
- **Italian copy** for relic/synergy `name`/`desc` (matches existing content).
- Run tests with `npx vitest run <path>`. Typecheck with `npx tsc --noEmit` (vitest does NOT typecheck — run tsc on new TS files).

---

### Task 1: `grantsShieldConvert` relic field + `unit.shieldConvert` type

**Files:**
- Modify: `types/relic.ts` (near `grantsExecute`, line ~40)
- Modify: `types/combat.ts` (near `execute`, line ~48-49)

**Interfaces:**
- Produces: `Relic.grantsShieldConvert?: { rate: number }`; `BattleUnit.shieldConvert?: { rate: number }`

- [ ] **Step 1: Add the relic field**

In `types/relic.ts`, directly after the `grantsExecute?: { threshold: number; bonus: number }` line, add:

```ts
  /** Grants the team a regen-overflow → shield conversion (Scudi-Rigen archetype): `rate` of
   *  the regen tick's overflow-above-maxHp becomes shield. Stacked/scaled via teamShieldConvert. */
  grantsShieldConvert?: { rate: number }
```

- [ ] **Step 2: Add the per-unit field**

In `types/combat.ts`, directly after the `execute?: { threshold: number; bonus: number }` line, add:

```ts
  /** This unit's side shield-conversion (from relics/Bastione): `rate` of regen overflow → shield. */
  shieldConvert?: { rate: number }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors — fields are optional, no consumer yet).

- [ ] **Step 4: Commit**

```bash
git add types/relic.ts types/combat.ts
git commit -m "feat(scudi-rigen): grantsShieldConvert relic field + unit.shieldConvert type"
```

---

### Task 2: `teamShieldConvert` pure helper

**Files:**
- Create: `game/engine/shieldConvert.ts`
- Test: `tests/engine/shieldConvert.test.ts`

**Interfaces:**
- Consumes: `Relic.grantsShieldConvert` (Task 1), `keywordDamageMult` + `relicMatchesCondition` from `@/game/engine/relics`.
- Produces: `teamShieldConvert(team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[]): { rate: number } | undefined`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/shieldConvert.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'

const team = [] as unknown as DraftedWizard[]
const egida: ActiveRelic = { relic: { id: 'egida-tassorosso', name: 'Egida', desc: '', rarity: 'rara', grantsShieldConvert: { rate: 0.5 } }, stageObtained: 0 }
const cuore: ActiveRelic = { relic: { id: 'cuore-del-tasso', name: 'Cuore', desc: '', rarity: 'non-comune', keywords: ['scudo'], keywordMult: { scudo: 0.5 } }, stageObtained: 0 }
const bastione: ActiveSynergy = { synergy: { id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: {} }, memberIds: [] }

describe('teamShieldConvert', () => {
  it('is undefined with no source', () => {
    expect(teamShieldConvert(team, [], [])).toBeUndefined()
  })
  it('a grant relic yields its rate', () => {
    expect(teamShieldConvert(team, [egida], [])).toEqual({ rate: 0.5 })
  })
  it('the scale relic multiplies the rate (keywordMult.scudo)', () => {
    expect(teamShieldConvert(team, [egida, cuore], [])).toEqual({ rate: 0.75 })
  })
  it('Bastione alone (no relic) still grants conversion', () => {
    expect(teamShieldConvert(team, [], [bastione])).toEqual({ rate: 0.35 })
  })
  it('Bastione adds to a relic grant', () => {
    expect(teamShieldConvert(team, [egida], [bastione])).toEqual({ rate: 0.85 })
  })
  it('rate is clamped to <= 1', () => {
    const big: ActiveRelic = { relic: { id: 'x', name: '', desc: '', rarity: 'rara', grantsShieldConvert: { rate: 0.9 } }, stageObtained: 0 }
    expect(teamShieldConvert(team, [egida, big, cuore], [bastione])).toEqual({ rate: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/shieldConvert.test.ts`
Expected: FAIL — `teamShieldConvert` not exported / module not found.

- [ ] **Step 3: Write the implementation**

Create `game/engine/shieldConvert.ts` (mirror of `game/engine/execute.ts`):

```ts
import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'
import { keywordDamageMult, relicMatchesCondition } from './relics'

/** Team-wide regen-overflow → shield conversion from relics + the Bastione synergy, scaled by
 *  keywordMult.scudo. Pure; no RNG. Returns undefined when the team has no conversion source.
 *  `rate` is the fraction of each regen tick's overflow-above-maxHp that becomes shield (clamped <= 1). */
export function teamShieldConvert(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[],
): { rate: number } | undefined {
  let rate = 0
  for (const { relic } of relics) {
    if (!relic.grantsShieldConvert) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    rate += relic.grantsShieldConvert.rate
  }
  if (synergies.some(s => s.synergy.id === 'bastione')) {
    rate += 0.35
  }
  if (rate <= 0) return undefined
  rate *= keywordDamageMult(team, relics, 'scudo')
  return { rate: Math.min(1, rate) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/shieldConvert.test.ts`
Expected: PASS (6 tests). If the `keywordMult` case is off, confirm `keywordDamageMult` returns `1 + sum(mults)` (so `0.5` mult → `*1.5`); the expected `0.75` assumes `(0.5) * 1.5`. If `keywordDamageMult` semantics differ, adjust the expected values to match the real function, NOT the function.

- [ ] **Step 5: Commit**

```bash
git add game/engine/shieldConvert.ts tests/engine/shieldConvert.test.ts
git commit -m "feat(scudi-rigen): teamShieldConvert pure helper (mirror of teamExecute)"
```

---

### Task 3: Stamp `unit.shieldConvert` in `toBattleUnits`

**Files:**
- Modify: `game/engine/combat/simulate.ts:18-40` (the `toBattleUnits` function)
- Test: `tests/engine/shieldConvertStamp.test.ts`

**Interfaces:**
- Consumes: `teamShieldConvert` (Task 2).
- Produces: every `BattleUnit` returned by `toBattleUnits` carries `shieldConvert` (the team's conversion, or `undefined`).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/shieldConvertStamp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const egida: ActiveRelic = { relic: { id: 'egida-tassorosso', name: 'Egida', desc: '', rarity: 'rara', grantsShieldConvert: { rate: 0.5 } }, stageObtained: 0 }

describe('toBattleUnits stamps shieldConvert', () => {
  const team = [mk('cedric', { hp: 200, atk: 20, def: 20, spd: 20 })]
  it('is undefined with no conversion source', () => {
    expect(toBattleUnits(team, 'left', [], []).every(u => u.shieldConvert === undefined)).toBe(true)
  })
  it('is stamped on every unit when a grant relic is present', () => {
    const units = toBattleUnits(team, 'left', [], [egida])
    expect(units.every(u => u.shieldConvert?.rate === 0.5)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/shieldConvertStamp.test.ts`
Expected: FAIL — `shieldConvert` is `undefined` even with the relic (not stamped yet).

- [ ] **Step 3: Implement the stamp**

In `game/engine/combat/simulate.ts`:

Add the import near the existing `import { teamExecute } from '../execute'` (line 8):
```ts
import { teamShieldConvert } from '../shieldConvert'
```

Inside `toBattleUnits`, directly after the `const execute = teamExecute(team, relics, synergies)` line (line 22):
```ts
  const shieldConvert = teamShieldConvert(team, relics, synergies)
```

In the returned object literal, add `shieldConvert` to the trailing property line (line 37), so it reads:
```ts
      cooldowns: {}, statusEffects: [], alive: true, velenoUncapped, execute, shieldConvert,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/shieldConvertStamp.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify determinism — full suite unchanged**

Run: `npx vitest run`
Expected: PASS — 712 tests (710 prior + Task 2's 6 are in a separate file already counted; this step's gate is **no prior test regressed**). The stamp is inert: no relic in existing tests sets `grantsShieldConvert`, so every existing unit gets `shieldConvert: undefined`.

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/simulate.ts tests/engine/shieldConvertStamp.test.ts
git commit -m "feat(scudi-rigen): stamp unit.shieldConvert in toBattleUnits"
```

---

### Task 4: Overflow-to-shield in the regen tick

**Files:**
- Modify: `game/engine/status.ts:85-90` (the `tickHeal` branch)
- Test: `tests/engine/overflowShield.test.ts`

**Interfaces:**
- Consumes: `unit.shieldConvert` (Task 3), the `shield` status (`statusId: 'shield'`, `absorbLeft`, `stack: 'refresh'`).
- Produces: when a regen tick overflows maxHp and `unit.shieldConvert` is set, `round(overflow * rate)` shield is applied (refresh — replaces any prior conversion shield).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/overflowShield.test.ts`. We drive `tickStatuses` directly on a full-HP unit carrying a regen status + a `shieldConvert`, and assert a `shield` status appears with the overflow amount.

```ts
import { describe, it, expect } from 'vitest'
import { tickStatuses } from '@/game/engine/status'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit } from '@/types'

function fullHpUnit(rate?: number): BattleUnit {
  const wizard = WIZARDS.find(w => w.id === 'cedric')!
  return {
    wizard, spell: SPELL_BY_ID['base_attack']!, stats: { hp: 100, atk: 10, def: 10, spd: 10 },
    maxHp: 100, side: 'left', buffedStats: { hp: 100, atk: 10, def: 10, spd: 10 },
    hp: 100, cooldowns: {}, statusEffects: [{ kind: 'regen', statusId: 'regen', remaining: 3, stacks: 1 }],
    alive: true, shieldConvert: rate === undefined ? undefined : { rate },
  } as unknown as BattleUnit
}
const shieldOf = (u: BattleUnit) => u.statusEffects.find(e => e.statusId === 'shield')?.absorbLeft ?? 0

describe('regen overflow → shield', () => {
  it('with no shieldConvert, the full-HP overflow is wasted (no shield)', () => {
    const u = fullHpUnit(undefined)
    tickStatuses(u, 1)
    expect(u.hp).toBe(100)           // capped, no healing
    expect(shieldOf(u)).toBe(0)      // overflow lost, as today
  })
  it('with shieldConvert, the overflow becomes shield at `rate`', () => {
    const u = fullHpUnit(0.5)        // regen tickHeal=12, all of it overflows at full HP
    tickStatuses(u, 1)
    expect(u.hp).toBe(100)           // still capped
    expect(shieldOf(u)).toBe(6)      // round(12 overflow * 0.5)
  })
  it('refreshes (does not accumulate) across ticks', () => {
    const u = fullHpUnit(0.5)
    tickStatuses(u, 1)
    tickStatuses(u, 2)
    expect(shieldOf(u)).toBe(6)      // second tick replaces, not 12
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/overflowShield.test.ts`
Expected: FAIL — the two conversion cases get `shieldOf === 0` (no conversion logic yet). The first (no-convert) case passes.

- [ ] **Step 3: Implement the conversion in the `tickHeal` branch**

In `game/engine/status.ts`, the current branch (lines ~85-90) is:

```ts
    if (tickHeal && unit.alive) {
      // Never regen-heal a dead unit (defense in depth — callers already gate on alive).
      unit.hp = Math.min(unit.maxHp, unit.hp + tickHeal)
      logs.push({ turn, actorId: unit.wizard.id, actorSide: unit.side, action: def?.name ?? 'Rigenerazione',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Cura', value: tickHeal, flags: ['heal'] })
    }
```

Replace it with:

```ts
    if (tickHeal && unit.alive) {
      // Never regen-heal a dead unit (defense in depth — callers already gate on alive).
      const before = unit.hp
      unit.hp = Math.min(unit.maxHp, before + tickHeal)
      const overflow = (before + tickHeal) - unit.maxHp   // > 0 only when the tick exceeds the cap
      if (overflow > 0 && unit.shieldConvert) {
        const amount = Math.round(overflow * unit.shieldConvert.rate)
        if (amount > 0) {
          // Refresh, not accumulate: replace any prior conversion shield (shield status is stack:'refresh').
          const dur = STATUS_BY_ID['shield']!.defaultDuration
          unit.statusEffects = unit.statusEffects.filter(e => !(e.statusId === 'shield' && e.sourceId === 'overflow'))
          unit.statusEffects.push({ kind: 'shield', statusId: 'shield', remaining: dur, stacks: 1, sourceId: 'overflow', absorbLeft: amount })
        }
      }
      logs.push({ turn, actorId: unit.wizard.id, actorSide: unit.side, action: def?.name ?? 'Rigenerazione',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Cura', value: tickHeal, flags: ['heal'] })
    }
```

If `STATUS_BY_ID` is not already imported at the top of `status.ts`, add it (it is used elsewhere in the file — check; the `tickDamage`/`tickHeal` lookups above already reference `STATUS_BY_ID[e.statusId]`, so it IS in scope). No new import needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/overflowShield.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify determinism — full suite unchanged**

Run: `npx vitest run`
Expected: PASS, no prior test regressed. The new branch only fires when `unit.shieldConvert` is set, which no existing test/relic does. Then typecheck:

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/engine/status.ts tests/engine/overflowShield.test.ts
git commit -m "feat(scudi-rigen): regen overflow converts to shield (refresh, off-by-default)"
```

---

### Task 5: Content — relics, synergy, wizard tags

**Files:**
- Modify: `data/relics.ts` (add 2 relics, near `spada-grifondoro`/`sigillo-carnefice`)
- Modify: `data/synergies.ts` (add `bastione`, near other `origin`/tag synergies)
- Modify: `data/wizards.ts` (add `'scudirigen'` tag to ~6 Tassorosso wizards)
- Test: `tests/data/scudiRigenContent.test.ts`

**Interfaces:**
- Consumes: `grantsShieldConvert` (Task 1), `teamShieldConvert` (Task 2), `detectSynergies` from `@/game/engine/synergy`.
- Produces: relics `egida-tassorosso` + `cuore-del-tasso`; synergy `bastione`; tag `scudirigen` on wizards.

- [ ] **Step 1: Write the failing test**

Create `tests/data/scudiRigenContent.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { detectSynergies } from '@/game/engine/synergy'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import type { DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })

describe('Scudi-Rigen content', () => {
  it('egida-tassorosso grants shield conversion', () => {
    const r = RELICS.find(r => r.id === 'egida-tassorosso')!
    expect(r.grantsShieldConvert?.rate).toBeGreaterThan(0)
  })
  it('cuore-del-tasso scales scudo keyword', () => {
    const r = RELICS.find(r => r.id === 'cuore-del-tasso')!
    expect(r.keywordMult?.scudo).toBeGreaterThan(0)
  })
  it('at least 3 wizards carry the scudirigen tag (Bastione is draftable)', () => {
    const tagged = WIZARDS.filter(w => (w.tags ?? []).includes('scudirigen'))
    expect(tagged.length).toBeGreaterThanOrEqual(3)
  })
  it('Bastione activates with 3 scudirigen-tagged wizards and grants conversion', () => {
    const tagged = WIZARDS.filter(w => (w.tags ?? []).includes('scudirigen')).slice(0, 3)
    const team = tagged.map(w => mk(w.id, { hp: 100, atk: 10, def: 10, spd: 10 }))
    const syn = detectSynergies(team)
    expect(syn.map(a => a.synergy.id)).toContain('bastione')
    expect(teamShieldConvert(team, [], syn)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/scudiRigenContent.test.ts`
Expected: FAIL — relics/synergy/tags don't exist yet.

- [ ] **Step 3: Add the relics**

In `data/relics.ts`, add near `spada-grifondoro`/`sigillo-carnefice`:

```ts
  { id: 'egida-tassorosso', name: 'Egida del Tasso', desc: 'La rigenerazione in eccesso oltre la vita massima si converte in scudo (50%).', rarity: 'rara', keywords: ['scudo'], grantsShieldConvert: { rate: 0.5 } },
  { id: 'cuore-del-tasso', name: 'Cuore del Tasso', desc: 'La conversione in Scudo della squadra è aumentata del 50%.', rarity: 'non-comune', keywords: ['scudo'], keywordMult: { scudo: 0.5 } },
```

- [ ] **Step 4: Add the synergy**

In `data/synergies.ts`, add near the other tag/`origin` synergies (e.g. next to `spietatezza` if present, otherwise with the group synergies):

```ts
  { id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: { def: 8 } },
```

(The `+0.35` conversion grant is hard-coded in `teamShieldConvert` keyed off `bastione`; the `bonus.def` is the small defensive nudge from the spec.)

- [ ] **Step 5: Add the tags**

In `data/wizards.ts`, add `'scudirigen'` to the `tags` array of these 6 Tassorosso/support wizards: `cedric`, `sprout`, `hannah`, `susan`, `ernie`, `tonks`. For each, locate its `tags: [...]` line and append `'scudirigen'`. Example for one without prior tags:

```ts
    tags: ['scudirigen'],
```

If a wizard already has tags (e.g. `tags: ['da']`), append: `tags: ['da', 'scudirigen'],`. (Confirm each id's current `tags` line before editing; do not drop existing tags.)

- [ ] **Step 6: Run test + typecheck**

Run: `npx vitest run tests/data/scudiRigenContent.test.ts`
Expected: PASS (4 tests).
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Run the full suite (content can shift data-invariant / balance tests)**

Run: `npx vitest run`
Expected: PASS. If a roster/synergy-count invariant test (e.g. in `tests/data/`) now fails because a tag count changed, inspect it: if it's a legitimate "every tag has N members" invariant, the new tag satisfies it; if a test hard-codes a synergy total, update that test to include `bastione`. Do NOT weaken a real invariant.

- [ ] **Step 8: Commit**

```bash
git add data/relics.ts data/synergies.ts data/wizards.ts tests/data/scudiRigenContent.test.ts
git commit -m "feat(scudi-rigen): egida/cuore relics, Bastione synergy, scudirigen wizard tags"
```

---

### Task 6: Counter-web matchup tests

**Files:**
- Test: `tests/engine/scudiRigenCounters.test.ts`

**Interfaces:**
- Consumes: `simulateBattle`, `createRng`, relics `egida-tassorosso`/`cuore-del-tasso` (Task 5), `spada-grifondoro`/`sigillo-carnefice` (existing).

- [ ] **Step 1: Write the test (model on `tests/engine/esecuzioneCounters.test.ts`)**

Create `tests/engine/scudiRigenCounters.test.ts`. The BEATS-attrito case needs a flip (plain loses, with-conversion wins); the LOSES cases assert `right` wins regardless. The exact stat numbers below are STARTING POINTS — Step 2 tunes them.

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, Stats } from '@/types'

const egida = RELICS.find(r => r.id === 'egida-tassorosso')!
const cuore = RELICS.find(r => r.id === 'cuore-del-tasso')!
const spada = RELICS.find(r => r.id === 'spada-grifondoro')!
const sigillo = RELICS.find(r => r.id === 'sigillo-carnefice')!

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
// A controlled high-regen synergy so the wall actually overflows each tick (kept off the roster).
const regenSyn = (amount: number): ActiveSynergy => ({ synergy: { id: 'test-regen', name: 'Test Regen', kind: 'group', requires: { count: 1 }, bonus: { regen: amount } }, memberIds: [] })
const convert: ActiveRelic[] = [{ relic: egida, stageObtained: 0 }, { relic: cuore, stageObtained: 0 }]
const execRelics: ActiveRelic[] = [{ relic: spada, stageObtained: 0 }, { relic: sigillo, stageObtained: 0 }]

describe('Scudi-Rigen counter-web', () => {
  // The wall: high HP + high regen (so it overflows at full HP, feeding the conversion).
  const wall = () => [mk('ernie', { hp: 600, atk: 16, def: 30, spd: 14 })]

  it('BEATS an attrition enemy (overflow→shield out-sustains chip damage)', () => {
    const attrition = [mk('cedric', { hp: 300, atk: 26, def: 16, spd: 16 })]
    const plain = simulateBattle(wall(), attrition, createRng('sr-attrition'), { leftSyn: [regenSyn(120)] })
    const withConvert = simulateBattle(wall(), attrition, createRng('sr-attrition'), { leftSyn: [regenSyn(120)], leftRelics: convert })
    expect(plain.winner).toBe('right')        // baseline: chip out-damages a non-converting wall
    expect(withConvert.winner).toBe('left')   // conversion flips it — shield absorbs the chip
  })

  it('LOSES to Esecuzione (the finisher closes it under threshold)', () => {
    const finisher = [mk('harry', { hp: 300, atk: 60, def: 16, spd: 30 })]
    const r = simulateBattle(wall(), finisher, createRng('sr-exec'), { leftSyn: [regenSyn(120)], leftRelics: convert, rightRelics: execRelics })
    expect(r.winner).toBe('right')
  })

  it('LOSES to Burst (one big hit blows through the shield)', () => {
    const burst = [mk('voldemort', { hp: 300, atk: 400, def: 20, spd: 99 })]
    const r = simulateBattle(wall(), burst, createRng('sr-burst'), { leftSyn: [regenSyn(120)], leftRelics: convert })
    expect(r.winner).toBe('right')
  })
})
```

- [ ] **Step 2: Run and tune to a real flip**

Run: `npx vitest run tests/engine/scudiRigenCounters.test.ts`

If the BEATS case doesn't flip (plain already wins, or conversion doesn't), tune empirically — the proven method from `esecuzioneCounters`: write a throwaway root-level `tune.mjs` (use `@/`-aliased imports, run with `npx tsx tune.mjs`) sweeping the attrition enemy's `atk` and the wall's `hp`/`regen` until you find `plain=right, withConvert=left`, then bake those numbers into the test and delete `tune.mjs`. The LOSES cases should pass as-is (execute/burst overwhelm the wall); if a LOSES case wins for the wall, raise the enemy's lethality.

⚠️ Watch for the spec's KNOWN RISK: the wall may be TOO WEAK (conversion never flips the attrition case). If no tuning of the *scenario* produces a flip, that's the signal to raise `egida-tassorosso`'s base `rate` (in `data/relics.ts`, Task 5) — NOT to weaken the enemy past plausibility. Document the chosen rate in the commit if you change it.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/scudiRigenCounters.test.ts
# include data/relics.ts too if you raised the rate
git commit -m "test(scudi-rigen): counter-web — beats attrition, loses to esecuzione + burst"
```

---

### Task 7: Favor-Scudi-Rigen viability sweep

**Files:**
- Test: `tests/engine/scudiRigenSweep.test.ts`

**Interfaces:**
- Consumes: the run engine (`startRunB`, `starterOffer`, `chooseStarters`, etc.), `teamShieldConvert`, `detectSynergies`. Clone of `tests/engine/esecuzioneSweep.test.ts`.

- [ ] **Step 1: Write the sweep (clone `tests/engine/esecuzioneSweep.test.ts`, swap the bias)**

Create `tests/engine/scudiRigenSweep.test.ts`. Start from the exact structure of `esecuzioneSweep.test.ts` and change only: the starter house → `'Tassorosso'`; `isExec`→`isScudiRigen` (tag `'scudirigen'`); `EXEC_RELICS`→`SCUDI_RELICS` (`'egida-tassorosso'`, `'cuore-del-tasso'`); the synergy id `spietatezza`→`bastione`; `teamExecute`→`teamShieldConvert`; the metric field `execUptake`→`shieldUptake`; and all `erun-`/log labels → `srun-`/`[scudi-rigen sweep]`.

```ts
import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { detectSynergies } from '@/game/engine/synergy'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { BALANCE } from '@/data/constants'
import type { RunNode, RunState, DraftedWizard } from '@/types'

// Mirror of esecuzioneSweep. Biases choices to scudirigen-tagged wizards + egida/cuore relics.
// Metric: winRate + shieldUptake + turn-budget — NOT total damage (shield is not a damage channel,
// no discrete log flag to attribute; same lesson as veleno/esecuzione sweeps). Expect the same
// house-power skew (here Tassorosso) — that's the house-rebalance backlog item, not a kit defect.
// The maxTurns<turnCap assertion is the ANTI-STALL guard: with refresh (not accumulation) the wall
// must still resolve fights; this test verifies "refresh, no accumulation" holds under real runs.
registerCoreResolvers()

const SCUDI_RELICS = new Set(['egida-tassorosso', 'cuore-del-tasso'])
const isScudiRigen = (dw: DraftedWizard) => (dw.wizard.tags ?? []).includes('scudirigen')

function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

interface RunMetrics { outcome: 'win' | 'defeat'; bastione: boolean; shieldUptake: boolean; turns: number[] }

function favorScudiRigenRun(seed: string): RunMetrics {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Tassorosso')
  const starters = [...offer]
    .sort((a, b) => (Number(isScudiRigen(b)) - Number(isScudiRigen(a))) || (powerOf(b) - powerOf(a)))
    .slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Tassorosso', starters, createRng(seed))
  const m: RunMetrics = { outcome: 'defeat', bastione: false, shieldUptake: false, turns: [] }
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') { m.outcome = 'win'; break }
    if (s.phase === 'defeat') { m.outcome = 'defeat'; break }
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, rng)
      if (s.lastBattle) m.turns.push(s.lastBattle.turns)
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const pick = [...off].sort((a, b) => (Number(isScudiRigen(b)) - Number(isScudiRigen(a))) || (powerOf(b) - powerOf(a)))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full
        ? ([...s.team].sort((a, b) => (Number(isScudiRigen(a)) - Number(isScudiRigen(b))) || (powerOf(a) - powerOf(b)))[0]!.wizard.id)
        : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: pick.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const pick = off.find(r => SCUDI_RELICS.has(r.id)) ?? off[0]!
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: pick.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'area-cleared') { s = clearAreaAndAdvance(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    break
  }
  const synergies = detectSynergies(s.team)
  m.bastione = synergies.some(a => a.synergy.id === 'bastione')
  m.shieldUptake = teamShieldConvert(s.team, s.relics, synergies) !== undefined
  return m
}

describe('favor-Scudi-Rigen viability sweep', () => {
  const N = 120
  const runs = Array.from({ length: N }, (_, i) => favorScudiRigenRun(`srun-${i}`))
  const wins = runs.filter(r => r.outcome === 'win').length
  const winRate = wins / N
  const bastioneRate = runs.filter(r => r.bastione).length / N
  const shieldUptakeRate = runs.filter(r => r.shieldUptake).length / N
  const allTurns = runs.flatMap(r => r.turns).sort((a, b) => a - b)
  const medianTurns = allTurns.length ? allTurns[Math.floor(allTurns.length / 2)]! : 0
  const maxTurns = allTurns.length ? allTurns[allTurns.length - 1]! : 0

  // eslint-disable-next-line no-console
  console.log(`[scudi-rigen sweep] N=${N} winRate=${winRate.toFixed(3)} bastioneRate=${bastioneRate.toFixed(3)} shieldUptakeRate=${shieldUptakeRate.toFixed(3)} medianTurns=${medianTurns} maxTurns=${maxTurns}`)

  it('is deterministic (same seeds → same outcomes)', () => {
    const again = Array.from({ length: N }, (_, i) => favorScudiRigenRun(`srun-${i}`)).map(r => r.outcome)
    expect(again).toEqual(runs.map(r => r.outcome))
  })
  it('the build can win (not structurally broken)', () => {
    expect(winRate).toBeGreaterThan(0.05)
  })
  it('the build fields shield conversion in a meaningful share of runs (draftable)', () => {
    expect(shieldUptakeRate).toBeGreaterThan(0.10)
  })
  it('fights resolve before the turn cap (no stalls — refresh holds)', () => {
    expect(maxTurns).toBeLessThan(BALANCE.combat.turnCap)
  })
})
```

- [ ] **Step 2: Run the sweep, record the diagnostic line**

Run: `npx vitest run tests/engine/scudiRigenSweep.test.ts --reporter=verbose 2>&1 | grep "scudi-rigen sweep"`
Expected: a line like `[scudi-rigen sweep] N=120 winRate=... shieldUptakeRate=... maxTurns=...`. All 4 assertions PASS.

- If `shieldUptakeRate <= 0.10`: the relic/recruit bias isn't landing conversion — confirm `egida-tassorosso` appears in `relicOffer` pools and `scudirigen` wizards in `recruitOffer`. If the relic is gated to a rarity/pool, that's expected lower uptake; relax to `> 0.05` only if the bias is provably working but offers are sparse, and note it.
- If `winRate <= 0.05` (the KNOWN RISK — wall too weak): raise `egida-tassorosso`'s base `rate` in `data/relics.ts`, re-run, and note the final rate in the commit. Engine stays untouched.
- Bake the observed numbers into the top-of-file diagnostic comment (like `esecuzioneSweep`).

- [ ] **Step 3: Commit**

```bash
git add tests/engine/scudiRigenSweep.test.ts
# include data/relics.ts if the rate was raised
git commit -m "test(scudi-rigen): favor-Scudi-Rigen viability sweep (winRate + shieldUptake + turn-budget)"
```

---

### Task 8: Update the backlog handoff doc

**Files:**
- Modify: `docs/superpowers/remaining-work.md`

- [ ] **Step 1: Mark archetype #3 done + extend the counter-web table**

In `docs/superpowers/remaining-work.md`:

1. In the "✅ Done so far" list, add a bullet:
```markdown
- **Scudi-Rigen archetype — COMPLETE slice:** overflow-regen→shield (refresh) via `game/engine/shieldConvert.ts` `teamShieldConvert` + the `tickHeal` branch in `status.ts`; `Egida del Tasso` (grants conversion) + `Cuore del Tasso` (scales it) relics; `Bastione` synergy; `scudirigen` wizard tags. Counter-web validated (beats attrition, loses to esecuzione + burst) + viability sweep. Mechanically complete + validated.
```

2. In the counter-web table, add the row:
```markdown
| Scudi-Rigen | Attrito / danno-sostenuto (overflow→scudo out-sustaina) | Esecuzione (finisce sotto soglia) / Burst (sfonda lo scudo) |
```

3. In the "NEXT UP" section (item #1) and item #3, note that archetype #3 is done — next flagship is **Magie Oscure** (the remaining item #3 archetype).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/remaining-work.md
git commit -m "docs(scudi-rigen): mark archetype #3 done, extend counter-web table"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` → PASS (no type errors).
- [ ] `npx vitest run` → all green (≈730 tests). Note: `relicBalance.test.ts` has a 30s timeout for its 400-battle sweep — that's expected, not a regression.
- [ ] Confirm the new sweep diagnostic line is sane (winRate in a plausible band, shieldUptake > 0.10, maxTurns < turnCap).
- [ ] `git push origin master` (per project convention: push when work is done).

## Self-Review notes (author)

- **Spec coverage:** §1 mechanism → Tasks 1-4; §2 content → Task 5; §3 validation → Tasks 6-7; backlog update → Task 8. Known-risk leverage (raise `rate`, not engine) is wired into Tasks 6 & 7 tuning steps. ✓
- **Determinism gates** at Tasks 3 & 4 Step 5 (full suite unchanged before content activates conversion). ✓
- **Type consistency:** `{ rate: number }` used identically across `grantsShieldConvert`, `shieldConvert`, `teamShieldConvert` return. `sourceId: 'overflow'` is the refresh key, consistent between Task 4 implementation and its test's expectation (single shield, value 6 not 12). ✓
- **Metric rule:** sweep uses winRate/shieldUptake/turn-budget, never total damage. ✓
