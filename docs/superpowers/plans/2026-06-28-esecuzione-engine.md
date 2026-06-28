# Esecuzione Engine & Content — Implementation Plan (Plan A of the Esecuzione slice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make "Esecuzione" a draftable finisher build — a team-wide execute (bonus damage to low-HP targets) granted by relics + a synergy, scaled by `keywordMult.esecuzione`, with the threshold raised when the build comes together.

**Slice design (decisions, baked in):**
- Identity: a *finisher* — bonus damage to targets under a HP threshold. Burst-on-threshold, not ramp. The opposite end of the counter web from Veleno.
- The execute MECHANIC already exists per-wizard (the `esecuzione` trait + `odExecute` signatures). This slice adds a **team-wide** execute so the build is draftable beyond the 3 execute-signature wizards — mirroring how Veleno's relics granted poison to any team. The individual execute signatures stay untouched and stack on top as flavor.
- **Draftability:** a `Spada di Grifondoro` relic grants the whole team execute (like Pugnale granted poison); a `Sigillo del Carnefice` relic scales it via `keywordMult.esecuzione`; the **"Spietatezza"** synergy (≥3 `esecuzione`-tagged wizards) raises the threshold + adds bonus (the Tossicità-equivalent payoff).
- **Counter web (distinct from Veleno, to be validated in Plan B):** beats Fragile/low-HP teams; loses to durable walls (Tank/Scudi/Regen) you can't push under the threshold.

**Architecture:** Additive. New `BattleUnit.execute?: {threshold, bonus}` stamped in `toBattleUnits` from a pure `teamExecute(team, relics, synergies)` helper (reuses `keywordDamageMult`). Applied once in the `damage` effect handler, conditional on the target's HP fraction. No change to existing traits/signatures/statuses.

**Tech Stack:** TypeScript, Next.js, Vitest. Builds on the Veleno slice (merged): keyword system, `keywordDamageMult`, the per-unit-flag + tag-synergy patterns.

## Global Constraints

- **Determinism:** `teamExecute` is pure, no RNG; execute application in the damage handler consumes no RNG. Seeded tests unaffected unless a seeded team actually grants execute.
- **Backward compatibility:** existing tests stay green (current baseline 694). `BattleUnit.execute` is optional/`undefined` for every team without an execute relic or Spietatezza → no existing battle changes.
- **`'esecuzione'` keyword** is already declared (`types/keyword.ts`). `keywords?`/`keywordMult?` already exist on `Relic`.
- **Execute application:** in the `damage` handler, after `computeDamage`, if `ctx.actor.execute` is set AND `ctx.target.maxHp > 0` AND `ctx.target.hp / ctx.target.maxHp < execute.threshold`, multiply the damage by `(1 + execute.bonus)` (rounded). Do NOT push a new LogFlag (the drama/callout layer is a later, deferred task).
- **teamExecute composition (verbatim):** start `threshold=0, bonus=0`; for each active (condition-matching) relic with `grantsExecute`, `threshold = max(threshold, relic.grantsExecute.threshold)` and `bonus += relic.grantsExecute.bonus`; if the `'spietatezza'` synergy is active, `threshold = max(threshold, 0.35)` and `bonus += 0.25`; if `bonus <= 0` return `undefined`; else `bonus *= keywordDamageMult(team, relics, 'esecuzione')` and return `{ threshold, bonus }`.
- **Wizards to tag `'esecuzione'`** (append to existing tags): `voldemort`,`lucius`,`greyback` (have execute signatures; greyback already `['deatheater','veleno']`), `harry` (fury), `marcus` (fury, currently no tags), plus finisher-themed attackers `bellatrix`,`snape`,`draco`,`sirius`. (≥3 needed for the synergy; ~8 for draftability.)

---

## File Structure

- **Create** `game/engine/execute.ts` — `teamExecute(team, relics, synergies)`.
- **Modify** `types/combat.ts` — `BattleUnit.execute?: { threshold: number; bonus: number }`.
- **Modify** `types/relic.ts` — `Relic.grantsExecute?: { threshold: number; bonus: number }`.
- **Modify** `game/engine/combat/simulate.ts` — `toBattleUnits` stamps `execute` from `teamExecute`.
- **Modify** `game/engine/combat/effects.ts` — apply execute in the `damage` handler.
- **Modify** `data/relics.ts` — `Spada di Grifondoro`, `Sigillo del Carnefice`.
- **Modify** `data/synergies.ts` — `spietatezza` synergy.
- **Modify** `data/wizards.ts` — tag the listed wizards `'esecuzione'`.
- **Test** `tests/engine/esecuzione.test.ts` — helper + damage application + relics + synergy.

---

### Task 1: `teamExecute` helper + execute application in combat

**Files:**
- Create: `game/engine/execute.ts`
- Modify: `types/combat.ts`, `types/relic.ts`
- Modify: `game/engine/combat/simulate.ts` (toBattleUnits), `game/engine/combat/effects.ts` (damage handler)
- Test: `tests/engine/esecuzione.test.ts` (create)

**Interfaces produced:** `teamExecute(team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[]): { threshold: number; bonus: number } | undefined`. `BattleUnit.execute?: { threshold: number; bonus: number }`. `Relic.grantsExecute?: { threshold: number; bonus: number }`. The `damage` effect handler multiplies damage by `(1 + execute.bonus)` against sub-threshold targets.

- [ ] **Step 1: Add the types**

In `types/relic.ts`, add to the `Relic` interface (next to `keywordMult?`):
```typescript
  /** Grants the whole team an execute: +bonus damage to targets below `threshold` HP fraction. */
  grantsExecute?: { threshold: number; bonus: number }
```

In `types/combat.ts`, add to the `BattleUnit` interface (after `velenoUncapped?`):
```typescript
  /** This unit's side execute (from relics/Spietatezza): +bonus dmg to targets below `threshold` HP fraction. */
  execute?: { threshold: number; bonus: number }
```

- [ ] **Step 2: Write the failing test for `teamExecute`**

Create `tests/engine/esecuzione.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { teamExecute } from '@/game/engine/execute'
import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'

const team = [] as unknown as DraftedWizard[]
const spadaRelic: ActiveRelic = { relic: { id: 'spada-grifondoro', name: 'Spada', desc: '', rarity: 'rara', grantsExecute: { threshold: 0.3, bonus: 0.4 } }, stageObtained: 0 }
const spietatezza: ActiveSynergy = { synergy: { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { atk: 5 } }, memberIds: [] }

describe('teamExecute', () => {
  it('is undefined with no execute sources', () => {
    expect(teamExecute(team, [], [])).toBeUndefined()
  })
  it('a grantsExecute relic yields its threshold and bonus', () => {
    expect(teamExecute(team, [spadaRelic], [])).toEqual({ threshold: 0.3, bonus: 0.4 })
  })
  it('Spietatezza raises the threshold and adds bonus', () => {
    expect(teamExecute(team, [spadaRelic], [spietatezza])).toEqual({ threshold: 0.35, bonus: 0.65 })
  })
  it('Spietatezza alone (no relic) still grants execute', () => {
    expect(teamExecute(team, [], [spietatezza])).toEqual({ threshold: 0.35, bonus: 0.25 })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/engine/esecuzione.test.ts`
Expected: FAIL — `teamExecute` not found.

- [ ] **Step 4: Implement `teamExecute`**

Create `game/engine/execute.ts`:
```typescript
import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'
import { keywordDamageMult, relicMatchesCondition } from './relics'

/** Team-wide execute from relics + the Spietatezza synergy, scaled by keywordMult.esecuzione.
 *  Pure; no RNG. Returns undefined when the team has no execute source. */
export function teamExecute(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[],
): { threshold: number; bonus: number } | undefined {
  let threshold = 0
  let bonus = 0
  for (const { relic } of relics) {
    if (!relic.grantsExecute) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    threshold = Math.max(threshold, relic.grantsExecute.threshold)
    bonus += relic.grantsExecute.bonus
  }
  if (synergies.some(s => s.synergy.id === 'spietatezza')) {
    threshold = Math.max(threshold, 0.35)
    bonus += 0.25
  }
  if (bonus <= 0) return undefined
  bonus *= keywordDamageMult(team, relics, 'esecuzione')
  return { threshold, bonus }
}
```

> Confirm `relicMatchesCondition` is exported from `game/engine/relics.ts` (it is — used by `keywordDamageMult`). If not exported, export it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/engine/esecuzione.test.ts`
Expected: PASS (all 4).

- [ ] **Step 6: Write the failing combat-application test**

Append to `tests/engine/esecuzione.test.ts`:
```typescript
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleResult, Stats } from '@/types'

function mk(id: string, stats: Stats): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}
const totalDmgToRight = (r: BattleResult) =>
  r.log.filter(e => e.targetSide === 'right' && (e.value ?? 0) > 0).reduce((s, e) => s + (e.value ?? 0), 0)

describe('execute applies to low-HP targets in battle', () => {
  // Enemy starts already wounded (low currentHp) so the execute threshold is in play immediately.
  const attacker = [mk('harry', { hp: 400, atk: 30, def: 10, spd: 30 })]
  const woundedEnemy = () => [{ ...mk('greyback', { hp: 400, atk: 1, def: 10, spd: 1 }), currentHp: 60 }] // 15% HP
  const spietatezza: ActiveSynergy = { synergy: { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { atk: 5 } }, memberIds: [] }

  it('a Spietatezza team deals more damage to a wounded enemy than a plain team (same seed)', () => {
    const plain = simulateBattle(attacker, woundedEnemy(), createRng('exec-1'))
    const withExec = simulateBattle(attacker, woundedEnemy(), createRng('exec-1'), { leftSyn: [spietatezza] })
    expect(totalDmgToRight(withExec)).toBeGreaterThan(totalDmgToRight(plain))
  })
})
```
> `currentHp` makes the enemy start at 15% HP (below the 35% Spietatezza threshold) so the execute fires on the first hit. If `currentHp` isn't the field that sets starting HP, check `DraftedWizard`/`toBattleUnits` (`startHp = dw.currentHp ?? buffed.hp`) — it is.

- [ ] **Step 7: Run it (fails), implement, run (passes)**

Run: `npx vitest run tests/engine/esecuzione.test.ts` → FAIL (execute not stamped/applied yet).

In `game/engine/combat/simulate.ts`, `toBattleUnits`: compute the flag once before `team.map` (next to `velenoUncapped`) and add it to the returned unit:
```typescript
  const velenoUncapped = synergies.some(s => s.synergy.id === 'tossicita')
  const execute = teamExecute(team, relics, synergies)
```
and in the return literal add `execute` next to `velenoUncapped`:
```typescript
      cooldowns: {}, statusEffects: [], alive: true, velenoUncapped, execute,
```
Import `teamExecute` from `'../execute'`.

In `game/engine/combat/effects.ts`, in the `damage` handler, right after `let dmg = computeDamage(...)` and before the freeze-shatter block, add:
```typescript
    const ex = ctx.actor.execute
    if (ex && ctx.target.maxHp > 0 && ctx.target.hp / ctx.target.maxHp < ex.threshold) {
      dmg = Math.round(dmg * (1 + ex.bonus))
    }
```

Run again → PASS.

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS (694 + new). No existing battle has `execute` set (no execute relic/synergy in seeded teams) → unchanged & deterministic.

- [ ] **Step 9: Commit**

```bash
git add types/combat.ts types/relic.ts game/engine/execute.ts game/engine/combat/simulate.ts game/engine/combat/effects.ts tests/engine/esecuzione.test.ts
git commit -m "feat(esecuzione): teamExecute helper + execute damage application"
```

---

### Task 2: Execute relics (Spada di Grifondoro, Sigillo del Carnefice)

**Files:**
- Modify: `data/relics.ts`
- Test: `tests/engine/esecuzione.test.ts` (append)

**Interfaces:** Consumes `Relic.grantsExecute` + `keywordMult` (Task 1 / Veleno). Produces relics `spada-grifondoro`, `sigillo-carnefice`.

- [ ] **Step 1: Add the relics**

In `data/relics.ts`, add (near the veleno relics; do NOT reorder existing entries — array order feeds seeded `weightedPick`, append at a sensible spot but verify no seeded relic-offer test breaks):
```typescript
  { id: 'sigillo-carnefice', name: 'Sigillo del Carnefice', desc: "Il bonus di Esecuzione della squadra è aumentato del 50%.", rarity: 'non-comune', keywords: ['esecuzione'], keywordMult: { esecuzione: 0.5 } },
  { id: 'spada-grifondoro', name: 'Spada di Grifondoro', desc: 'I colpi della squadra infliggono +40% danni ai bersagli sotto il 30% di vita.', rarity: 'rara', keywords: ['esecuzione'], grantsExecute: { threshold: 0.3, bonus: 0.4 } },
```

- [ ] **Step 2: Write + run the integration test**

Append to `tests/engine/esecuzione.test.ts`:
```typescript
import { RELICS } from '@/data/relics'
import type { ActiveRelic } from '@/types'

describe('execute relics', () => {
  const spada = RELICS.find(r => r.id === 'spada-grifondoro')!
  const sigillo = RELICS.find(r => r.id === 'sigillo-carnefice')!
  const attacker = [mk('harry', { hp: 400, atk: 30, def: 10, spd: 30 })]
  const woundedEnemy = () => [{ ...mk('greyback', { hp: 400, atk: 1, def: 10, spd: 1 }), currentHp: 60 }]

  it('Spada grants execute (more damage to a wounded enemy than no relic)', () => {
    const plain = simulateBattle(attacker, woundedEnemy(), createRng('exec-2'))
    const withSpada = simulateBattle(attacker, woundedEnemy(), createRng('exec-2'), { leftRelics: [{ relic: spada, stageObtained: 0 }] })
    expect(totalDmgToRight(withSpada)).toBeGreaterThan(totalDmgToRight(plain))
  })
  it('Sigillo scales Spada (more damage than Spada alone)', () => {
    const relicsA: ActiveRelic[] = [{ relic: spada, stageObtained: 0 }]
    const relicsB: ActiveRelic[] = [{ relic: spada, stageObtained: 0 }, { relic: sigillo, stageObtained: 0 }]
    const a = simulateBattle(attacker, woundedEnemy(), createRng('exec-3'), { leftRelics: relicsA })
    const b = simulateBattle(attacker, woundedEnemy(), createRng('exec-3'), { leftRelics: relicsB })
    expect(totalDmgToRight(b)).toBeGreaterThan(totalDmgToRight(a))
  })
})
```
Run: `npx vitest run tests/engine/esecuzione.test.ts` → PASS.

- [ ] **Step 3: Full suite**

Run: `npx vitest run`
Expected: PASS. If a seeded relic-offer/balance snapshot shifts because two relics were added (changes `weightedPick` draws), confirm it's exactly the new-relics difference and update only those snapshots; note it. Do not mass-update.

- [ ] **Step 4: Commit**

```bash
git add data/relics.ts tests/engine/esecuzione.test.ts
git commit -m "feat(esecuzione): Spada di Grifondoro + Sigillo del Carnefice relics"
```

---

### Task 3: Spietatezza synergy + tag the finisher cast

**Files:**
- Modify: `data/synergies.ts`, `data/wizards.ts`
- Test: `tests/engine/esecuzione.test.ts` (append)

**Interfaces:** Produces the `spietatezza` synergy and `'esecuzione'`-tagged wizards; `detectSynergies` returns `spietatezza` at ≥3 tagged.

- [ ] **Step 1: Add the synergy**

In `data/synergies.ts`, next to `tossicita`:
```typescript
  { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { atk: 5 } },
```

- [ ] **Step 2: Tag the wizards**

In `data/wizards.ts`, add `'esecuzione'` to these wizards' `tags` (append where tags exist; add `tags: ['esecuzione'],` where absent — match the existing object-literal style; change nothing else):

| id | result |
|---|---|
| `voldemort` | `['deatheater','esecuzione']` |
| `lucius` | `['deatheater','esecuzione']` |
| `greyback` | `['deatheater','veleno','esecuzione']` |
| `bellatrix` | `['deatheater','veleno','esecuzione']` |
| `snape` | add `'esecuzione'` (append if tags exist, else `tags: ['esecuzione'],`) |
| `draco` | add `'esecuzione'` |
| `sirius` | add `'esecuzione'` |
| `harry` | `['trio','da','esecuzione']` |
| `marcus` | `tags: ['esecuzione'],` |

> Verify each wizard's current `tags` in the file and append precisely; do not drop existing tags.

- [ ] **Step 3: Write + run the test**

Append to `tests/engine/esecuzione.test.ts`:
```typescript
import { detectSynergies } from '@/game/engine/synergy'

describe('Spietatezza synergy', () => {
  it('activates with 3 esecuzione-tagged wizards', () => {
    const t = ['voldemort', 'lucius', 'harry'].map(id => mk(id, { hp: 100, atk: 30, def: 10, spd: 20 }))
    expect(detectSynergies(t).map(a => a.synergy.id)).toContain('spietatezza')
  })
  it('does not activate with only 2', () => {
    const t = ['voldemort', 'lucius'].map(id => mk(id, { hp: 100, atk: 30, def: 10, spd: 20 }))
    expect(detectSynergies(t).map(a => a.synergy.id)).not.toContain('spietatezza')
  })
})
```
Run: `npx vitest run tests/engine/esecuzione.test.ts` → PASS.

- [ ] **Step 4: Full suite**

Run: `npx vitest run`
Expected: PASS. Tags don't affect RNG; Spietatezza won't activate in the Grifondoro `campaignBalanceB` harness (its picks are power-first, and the tagged set is mostly Serpeverde + harry) → no shift. If a snapshot moves, STOP and investigate (a seeded team unexpectedly fielding 3 esecuzione tags), don't blind-update.

- [ ] **Step 5: Commit**

```bash
git add data/synergies.ts data/wizards.ts tests/engine/esecuzione.test.ts
git commit -m "feat(esecuzione): Spietatezza synergy + esecuzione tags on the finisher cast"
```

---

## Self-Review

**1. Coverage:** team-wide execute mechanic (Task 1), draftability via a granting relic + scaling relic (Task 2), the threshold-raising synergy + tags (Task 3). The individual `esecuzione` trait/`odExecute` signatures are intentionally untouched (they stack on top). Loadout (already built) + drama callouts (deferred) are out of scope. Validation (counter matchups + favor-Esecuzione sweep) is **Plan B**.

**2. Placeholder scan:** none. The bounded verifications (relicMatchesCondition export; the toBattleUnits return literal; per-wizard current tags) are "confirm against the real file" steps with concrete expectations.

**3. Type consistency:** `teamExecute(team, relics, synergies)` and its `{threshold,bonus}|undefined` return used consistently (helper, toBattleUnits, tests). `Relic.grantsExecute` / `BattleUnit.execute` share the `{threshold,bonus}` shape. `spietatezza` id consistent across helper, synergy data, and tests. `keywordMult.esecuzione` matches the declared `Keyword`.

---

## What this leaves to Plan B / later
- **Plan B — Validation:** counter-web matchup tests (Esecuzione beats Fragile/low-HP, loses to Tank/Scudi/Regen) + a favor-Esecuzione viability sweep (reuse the Veleno sweep harness, biased to esecuzione tags + the execute relics).
- **Deferred (user-gated):** drama callouts for execute kills + MVP recap.
