# Trio di casata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add House Trios — when the player team has ≥1 active Duo AND 3+ wizards of the same house, that house's Trio grants a house-flavored combat buff to those wizards.

**Architecture:** New pure `game/engine/trios.ts` computes a per-wizard `TrioEffect` map (gated on `duos.length >= 1`, player-only). `toBattleUnits` stamps the effect fields onto player `BattleUnit`s, exactly like the existing `houseEffects` did. Four new/reused combat hooks: firstStrike (Serpeverde) in `computeDamage`, analysis on-hit (Corvonero) and hostile-status duration (Tassorosso) via a new `applyHostileStatus` helper, cooldownReduction (Grifondoro) in `resolveAction`. The dead `houseEffects.ts` is deleted.

**Tech Stack:** TypeScript, Vitest. Pure deterministic engine (no RNG in any Trio buff), React UI (compendium panel reuse).

## Test Harness (all combat-hook tasks use this)

The repo's combat tests drive real spells through `resolveAction` with a `unit()` builder — see `tests/engine/combat/statusIntegration.test.ts`. Copy this builder into `tests/engine/trios.test.ts` for Tasks 3-6 (do NOT poke `EFFECT_HANDLERS` directly):

```ts
import { resolveAction } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit, DraftedWizard } from '@/types'

function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}
```
- `base_attack` is a reliable cooldown-0 attack; pick a cooldown>0 damage spell (e.g. `flipendo`/`sectumsempra`) for the Grifondoro test, and a debuff/control spell for status tests. Verify spell ids exist in `SPELL_BY_ID` before using.
- Trio fields go on the actor via the `over` param: `unit('a','flipendo',{ cooldownReduction:1 })`.

## Global Constraints

- **Player-only:** Trios never apply to enemy units. Enforced by passing `leftDuos` only for the `left` side in `toBattleUnits` (same as Duo stamps).
- **No RNG:** all four buffs are deterministic (replay-safe).
- **No new status:** Corvonero reuses existing `expose1`/`expose2` from `data/statuses.ts`.
- **Balance band:** `campaignBalanceB` band is `[0.15, 0.45]`; live assert is `winRate > 0`. Baseline post-phase-1 ≈ 0.375. Re-measure after implementation; tune Trio numbers DOWN if it overshoots; if >1 lever tweak is needed, STOP and report numbers.
- **Balance pins (do not change):** `STARTER_PICKS=3`, `elites≥2`, `normalCount=1`, Voldemort `unitCount=3`. Never reintroduce `menace`.
- **Test path:** balance gate is `tests/engine/campaignBalanceB` — NOT `tests/campaign` (wrong path = "no test files" exit 1, misreadable as pass).
- **Vitest skips typecheck:** run `npx tsc --noEmit` on any new/changed TS, separately from `npm run test`.
- **Two-grade tiering:** 3 same-house = base grade, 4+ = boosted grade. Only Serpeverde/Corvonero differ between grades; Tassorosso/Grifondoro are boolean (3=4).

---

## File Structure

- **Create** `game/engine/trios.ts` — detection: team + duos → `Record<wizardId, TrioEffect>`. Pure.
- **Create** `game/engine/trioText.ts` — human-readable effect string per house×grade (UI copy derived from real numbers).
- **Modify** `types/combat.ts` — add 4 fields to `BattleUnit`.
- **Modify** `game/engine/status.ts` — add `applyHostileStatus(actor, target, statusId, opts?)` helper.
- **Modify** `game/engine/combat/effects.ts` — firstStrike in `computeDamage`; analysis on-hit in damage handler.
- **Modify** `game/engine/combat/resolve.ts` — cooldownReduction at cooldown-set line.
- **Modify** `game/engine/combat/simulate.ts` — compute `trioMap` from `leftDuos`, stamp on player units; drop `houseEffects` import/call.
- **Delete** `game/engine/houseEffects.ts` and its dead tests.
- **Modify** UI compendium/synergy panel — surface active Trios (reuse Duo panel style).
- **Create** `tests/engine/trios.test.ts` — detection + per-buff engine tests.

---

## Task 1: Trio types + detection (pure)

**Files:**
- Modify: `types/combat.ts` (add fields to `BattleUnit`, ~line 67-71)
- Create: `game/engine/trios.ts`
- Test: `tests/engine/trios.test.ts`

**Interfaces:**
- Consumes: `DraftedWizard` (`types/combat.ts:10`), `ActiveDuo` (`types/index` re-export), `House` (`types/wizard`), `livingOf` (`game/engine/roster`).
- Produces:
  - `interface TrioEffect { firstStrike?: { bonus: number }; analysis?: { exposeId: 'expose1' | 'expose2' }; statusDurationBonus?: number; cooldownReduction?: number }`
  - `function trioEffects(team: DraftedWizard[], duos: ActiveDuo[]): Record<string, TrioEffect>` — keyed by `wizard.id`.

- [ ] **Step 1: Add the `TrioEffect` fields to `BattleUnit`**

In `types/combat.ts`, inside `interface BattleUnit` (after the `cunning?` field, ~line 67), add:

```ts
  // --- House Trio stamps (player-only; see game/engine/trios.ts) ---
  /** Serpeverde Opportunista: +`bonus` fraction to the first hit on a full-HP enemy. */
  firstStrike?: { bonus: number }
  /** Corvonero Analisi: on every hit this unit lands, apply `exposeId` (def debuff) to the target. */
  analysis?: { exposeId: 'expose1' | 'expose2' }
  /** Tassorosso Tenacia: hostile statuses this unit applies last +`statusDurationBonus` turns. */
  statusDurationBonus?: number
  /** Grifondoro Slancio: this unit's spell cooldowns are reduced by `cooldownReduction` (min 1). */
  cooldownReduction?: number
```

- [ ] **Step 2: Write the failing detection test**

Create `tests/engine/trios.test.ts`. Use existing wizard fixtures — check how other engine tests build `DraftedWizard[]` (grep `makeTeam`/`draftedFrom` in `tests/engine/`). Minimal fixture builder inline if none fits:

```ts
import { describe, it, expect } from 'vitest'
import { trioEffects } from '@/game/engine/trios'
import type { ActiveDuo, DraftedWizard, Wizard } from '@/types'

function dw(id: string, house: Wizard['house']): DraftedWizard {
  const wizard = { id, name: id, house, role: 'Attaccante', tags: [] } as unknown as Wizard
  return { wizard, stats: { hp: 100, atk: 10, def: 10, spd: 10 }, maxHp: 100, spell: {} as any }
}
const duo: ActiveDuo = { duo: { id: 'cancrena' } as any }

describe('trioEffects', () => {
  it('no Duo active → empty map even with 3 same-house', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde')]
    expect(trioEffects(team, [])).toEqual({})
  })

  it('≥1 Duo + 3 same-house → those 3 get the house Trio', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde'), dw('d', 'Grifondoro')]
    const map = trioEffects(team, [duo])
    expect(map['a']?.firstStrike?.bonus).toBe(0.30)
    expect(map['d']).toBeUndefined() // only 1 Grifondoro
  })

  it('4 same-house → boosted grade (Serpeverde 0.45)', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde'), dw('d', 'Serpeverde')]
    expect(trioEffects(team, [duo])['a']?.firstStrike?.bonus).toBe(0.45)
  })

  it('Tassorosso/Grifondoro boolean grade (3 == 4)', () => {
    const three = [dw('a', 'Tassorosso'), dw('b', 'Tassorosso'), dw('c', 'Tassorosso')]
    const four = [...three, dw('d', 'Tassorosso')]
    expect(trioEffects(three, [duo])['a']?.statusDurationBonus).toBe(1)
    expect(trioEffects(four, [duo])['a']?.statusDurationBonus).toBe(1)
  })

  it('Corvonero grade: 3 → expose1, 4 → expose2', () => {
    const three = [dw('a', 'Corvonero'), dw('b', 'Corvonero'), dw('c', 'Corvonero')]
    const four = [...three, dw('d', 'Corvonero')]
    expect(trioEffects(three, [duo])['a']?.analysis?.exposeId).toBe('expose1')
    expect(trioEffects(four, [duo])['a']?.analysis?.exposeId).toBe('expose2')
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/engine/trios.test.ts`
Expected: FAIL — `trioEffects` not found / module missing.

- [ ] **Step 4: Implement `game/engine/trios.ts`**

```ts
import type { ActiveDuo, DraftedWizard, House } from '@/types'
import { livingOf } from '@/game/engine/roster'

export interface TrioEffect {
  firstStrike?: { bonus: number }              // Serpeverde
  analysis?: { exposeId: 'expose1' | 'expose2' } // Corvonero
  statusDurationBonus?: number                 // Tassorosso
  cooldownReduction?: number                   // Grifondoro
}

// grade 0 = 3 members, grade 1 = 4+ members. Initial numbers — tune via campaignBalanceB.
function effectFor(house: House, grade: 0 | 1): TrioEffect {
  switch (house) {
    case 'Serpeverde':  return { firstStrike: { bonus: grade === 1 ? 0.45 : 0.30 } }
    case 'Corvonero':   return { analysis: { exposeId: grade === 1 ? 'expose2' : 'expose1' } }
    case 'Tassorosso':  return { statusDurationBonus: 1 }
    case 'Grifondoro':  return { cooldownReduction: 1 }
  }
}

/** Player-only. For each wizard, its house's Trio effect IF the team has ≥1 active Duo AND
 *  ≥3 living wizards share that house. Empty map when no Duo is active. Pure; no RNG. */
export function trioEffects(team: DraftedWizard[], duos: ActiveDuo[]): Record<string, TrioEffect> {
  if (duos.length === 0) return {}
  const living = livingOf(team)
  const countByHouse = new Map<House, number>()
  for (const d of living) countByHouse.set(d.wizard.house, (countByHouse.get(d.wizard.house) ?? 0) + 1)
  const map: Record<string, TrioEffect> = {}
  for (const d of living) {
    const n = countByHouse.get(d.wizard.house) ?? 0
    if (n < 3) continue
    map[d.wizard.id] = effectFor(d.wizard.house, n >= 4 ? 1 : 0)
  }
  return map
}
```

Note: verify `livingOf` import path — grep `export function livingOf` (`game/engine/roster.ts`). If it filters on `currentHp`/`alive`, that's fine for a draft-time team (all living); it also future-proofs against a fallen ally inflating the count.

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/engine/trios.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add types/combat.ts game/engine/trios.ts tests/engine/trios.test.ts
git commit -m "feat(trio): TrioEffect type + gated detection (player-only, ≥1 Duo + 3 same-house)"
```

---

## Task 2: Stamp Trios onto player units + delete dead houseEffects

**Files:**
- Modify: `game/engine/combat/simulate.ts` (`toBattleUnits`, lines 30-62; import line 13; call line 39)
- Delete: `game/engine/houseEffects.ts`
- Delete/modify: tests referencing `houseEffects`/`houseEffectText`
- Test: extend `tests/engine/trios.test.ts` with a stamping test through `simulateBattle` OR a focused `toBattleUnits` test.

**Interfaces:**
- Consumes: `trioEffects` (Task 1), `toBattleUnits` current signature.
- Produces: player `BattleUnit`s carry Trio fields; enemy units never do.

- [ ] **Step 1: Find dead houseEffects references**

Run: `grep -rn 'houseEffects\|houseEffectText' --include='*.ts' --include='*.tsx'`
Record every hit. Expected producers: `simulate.ts:13,39`; the file itself; any test files.

- [ ] **Step 2: Write the failing stamping test**

Add to `tests/engine/trios.test.ts`. `toBattleUnits` currently takes `(team, side, synergies, relics, menace, dr, ignoresTaunt)` — Trio needs the active duos too. Decide the signature extension in Step 4; write the test to the intended API:

```ts
import { toBattleUnits } from '@/game/engine/combat/simulate'

it('stamps Trio on player units only, gated by duos', () => {
  const team = [dw('a', 'Grifondoro'), dw('b', 'Grifondoro'), dw('c', 'Grifondoro')]
  const withDuo = toBattleUnits(team, 'left', [], [], 0, 0, false, [duo])
  expect(withDuo[0]!.cooldownReduction).toBe(1)
  const noDuo = toBattleUnits(team, 'left', [], [], 0, 0, false, [])
  expect(noDuo[0]!.cooldownReduction).toBeUndefined()
  const enemy = toBattleUnits(team, 'right', [], [], 0, 0, false) // no duos passed for right
  expect(enemy[0]!.cooldownReduction).toBeUndefined()
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/engine/trios.test.ts`
Expected: FAIL — `toBattleUnits` arity / `cooldownReduction` undefined.

- [ ] **Step 4: Edit `toBattleUnits`**

In `game/engine/combat/simulate.ts`:

Remove the dead import (line 13): `import { houseEffects } from '../houseEffects'`.
Add: `import { trioEffects } from '../trios'`.

Change the signature to accept player duos (append optional param, defaults keep enemy call sites working):

```ts
export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[], relics: ActiveRelic[] = [], menacePct = 0, damageReduction = 0,
  ignoresTaunt = false, duos: ActiveDuo[] = [],
): BattleUnit[] {
```

Replace the `houseMap` line (39):

```ts
  const trioMap = trioEffects(team, duos)
```

In the `base` object (line 54), replace `...houseMap[dw.wizard.id]` with `...trioMap[dw.wizard.id]`.

- [ ] **Step 5: Pass player duos at the player call site**

In `simulateBattle` (line 87), the left units are the player. Pass `opts.leftDuos`:

```ts
  const L = toBattleUnits(left, 'left', leftSyn, leftRelics, 0, 0, false, opts.leftDuos ?? [])
```

Leave the right/enemy call (line 88) unchanged — no duos arg → no Trio.

- [ ] **Step 6: Delete `houseEffects.ts` and its dead tests**

```bash
git rm game/engine/houseEffects.ts
```
For each test file from Step 1 that only tests `houseEffects`/`houseEffectText`: `git rm` it. For a test file that mixes house-effect tests with live tests: delete only the `houseEffects`/`houseEffectText` describe/it blocks. (`serpeverdeBalance` house-power test, if still present, is dead → remove.)

- [ ] **Step 7: Run trio + full engine suite**

Run: `npx vitest run tests/engine/trios.test.ts`
Expected: PASS.
Run: `npx vitest run`
Expected: PASS — no lingering `houseEffects` import errors. Fix any test still importing the deleted module.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(trio): stamp Trios on player units via leftDuos; delete dead houseEffects"
```

---

## Task 3: Grifondoro Slancio — cooldown −1

**Files:**
- Modify: `game/engine/combat/resolve.ts:27`
- Test: `tests/engine/trios.test.ts`

**Interfaces:**
- Consumes: `actor.cooldownReduction` (Task 1 field, stamped in Task 2).
- Produces: cooldowns set to `max(1, spell.cooldown - reduction)`.

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/trios.test.ts` using the `unit()` builder from the Test Harness section. Pick a real cooldown>0 damage spell — grep `SPELL_BY_ID` / `data/spells` for one with `cooldown: 3` (e.g. `sectumsempra`); call it `CD_SPELL` and assert cooldown lands at `original-1`:

```ts
it('Grifondoro cooldownReduction lowers set cooldown (min 1)', () => {
  const spellId = 'sectumsempra' // verify cooldown > 0 in data/spells
  const spell = SPELL_BY_ID[spellId]!
  const actor = unit('a', spellId, { cooldownReduction: 1 })
  const target = unit('b', 'base_attack', { side: 'right' })
  resolveAction(createRng(1), 1, actor, target, spell)
  expect(actor.cooldowns[spellId]).toBe(spell.cooldown! - 1)
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/engine/trios.test.ts -t cooldownReduction`
Expected: FAIL — cooldown is 3, not 2.

- [ ] **Step 3: Edit `resolve.ts:27`**

Replace:
```ts
  if (spell.cooldown && spell.cooldown > 0) actor.cooldowns[spell.id] = spell.cooldown
```
with:
```ts
  if (spell.cooldown && spell.cooldown > 0) {
    actor.cooldowns[spell.id] = Math.max(1, spell.cooldown - (actor.cooldownReduction ?? 0))
  }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/engine/trios.test.ts -t cooldownReduction`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add game/engine/combat/resolve.ts tests/engine/trios.test.ts
git commit -m "feat(trio): Grifondoro Slancio — spell cooldown -1 (min 1)"
```

---

## Task 4: Serpeverde Opportunista — first hit on full-HP enemy

**Files:**
- Modify: `game/engine/combat/effects.ts` (damage handler, after `cunning` block ~line 56)
- Test: `tests/engine/trios.test.ts`

**Interfaces:**
- Consumes: `actor.firstStrike` (Task 1). Full-HP condition: `target.hp === target.maxHp`.
- Produces: damage ×(1+bonus) when target is at full HP.

Design note: "first strike" = target at full HP. No new per-target state — the moment the target takes any damage it's no longer full, so the bonus naturally applies once (until fully healed again, which is acceptable and thematic).

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/trios.test.ts` using the `unit()` builder. Drive one attack via `resolveAction` at full HP vs the same setup with the target pre-wounded; the full-HP hit must be ~30% larger. Use `base_attack` (cooldown 0, deterministic damage; disable crit variance by using a fixed rng seed and comparing the ratio, or subtract crit by asserting `>` not `===`):

```ts
it('Serpeverde firstStrike amplifies the hit on a full-HP enemy, not a wounded one', () => {
  const mkTarget = (hp: number) => unit('b', 'base_attack', { side: 'right', hp, maxHp: 120 })
  const actorFS = unit('a', 'base_attack', { firstStrike: { bonus: 0.30 } })

  const full = mkTarget(120)
  resolveAction(createRng(7), 1, actorFS, full, SPELL_BY_ID['base_attack']!)
  const dmgFull = 120 - full.hp

  const wounded = mkTarget(119) // not full → no firstStrike
  resolveAction(createRng(7), 1, actorFS, wounded, SPELL_BY_ID['base_attack']!)
  const dmgWounded = 119 - wounded.hp

  expect(dmgFull).toBeGreaterThan(dmgWounded)
})
```
If crit RNG makes the comparison flaky, set `spd` low in `over` and reuse the same seed so both calls roll identically — the only difference is the firstStrike multiplier.

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/engine/trios.test.ts -t firstStrike`
Expected: FAIL — no amplification.

- [ ] **Step 3: Edit the damage handler**

In `game/engine/combat/effects.ts`, in the `damage` handler, right AFTER the `cunning` block (line 53-56) and BEFORE the `coldExecute` block:

```ts
    const fs = ctx.actor.firstStrike
    if (fs && ctx.target.hp === ctx.target.maxHp) {
      dmg = Math.round(dmg * (1 + fs.bonus))
    }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/engine/trios.test.ts -t firstStrike`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add game/engine/combat/effects.ts tests/engine/trios.test.ts
git commit -m "feat(trio): Serpeverde Opportunista — +bonus on the first hit vs a full-HP enemy"
```

---

## Task 5: Tassorosso Tenacia (+1 status duration) via `applyHostileStatus`

**Files:**
- Modify: `game/engine/status.ts` (add helper near `applyStatus`, line 48)
- Test: `tests/engine/trios.test.ts`

**Interfaces:**
- Consumes: `actor.statusDurationBonus` (Task 1), existing `applyStatus(unit, statusId, opts)`.
- Produces: `applyHostileStatus(actor, target, statusId, opts?)` — applies `statusId` to `target` with `duration = (opts.duration ?? def.defaultDuration) + (actor.statusDurationBonus ?? 0)`; returns void. This is the single funnel Task 6 also uses for Corvonero.

- [ ] **Step 1: Write the failing test**

```ts
import { applyHostileStatus } from '@/game/engine/status'

it('applyHostileStatus adds actor.statusDurationBonus to the status duration', () => {
  const actor = unit('a', 'base_attack', { statusDurationBonus: 1 })
  const target = unit('b', 'base_attack', { side: 'right' })
  applyHostileStatus(actor, target, 'stun') // stun defaultDuration = 1
  expect(target.statusEffects.find(e => e.statusId === 'stun')!.remaining).toBe(2)

  const plainActor = unit('c', 'base_attack')
  const t2 = unit('d', 'base_attack', { side: 'right' })
  applyHostileStatus(plainActor, t2, 'stun')
  expect(t2.statusEffects.find(e => e.statusId === 'stun')!.remaining).toBe(1)
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/engine/trios.test.ts -t applyHostileStatus`
Expected: FAIL — export missing.

- [ ] **Step 3: Add `applyHostileStatus` to `status.ts`**

After `applyStatus` (line 72), add:

```ts
/** Apply a HOSTILE status from `actor` to `target`, extending its duration by the actor's
 *  Tassorosso Tenacia bonus (`statusDurationBonus`). Use this at every site where a unit
 *  inflicts a debuff/DoT/control on an enemy so the Trio bonus lands uniformly. */
export function applyHostileStatus(
  actor: BattleUnit, target: BattleUnit, statusId: string,
  opts: { duration?: number; sourceId?: string; maxStacks?: number } = {},
): void {
  const def = STATUS_BY_ID[statusId]
  if (!def) return
  const base = opts.duration ?? def.defaultDuration
  applyStatus(target, statusId, { ...opts, duration: base + (actor.statusDurationBonus ?? 0) })
}
```

Confirm `BattleUnit` and `STATUS_BY_ID` are already imported in `status.ts` (they are — used by `applyStatus`).

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/engine/trios.test.ts -t applyHostileStatus`
Expected: PASS.

- [ ] **Step 5: Route existing hostile-status sites through the helper (scoped)**

The +1 only matters where a **Trio-carrying player actor** inflicts a hostile status. The cleanest high-value site is spell/effect application of debuffs & control. Grep the inline status-application sites in the effect layer:

Run: `grep -rn "applyStatus(" game/engine/combat/ game/engine/*.ts | grep -v 'applyStatus(unit'`

For each site where `ctx.actor` applies a debuff/DoT/control to `ctx.target` (an enemy), swap `applyStatus(target, id, opts)` → `applyHostileStatus(actor, target, id, opts)`. Do NOT touch: self-buffs, ally-targeted (regen/shield), the `applyStatus` internals, veleno-from-Duo paths that don't have an actor. Keep the change minimal — if a site's actor isn't a `BattleUnit` in scope, leave it (Tassorosso simply won't extend that niche source; document it in the commit).

- [ ] **Step 6: Run full engine suite**

Run: `npx vitest run`
Expected: PASS. If a replay/score fixture shifts because a status now lasts longer under a Tassorosso Trio, that's expected only when a Trio is active in the fixture team — most fixtures have no Trio, so scores should be stable. Investigate any shift before updating a fixture.

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add game/engine/status.ts game/engine/combat/ tests/engine/trios.test.ts
git commit -m "feat(trio): Tassorosso Tenacia — hostile statuses last +1 via applyHostileStatus"
```

---

## Task 6: Corvonero Analisi — apply expose on every hit

**Files:**
- Modify: `game/engine/combat/effects.ts` (damage handler, after damage lands)
- Test: `tests/engine/trios.test.ts`

**Interfaces:**
- Consumes: `actor.analysis` (Task 1), `applyHostileStatus` (Task 5 — so Tassorosso+Corvonero compose: exposes from a Tassorosso-flavored team last longer, the documented hot-spot).
- Produces: on each landed hit by a Corvonero-Trio actor, target gains one `expose` stack.

- [ ] **Step 1: Write the failing test**

```ts
it('Corvonero analysis applies an expose stack on hit', () => {
  const actor = unit('a', 'base_attack', { analysis: { exposeId: 'expose1' } })
  const target = unit('b', 'base_attack', { side: 'right' })
  resolveAction(createRng(1), 1, actor, target, SPELL_BY_ID['base_attack']!)
  expect(target.statusEffects.some(e => e.statusId === 'expose1')).toBe(true)
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/engine/trios.test.ts -t analysis`
Expected: FAIL — no expose applied.

- [ ] **Step 3: Edit the damage handler**

In `game/engine/combat/effects.ts` damage handler, AFTER the hit resolves (after `absorbDamage`/the reflect block, near where the value is finalized — but only when the hit actually connected, i.e. not dodged and dmg computed). Add:

```ts
    const an = ctx.actor.analysis
    if (an) applyHostileStatus(ctx.actor, ctx.target, an.exposeId, { sourceId: sourceId(ctx.actor) })
```

Ensure `applyHostileStatus` is imported from `../status` at the top of `effects.ts` (line 6 already imports from `../status` — add it to that import list). Place the call where `ctx.target.side !== ctx.actor.side` is already guaranteed (inside the damage handler, after the friendly-fire guard at line 41).

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/engine/trios.test.ts -t analysis`
Expected: PASS.

- [ ] **Step 5: Run full engine suite + typecheck**

Run: `npx vitest run` → PASS.
Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/effects.ts tests/engine/trios.test.ts
git commit -m "feat(trio): Corvonero Analisi — apply expose on every hit (composes with Tenacia)"
```

---

## Task 7: UI — surface active Trios

**Files:**
- Create: `game/engine/trioText.ts`
- Modify: the Duo/synergy panel component (find it — grep below)
- Test: existing panel test file, or a light render assertion.

**Interfaces:**
- Consumes: `trioEffects` (Task 1), team + active duos as the panel already has them.
- Produces: `trioText(house, grade)` string; a Trio row/section in the panel.

- [ ] **Step 1: Locate the panel**

Run: `grep -rln 'Duo\|duoProgress\|SIGNAL_LABEL' components/ src/ --include='*.tsx' | head`
Pick the run/draft panel that lists Duos (likely a `DuoPanel`/`SynergyTracker`). Read it to match its row style.

- [ ] **Step 2: Write `trioText.ts`**

```ts
import type { House } from '@/types'

/** UI copy per house Trio at a grade (0 = 3 members, 1 = 4+). Derived from trios.ts numbers. */
export function trioText(house: House, grade: 0 | 1): string {
  switch (house) {
    case 'Serpeverde': return `Opportunista: +${grade === 1 ? 45 : 30}% al primo colpo su un nemico intatto`
    case 'Corvonero':  return `Analisi: ogni colpo applica Vulnerabilità (−${grade === 1 ? 25 : 15}% difesa)`
    case 'Tassorosso': return 'Tenacia: gli status che infliggi durano +1 turno'
    case 'Grifondoro': return 'Slancio: cooldown delle tue spell −1'
  }
}
```

- [ ] **Step 3: Render active Trios in the panel**

In the panel, compute `const trios = trioEffects(livingTeam, activeDuos)` and, grouped by house (each house appears once), render a row per active house using `trioText(house, grade)`. Reuse the Duo row markup/classes. Guard against an empty map (render nothing, no crash). Show the gate hint when 3+ same-house exist but no Duo is active ("Attiva un Duo per sbloccare il Trio") only if it's cheap; otherwise skip (fuori scope).

- [ ] **Step 4: Verify render**

Run the panel's existing test file (grep its name) or add a light assertion that an active-Trio team shows the Trio copy. `npx vitest run <panel test>` → PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add game/engine/trioText.ts components/ src/
git commit -m "feat(trio): surface active Trios in the Duo/synergy panel"
```

---

## Task 8: Balance — measure and tune

**Files:**
- Modify (only if tuning): `game/engine/trios.ts` numbers.
- Read: `tests/engine/campaignBalanceB`.

- [ ] **Step 1: Measure baseline with Trios in**

Run: `npx vitest run tests/engine/campaignBalanceB`
Record the reported winRate. Compare to band `[0.15, 0.45]` and the ~0.375 pre-Trio baseline.

- [ ] **Step 2: Decide**

- In band → done, document the number in a comment at the top of `trios.ts`.
- Overshoots 0.45 → lower the Trio numbers (Serpeverde bonus, Corvonero expose grade, or drop a grade). Re-measure ONCE.
- If one lever tweak doesn't bring it back, or Corvonero×Tassorosso is clearly dominating (check the hot-spot: a mixed team where Tenacia keeps expose stacks alive) → **STOP and report the numbers to the user.** Do not silently pile on lever changes.

- [ ] **Step 3: Full suite + typecheck**

Run: `npx vitest run` → PASS (all ~1401+ tests).
Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add game/engine/trios.ts
git commit -m "balance(trio): campaignBalanceB re-measured at <X>; Trio numbers tuned to band"
```

---

## Task 9: Final review + merge

- [ ] **Step 1:** Run `npx vitest run` and `npx tsc --noEmit` — both green.
- [ ] **Step 2:** REQUIRED SUB-SKILL: `superpowers:requesting-code-review` (or `/code-review high`) on the full branch diff. Address findings.
- [ ] **Step 3:** REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch` — merge to master, push (memory: push without asking when work is done).
