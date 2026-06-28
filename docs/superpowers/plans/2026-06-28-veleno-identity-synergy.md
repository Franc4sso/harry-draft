# Veleno Identity & Synergy — Implementation Plan (Plan B of the Veleno slice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the Veleno build *draftable and uncapped*: a "Tossicità" synergy that activates when the team has ≥3 poison-tagged wizards and, when active, lifts the veleno stack cap (the "ramp to infinity" fantasy).

**Architecture:** Mostly additive. Tag ~10 poison-themed wizards with `'veleno'` (tags don't affect RNG/stats → near-zero test risk). Add a tag-based `tossicita` synergy reusing the existing tag/count matcher. The only engine change: stamp a `velenoUncapped` flag on each `BattleUnit` (computed in `toBattleUnits` from that side's active synergies), and let `applyStatus` take a `maxStacks` override that the effect handler passes for `veleno` when the applier's side is uncapped.

**Tech Stack:** TypeScript, Next.js, Vitest. Builds on Plan A (merged): the `veleno` accumulate status, scaled tick, and the Pugnale/Boccino appliers already exist.

## Global Constraints

- **Determinism:** same seed → same outcome; no RNG added. Tags don't alter `pickSpell`/stats, so seeded draft/battle outcomes are unchanged unless `tossicita` actually activates on a seeded team (the Grifondoro-starter `campaignBalanceB` harness won't field 3 Serpeverde poison wizards → stays green).
- **Backward compatibility:** existing tests stay green (current baseline 674). The cap override is `undefined` unless the applier is on a `tossicita` side → all existing poison/veleno behavior unchanged.
- **Source = tag, not equip:** "Tossicità" counts wizards by `tags` includes `'veleno'` (draftable by *who is on the team*), independent of equipped spells. Appliers are the Plan-A relics (Pugnale always-on; Boccino 25%).
- **Cap mechanic:** when `tossicita` is active on a side, veleno applied **by that side** ignores `maxStacks` (rams past 8). The %maxHp tick component remains capped at 8 (Plan A's `tickStackCapForPct` guardrail — do NOT change it; only the flat ramp goes unbounded).
- **Tossicità synergy:** `{ id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { atk: 5 } }`. (The `atk:5` is minor flavor + avoids any "non-empty bonus" invariant; the real payoff is the uncap.)
- **Wizards to tag `'veleno'`** (verbatim ids; append to existing tags where present): `bellatrix`,`dolohov`,`greyback`,`narcissa` (currently `['deatheater']` → add `'veleno'`); `slughorn`,`pansy`,`theodore`,`astoria`,`blaise`,`sprout` (no tags → `tags: ['veleno']`).

---

## File Structure

- **Modify** `data/synergies.ts` — add the `tossicita` synergy entry.
- **Modify** `data/wizards.ts` — add `'veleno'` tag to the 10 wizards above.
- **Modify** `types/combat.ts` — add `velenoUncapped?: boolean` to `BattleUnit`.
- **Modify** `game/engine/status.ts` — `applyStatus` opts gains `maxStacks?: number`; accumulate cap uses `opts.maxStacks ?? def.maxStacks`.
- **Modify** `game/engine/combat/effects.ts` — `applyStatus` handler passes a `maxStacks` override for `veleno` when `ctx.actor.velenoUncapped`.
- **Modify** `game/engine/combat/simulate.ts` — `toBattleUnits` stamps `velenoUncapped` from the side's synergies.
- **Test** `tests/engine/velenoSynergy.test.ts` — new; synergy detection, cap-override unit test, and a battle integration test.

---

### Task 1: Tossicità synergy + tag the poison cast

**Files:**
- Modify: `data/synergies.ts`
- Modify: `data/wizards.ts`
- Test: `tests/engine/velenoSynergy.test.ts` (create)

**Interfaces produced:** `SYNERGIES` contains `tossicita`; the 10 listed wizards include `'veleno'` in `tags`. `detectSynergies(team)` returns a `tossicita` ActiveSynergy when ≥3 of the team carry the tag.

- [ ] **Step 1: Add the synergy**

In `data/synergies.ts`, add this entry to the `SYNERGIES` array (next to the other `kind:'group'`/origin entries like `deatheater`):

```typescript
  { id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { atk: 5 } },
```

- [ ] **Step 2: Tag the wizards**

In `data/wizards.ts`, apply exactly these edits (find each wizard object by `id` and edit its `tags`):

| id | current `tags` | new `tags` |
|---|---|---|
| `bellatrix` | `['deatheater']` | `['deatheater', 'veleno']` |
| `dolohov` | `['deatheater']` | `['deatheater', 'veleno']` |
| `greyback` | `['deatheater']` | `['deatheater', 'veleno']` |
| `narcissa` | `['deatheater']` | `['deatheater', 'veleno']` |
| `slughorn` | (none) | add `tags: ['veleno'],` |
| `pansy` | (none) | add `tags: ['veleno'],` |
| `theodore` | (none) | add `tags: ['veleno'],` |
| `astoria` | (none) | add `tags: ['veleno'],` |
| `blaise` | (none) | add `tags: ['veleno'],` |
| `sprout` | (none) | add `tags: ['veleno'],` |

For wizards with no `tags`, add the line in the same object-literal style as `bellatrix` (which has `tags: ['deatheater'],`). Do not change any other field.

- [ ] **Step 3: Write the failing test**

Create `tests/engine/velenoSynergy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard } from '@/types'

function draft(id: string): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  const stats = { hp: 100, atk: 30, def: 15, spd: 25 }
  return { wizard, stats, maxHp: 100, spell: SPELL_BY_ID['base_attack']! }
}

describe('Tossicità synergy', () => {
  it('activates with 3 veleno-tagged wizards', () => {
    const team = ['bellatrix', 'dolohov', 'slughorn'].map(draft)
    const ids = detectSynergies(team).map(a => a.synergy.id)
    expect(ids).toContain('tossicita')
  })
  it('does not activate with only 2', () => {
    const team = ['bellatrix', 'dolohov'].map(draft)
    const ids = detectSynergies(team).map(a => a.synergy.id)
    expect(ids).not.toContain('tossicita')
  })
})
```

- [ ] **Step 4: Run the test (fails, then passes)**

Run: `npx vitest run tests/engine/velenoSynergy.test.ts`
Expected: FAIL before Steps 1-2 (no `tossicita`); PASS after.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS at 674+2 = 676. If a balance/draft snapshot shifted, STOP and report — tags should not change RNG; an unexpected shift means a seeded team now triggers `tossicita` and needs investigation, not a blind snapshot update.

- [ ] **Step 6: Commit**

```bash
git add data/synergies.ts data/wizards.ts tests/engine/velenoSynergy.test.ts
git commit -m "feat(veleno): Tossicita synergy + veleno tags on the poison cast"
```

---

### Task 2: Cap-lift mechanism (`velenoUncapped` → applyStatus override)

**Files:**
- Modify: `types/combat.ts` (`BattleUnit.velenoUncapped?`)
- Modify: `game/engine/status.ts` (`applyStatus` `maxStacks` override)
- Modify: `game/engine/combat/effects.ts` (handler passes override for veleno)
- Modify: `game/engine/combat/simulate.ts` (`toBattleUnits` stamps the flag)
- Test: `tests/engine/velenoSynergy.test.ts` (append)

**Interfaces:**
- Consumes: `applyStatus` accumulate branch (Plan A); `detectSynergies` (Task 1).
- Produces: `BattleUnit.velenoUncapped?: boolean`; `applyStatus(unit, id, { ..., maxStacks?: number })` honors the override in the accumulate cap; `toBattleUnits` sets `velenoUncapped` true for a side whose synergies include `tossicita`.

- [ ] **Step 1: Add the BattleUnit field**

In `types/combat.ts`, add to the `BattleUnit` interface (after `alive: boolean`):

```typescript
  /** True when this unit's side has the Tossicità synergy active → veleno it applies ignores maxStacks. */
  velenoUncapped?: boolean
```

- [ ] **Step 2: Write the failing unit test for the override**

Append to `tests/engine/velenoSynergy.test.ts`:

```typescript
import { applyStatus } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

function mkUnit(maxHp = 100): BattleUnit {
  return { wizard: { id: 'd' }, side: 'right', hp: maxHp, maxHp, cooldowns: {}, statusEffects: [], alive: true } as unknown as BattleUnit
}

describe('veleno cap override', () => {
  it('caps at maxStacks(8) by default', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')
    expect(u.statusEffects.find(e => e.statusId === 'veleno')!.stacks).toBe(8)
  })
  it('ignores the cap when maxStacks override is Infinity', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno', { maxStacks: Infinity })
    expect(u.statusEffects.find(e => e.statusId === 'veleno')!.stacks).toBe(12)
  })
})
```

- [ ] **Step 3: Run the test (fails)**

Run: `npx vitest run tests/engine/velenoSynergy.test.ts`
Expected: FAIL — `applyStatus` ignores `opts.maxStacks` (stays capped at 8).

- [ ] **Step 4: Implement the override in `applyStatus`**

In `game/engine/status.ts`, change the `applyStatus` signature and the `accumulate` cap:

```typescript
export function applyStatus(
  unit: BattleUnit, statusId: string, opts: { duration?: number; sourceId?: string; maxStacks?: number } = {},
): void {
```

In the `accumulate` branch, use the override:

```typescript
    if (def.stack === 'accumulate') {
      const cur = existing[0]!
      const cap = opts.maxStacks ?? def.maxStacks ?? Infinity
      cur.stacks = Math.min(cap, (cur.stacks ?? 1) + 1)
      cur.remaining = remaining
      return
    }
```

- [ ] **Step 5: Run the unit test (passes)**

Run: `npx vitest run tests/engine/velenoSynergy.test.ts`
Expected: PASS (both cap tests + Task 1 tests).

- [ ] **Step 6: Pass the override from the effect handler**

In `game/engine/combat/effects.ts`, in the `applyStatus` handler, change the `eff.statusId` branch to pass the override for veleno when the applier is uncapped:

```typescript
    if (eff.statusId) {
      const maxStacks = eff.statusId === 'veleno' && ctx.actor.velenoUncapped ? Infinity : undefined
      applyStatus(unit, eff.statusId, { duration: eff.duration, sourceId: sourceId(ctx.actor), maxStacks })
      const def = STATUS_BY_ID[eff.statusId]
      if (def?.kind === 'stun' || def?.kind === 'freeze') ctx.flags.push('stun')
      if (def?.kind === 'dot') ctx.flags.push('dot')
    } else if (eff.effect) {
```

- [ ] **Step 7: Stamp `velenoUncapped` in `toBattleUnits`**

In `game/engine/combat/simulate.ts`, inside `toBattleUnits`, compute the flag once before `team.map` and add it to the returned unit:

```typescript
export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[], relics: ActiveRelic[] = [], menacePct = 0,
): BattleUnit[] {
  const velenoUncapped = synergies.some(s => s.synergy.id === 'tossicita')
  return team.map(dw => {
```

and in the returned object literal, add `velenoUncapped` next to the other fields:

```typescript
    return {
      ...dw, side, buffedStats: buffed, maxHp: buffed.hp,
      hp: Math.min(buffed.hp, Math.max(0, startHp)),
      cooldowns: {}, statusEffects: [], alive: true, velenoUncapped,
    }
```

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS — override is `undefined`/flag `false` for all existing battles (no `tossicita` side), so behavior is unchanged.

- [ ] **Step 9: Commit**

```bash
git add types/combat.ts game/engine/status.ts game/engine/combat/effects.ts game/engine/combat/simulate.ts tests/engine/velenoSynergy.test.ts
git commit -m "feat(veleno): Tossicita lifts the veleno stack cap (velenoUncapped wiring)"
```

---

### Task 3: Battle integration — Tossicità ramps veleno past 8

**Files:**
- Test: `tests/engine/velenoSynergy.test.ts` (append)

**Interfaces:** Consumes `simulateBattle(left, right, rng, { leftSyn, leftRelics })`, `detectSynergies`, the Pugnale relic (Plan A).

- [ ] **Step 1: Write the failing integration test**

Append to `tests/engine/velenoSynergy.test.ts`. It runs a poison team (3 veleno-tagged wizards carrying Pugnale = 100% onHit veleno) with vs without the Tossicità synergy passed in, and checks the peak veleno stacks reached on the enemy via snapshots:

```typescript
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import type { ActiveRelic, ActiveSynergy, BattleResult } from '@/types'

function peakVelenoStacksOnRight(r: BattleResult): number {
  let peak = 0
  for (const snap of r.snapshots) {
    for (const [key, st] of Object.entries(snap)) {
      if (!key.startsWith('right:')) continue
      for (const e of st.statusEffects) {
        if (e.statusId === 'veleno') peak = Math.max(peak, e.stacks ?? 1)
      }
    }
  }
  return peak
}

describe('Tossicità battle integration', () => {
  const pugnale = RELICS.find(r => r.id === 'pugnale-bellatrix')!
  // 3 poison-tagged attackers vs one durable enemy so poison accrues many turns.
  const left = ['bellatrix', 'dolohov', 'blaise'].map(draft)
  const right = [(() => { const d = draft('greyback'); d.stats = { hp: 900, atk: 5, def: 10, spd: 1 }; d.maxHp = 900; return d })()]
  const relics: ActiveRelic[] = [{ relic: pugnale, stageObtained: 0 }]

  const run = (leftSyn: ActiveSynergy[]): BattleResult =>
    simulateBattle(left, right, createRng('veleno-syn-1'), { leftSyn, leftRelics: relics })

  it('caps at 8 without Tossicità', () => {
    const noSyn = run([])
    expect(peakVelenoStacksOnRight(noSyn)).toBe(8)
  })
  it('ramps past 8 with Tossicità active', () => {
    const withSyn = run(detectSynergies(left))   // left has 3 veleno tags → includes tossicita
    expect(peakVelenoStacksOnRight(withSyn)).toBeGreaterThan(8)
  })
})
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run tests/engine/velenoSynergy.test.ts`
Expected: PASS. The durable 900-HP/1-spd enemy survives long enough for Pugnale to apply >8 stacks; without the synergy the cap holds at 8, with it the ramp exceeds 8. If the no-Tossicità case reads <8 (enemy died first or too few turns), raise the enemy HP or lower its spd further so the battle runs longer, and note the adjustment.

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: PASS at 676+ (Task 1's 2 + Task 2's 2 + Task 3's 2 = 6 new).

- [ ] **Step 4: Commit**

```bash
git add tests/engine/velenoSynergy.test.ts
git commit -m "feat(veleno): integration test — Tossicita ramps veleno past the cap"
```

---

## Self-Review

**1. Spec coverage (slice spec §4.2 draftability, §6 Tossicità synergy "removes the cap", §2.1 keyword-source counting):**
- Tag-based draftability (10 sources) → Task 1. ✓ (Simplification vs spec §2.1's "source = signature OR spell OR relic": here a source = a `veleno`-tagged wizard, which is the cleanest fit for the existing tag/count synergy matcher and is what makes the build draftable by composition. Relic/spell sources can be folded into the count in a later pass; noted.)
- Tossicità synergy lifting the flat stack cap (the "infinito") → Tasks 2-3. ✓ The %maxHp guardrail stays capped at 8 (untouched). ✓
- Identity (P0): already shipped via `data/signatures.ts` (all 60 wizards have a signature) — this plan does not re-add it; it makes the existing poison cast *feed* the build via tags. Noted in the report.
- Deferred to Plan C (correctly out of scope): loadout (equip a poison spell like `serpensortia`), on-screen stack/synergy callouts, MVP recap.

**2. Placeholder scan:** none. Every step has complete code. The integration test's durability tuning (Step 2) is an instructed, bounded adjustment with a concrete fallback, not a TBD.

**3. Type consistency:** `velenoUncapped?: boolean` defined in Task 2 Step 1, consumed in `effects.ts` (Step 6) and set in `toBattleUnits` (Step 7). `applyStatus` `opts.maxStacks` defined Step 4, used by the handler Step 6. `tossicita` synergy id matches between data (Task 1), `toBattleUnits` check (Task 2 Step 7), and the integration test (Task 3). `peakVelenoStacksOnRight` reads `e.stacks` consistent with the `ActiveEffect.stacks` field.

---

## What this leaves to Plan C / D
- **Plan C (Loadout & drama):** equip-a-spell UI (so `serpensortia` and other poison spells become in-build appliers beyond relics); on-screen "VELENO ×N" stack callouts + MVP recap (the stacks data already flows through snapshots).
- **Plan D (Validation & counter):** the favor-Veleno viability/distinction/draftability/turn-budget sweep; the Scudi-beats / Regen-loses matchup tests; optional Umbridge counter-boss.
