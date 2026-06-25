# Battle Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop dead units being healed/revived, stop wasting control on already-controlled enemies, fix the still-clipped initiative rail, and surface failed attacks in the log.

**Architecture:** Two engine fixes (`targeting.ts`, `effects.ts`, `simulate.ts` wiring) and two UI fixes (`InitiativeBar.tsx`, `BattleLog.tsx`). Engine changes are deterministic; balance is re-measured and the floor re-based if it moved.

**Tech Stack:** Next.js (custom fork — read `node_modules/next/dist/docs/` before any Next-specific code), React, TypeScript, framer-motion, Tailwind, Vitest + Testing Library.

## Global Constraints

- Test runner: `npm run test` (Vitest). **Vitest does NOT typecheck** — after any `.ts`/`.tsx` edit, run `npx tsc --noEmit` and confirm 0 errors. ALWAYS run the FULL suite (`npm run test`), not just named files — a prior task missed real failures by running only named suites.
- All user-facing copy is **Italian**.
- Engine changes must be **deterministic** (no `Math.random`/`Date.now`; use the seeded `Rng` only where already used). The control-targeting filter is applied before the existing deterministic sort so it draws no rng.
- Known flaky tests: `tests/ui/playFlow.test.tsx` and `tests/ui/campaignRunner.test.tsx` are parallel-timeout flakes that PASS in isolation (`npx vitest run <file>`). If one is the only red, confirm isolated, then it's fine. Any OTHER red is real.
- Commit after every task. Work on `master`; a concurrent writer may commit to master mid-session — verify `git rev-parse HEAD` before each commit and never `--amend` a commit no longer at HEAD. Push only at the final task.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `game/engine/combat/targeting.ts` | `mostWounded` alive-filter; control-aware `selectTarget` + `appliesControl` helper | Modify |
| `game/engine/combat/effects.ts` | `heal` no-op on dead target | Modify |
| `game/engine/combat/simulate.ts` | pass `spell` to `selectTarget` | Modify |
| `components/battle/BattleLog.tsx` | failed-attack log copy | Modify |
| `components/battle/InitiativeBar.tsx` | vertical slot, no horizontal clip | Modify |
| `tests/engine/campaignBalance.test.ts` | re-base floor if balance moved | Modify (maybe) |

---

## Task 1: Dead units can't be healed/revived

**Files:**
- Modify: `game/engine/combat/targeting.ts` (`mostWounded`)
- Modify: `game/engine/combat/effects.ts` (`heal` handler)
- Test: `tests/engine/deadHealGuard.test.ts` (create)

**Interfaces:**
- Consumes: `BattleUnit` (has `hp`, `maxHp`, `alive`), `EFFECT_HANDLERS.heal`, `mostWounded`.
- Produces: `mostWounded` only returns alive wounded units; `heal` is a no-op (`{ value: 0 }`, no `heal` flag, no hp change) when `target.alive` is false.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/deadHealGuard.test.ts`:

```ts
import { it, expect } from 'vitest'
import { mostWounded } from '@/game/engine/combat/targeting'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import type { BattleUnit } from '@/types'

function u(id: string, hp: number, maxHp = 100): BattleUnit {
  return {
    wizard: { id }, side: 'left', hp, maxHp, alive: hp > 0,
    statusEffects: [], cooldowns: {}, buffedStats: { hp: maxHp, atk: 10, def: 10, spd: 10 },
  } as unknown as BattleUnit
}

it('mostWounded never returns a dead unit', () => {
  const dead = u('dead', 0)
  const hurt = u('hurt', 40)
  expect(mostWounded([dead, hurt])?.wizard.id).toBe('hurt')
})

it('mostWounded returns undefined when only dead units are wounded', () => {
  expect(mostWounded([u('d1', 0), u('d2', 0)])).toBeUndefined()
})

it('heal is a no-op on a dead target (no revive, no heal flag)', () => {
  const dead = u('dead', 0)
  const flags: string[] = []
  const ctx = { rng: {} as any, turn: 1, actor: dead, target: dead, flags: flags as any }
  const r = EFFECT_HANDLERS.heal(ctx as any, { kind: 'heal', amount: 28 } as any)
  expect(dead.hp).toBe(0)
  expect(r.value).toBe(0)
  expect(flags).not.toContain('heal')
})

it('heal still works on a living wounded target', () => {
  const hurt = u('hurt', 40)
  const flags: string[] = []
  const ctx = { rng: {} as any, turn: 1, actor: hurt, target: hurt, flags: flags as any }
  EFFECT_HANDLERS.heal(ctx as any, { kind: 'heal', amount: 28 } as any)
  expect(hurt.hp).toBe(68)
  expect(flags).toContain('heal')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- deadHealGuard`
Expected: FAIL — `mostWounded` returns the dead unit; `heal` revives it (hp 28, value 28, heal flag pushed).

- [ ] **Step 3: Fix `mostWounded`**

In `game/engine/combat/targeting.ts`, change `mostWounded` to require `alive`:

```ts
export function mostWounded(units: BattleUnit[]): BattleUnit | undefined {
  const wounded = units.filter(u => u.alive && u.hp < u.maxHp)
  return wounded.sort((a, b) =>
    (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}
```

- [ ] **Step 4: Fix the `heal` handler**

In `game/engine/combat/effects.ts`, add a dead-target guard at the top of the `heal` handler (before computing amount):

```ts
  heal: (ctx, eff) => {
    if (eff.kind !== 'heal') return {}
    if (!ctx.target.alive) return { value: 0 } // never heal/revive a dead unit
    let amount = eff.amount
    if (ctx.bus) {
      const hc: HookCtx = { turn: ctx.turn, actor: ctx.actor, target: ctx.target, side: ctx.target.side, flags: ctx.flags }
      amount = Math.round(ctx.bus.emitModifier('modifyHealing', amount, hc))
    }
    ctx.target.hp = Math.min(ctx.target.maxHp, ctx.target.hp + amount)
    ctx.flags.push('heal')
    return { value: amount }
  },
```

- [ ] **Step 5: Run, verify pass**

Run: `npm run test -- deadHealGuard` → 4/4 PASS

- [ ] **Step 6: Full suite + typecheck**

Run: `npm run test` → note any newly-failing seed-pinned battle/balance test (expected — targeting/heal changed outcomes; campaignBalance is re-based in Task 5). Record which fail.
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add game/engine/combat/targeting.ts game/engine/combat/effects.ts tests/engine/deadHealGuard.test.ts
git commit -m "fix(combat): never heal or revive a dead unit (mostWounded + heal guards)"
```

---

## Task 2: Control-aware targeting (don't re-stun the already-stunned)

**Files:**
- Modify: `game/engine/combat/targeting.ts` (`selectTarget` + new `appliesControl`)
- Modify: `game/engine/combat/simulate.ts:166` (pass `spell`)
- Test: `tests/engine/controlTargeting.test.ts` (create)

**Interfaces:**
- Consumes: `Spell`, `normalizeSpell` from `@/game/engine/combat/normalizeSpell`, `STATUS_BY_ID` from `@/data/statuses`, `BattleUnit`.
- Produces: `appliesControl(spell: Spell): Set<string>` returning the control kinds (`'stun'|'freeze'|'silence'|'disarm'`) a spell applies. `selectTarget(actor, allies, enemies, spell?)` — when `spell` applies control, it prefers enemies not already under any of those control kinds, falling back to the full pool when all are controlled.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/controlTargeting.test.ts`:

```ts
import { it, expect } from 'vitest'
import { appliesControl, selectTarget } from '@/game/engine/combat/targeting'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit } from '@/types'

function enemy(id: string, opts: { stunned?: boolean; threat?: number } = {}): BattleUnit {
  const atk = opts.threat ?? 10
  return {
    wizard: { id, role: 'Attaccante' }, side: 'right', hp: 100, maxHp: 100, alive: true,
    statusEffects: opts.stunned ? [{ kind: 'stun', statusId: 'stun', remaining: 1 }] : [],
    cooldowns: {}, buffedStats: { hp: 100, atk, def: 10, spd: 10 },
  } as unknown as BattleUnit
}
const actor = { wizard: { id: 'a', role: 'Attaccante' }, side: 'left' } as unknown as BattleUnit

it('appliesControl detects stun on Stupeficium', () => {
  expect(appliesControl(SPELL_BY_ID['stupeficium']!).has('stun')).toBe(true)
})
it('appliesControl is empty for a pure-damage spell', () => {
  expect(appliesControl(SPELL_BY_ID['reducto'] ?? SPELL_BY_ID['flipendo']!).size).toBe(0)
})

it('a stun spell skips an already-stunned enemy when another valid target exists', () => {
  const stunned = enemy('stunned', { stunned: true, threat: 100 }) // highest threat but already stunned
  const fresh = enemy('fresh', { threat: 50 })
  const t = selectTarget(actor, [], [stunned, fresh], SPELL_BY_ID['stupeficium']!)
  expect(t?.wizard.id).toBe('fresh')
})

it('a stun spell falls back to the full pool when ALL enemies are stunned', () => {
  const s1 = enemy('s1', { stunned: true, threat: 100 })
  const s2 = enemy('s2', { stunned: true, threat: 50 })
  const t = selectTarget(actor, [], [s1, s2], SPELL_BY_ID['stupeficium']!)
  expect(t).toBeTruthy() // still attacks someone (highest threat)
  expect(t?.wizard.id).toBe('s1')
})

it('a non-control spell ignores stun state (targets by threat)', () => {
  const stunned = enemy('stunned', { stunned: true, threat: 100 })
  const fresh = enemy('fresh', { threat: 50 })
  const t = selectTarget(actor, [], [stunned, fresh], SPELL_BY_ID['flipendo']!)
  expect(t?.wizard.id).toBe('stunned') // highest threat, control state irrelevant
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- controlTargeting`
Expected: FAIL — `appliesControl` undefined; `selectTarget` takes 3 args and ignores control.

- [ ] **Step 3: Add `appliesControl` + thread control filtering into `selectTarget`**

In `game/engine/combat/targeting.ts`, add imports at the top:

```ts
import type { BattleUnit, Spell } from '@/types'
import { normalizeSpell } from './normalizeSpell'
import { STATUS_BY_ID } from '@/data/statuses'
```

(Keep the existing `BALANCE`/`effectiveStats` imports.)

Add the helper + an "is controlled" check:

```ts
const CONTROL_KINDS = new Set(['stun', 'freeze', 'silence', 'disarm'])

/** The set of control kinds a spell applies to its enemy target (empty for non-control spells). */
export function appliesControl(spell: Spell): Set<string> {
  const out = new Set<string>()
  for (const eff of normalizeSpell(spell)) {
    if (eff.kind !== 'applyStatus' || eff.target !== 'enemy') continue
    const kind = eff.statusId ? STATUS_BY_ID[eff.statusId]?.kind : eff.effect?.kind
    if (kind && CONTROL_KINDS.has(kind)) out.add(kind)
  }
  return out
}

/** True if `unit` already has an active status of any kind in `kinds`. */
function underAnyControl(unit: BattleUnit, kinds: Set<string>): boolean {
  return unit.statusEffects.some(e => {
    const k = e.statusId ? STATUS_BY_ID[e.statusId]?.kind : e.kind
    return !!k && kinds.has(k)
  })
}
```

Then change `selectTarget` to accept the spell and pre-filter the enemy pool for control spells:

```ts
export function selectTarget(
  actor: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  spell?: Spell,
): BattleUnit | undefined {
  const liveEnemies = enemies.filter(e => e.alive)
  const liveAllies = allies.filter(a => a.alive)

  // Control spells prefer enemies not already under that control; if everyone is
  // controlled, fall back to the full live pool (still attack, no wasted priority).
  const control = spell ? appliesControl(spell) : new Set<string>()
  const enemyPool = control.size > 0
    ? (liveEnemies.filter(e => !underAnyControl(e, control)).length
        ? liveEnemies.filter(e => !underAnyControl(e, control))
        : liveEnemies)
    : liveEnemies

  switch (actor.wizard.role) {
    case 'Supporto':
      return mostWounded(liveAllies) ?? lowestHp(enemyPool)
    case 'Controllo':
      return backlineTarget(enemyPool)
    case 'Tank':
      return lowestHp(enemyPool)
    case 'Attaccante':
    default:
      return highestThreat(enemyPool)
  }
}
```

(The existing `lowestHp`/`highestThreat`/`backlineTarget` helpers take a unit array — feed them `enemyPool`.)

- [ ] **Step 4: Thread `spell` from simulate**

In `game/engine/combat/simulate.ts`, the call is `const target = selectTarget(actor, allies, enemies)` at line 166, AFTER `const spell = selectSpell(actor)` (line 164). Pass the spell:

```ts
      const target = selectTarget(actor, allies, enemies, spell)
```

- [ ] **Step 5: Run, verify pass**

Run: `npm run test -- controlTargeting` → PASS (5/5)

- [ ] **Step 6: Full suite + typecheck**

Run: `npm run test` → record any newly-failing seed-pinned battle/balance test (expected; campaignBalance re-based in Task 5).
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add game/engine/combat/targeting.ts game/engine/combat/simulate.ts tests/engine/controlTargeting.test.ts
git commit -m "fix(combat): control spells avoid already-controlled enemies (no wasted stun)"
```

---

## Task 3: Initiative rail — vertical slot, no clip

**Files:**
- Modify: `components/battle/InitiativeBar.tsx`
- Test: `tests/ui/initiativeBar.test.tsx` (extend)

**Interfaces:** none new. Each slot becomes a vertical stack (face on top, `⚡spd` + ▲/▼ under it) so its intrinsic width fits the narrow column; the rail has no horizontal clip.

- [ ] **Step 1: Write the failing assertion**

In `tests/ui/initiativeBar.test.tsx`, add:

```tsx
it('lays each slot as a vertical stack (fits the narrow column, no clip)', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  const slot = container.querySelector('[data-side]') as HTMLElement
  // Vertical stack: the slot uses flex-col so face + spd line stack, keeping width within the column.
  expect(slot.className).toMatch(/flex-col/)
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- initiativeBar`
Expected: FAIL — the slot is currently a horizontal `flex items-center` row.

- [ ] **Step 3: Make the slot vertical**

In `components/battle/InitiativeBar.tsx`, change each slot's wrapper from the horizontal row to a centered vertical stack, and drop the inner two-column layout. The slot `motion.div` className becomes:

```tsx
            className="relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-1"
```

Inside it, render the face, then a compact line with the ▲/▼ glyph + `⚡spd` beneath:

```tsx
            <div className={cn('relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2', ring, isCurrent && 'ring-4')}>
              <PortraitImage id={u.id} house={u.house} alt={u.name} variant="bust" />
            </div>
            <span className="flex items-center gap-0.5 text-[9px] tabular-nums text-white/60 leading-none">
              <span aria-hidden className={mine ? 'text-emerald-300' : 'text-rose-300'}>{mine ? '▲' : '▼'}</span>
              <Zap className="h-2.5 w-2.5 text-amber-300/80" aria-hidden />{u.spd}
            </span>
            {isCurrent && (
              <span data-role="ora-label" className="absolute -top-1 right-0 rounded bg-white/15 px-1 text-[7px] uppercase tracking-widest text-white/80">Ora</span>
            )}
```

(Keep the `data-side={u.side}`, `data-current`, the `mine`/`ring` computations, and the `motion.div` animate/transition. Remove the old min-w-0 text column that held a separate name/spd block — the name was already removed in a prior change, so only the spd/glyph line remains.)

Also confirm the rail container does not clip horizontally (it should already be `w-full ... overflow-y-auto` with no `overflow-x` clip — leave it).

- [ ] **Step 4: Run, verify pass + battle suite**

Run: `npm run test -- initiativeBar` → PASS
Run: `npm run test -- "tests/ui/battle"` → green (update any battle test asserting the old horizontal slot layout, keeping it meaningful)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/InitiativeBar.tsx tests/ui/initiativeBar.test.tsx tests/
git commit -m "fix(battle-ui): vertical initiative slots so the rail never clips"
```

---

## Task 4: Surface failed attacks in the log

**Files:**
- Modify: `components/battle/BattleLog.tsx` (`describeEntry`)
- Test: `tests/ui/battleLogFail.test.tsx` (create)

**Interfaces:**
- Consumes: `LogEntry` (has `flags`, `value`, `type`, `action`). A failed action is an attack/control entry that did NO damage and was not a heal/block — surfaced via the existing data (value 0/undefined, no `heal`/`block`/`dodge`).
- Produces: `describeEntry` returns an explicit Italian "fail" sentence for a wasted offensive action.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/battleLogFail.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'
import type { LogEntry } from '@/types'

const names = { 'left:a': 'Aaa', 'right:x': 'Xxx' }

it('narrates a dodge as a miss', () => {
  const e = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'Stupeficium', type: 'Attacco', value: 0, flags: ['dodge'] } as unknown as LogEntry
  expect(describeEntry(e, names)).toMatch(/schiva/i)
})

it('narrates a wasted offensive action (0 damage, no effect) as a failure', () => {
  // An Attacco/Controllo entry with no value and no heal/block/dodge flag = it did nothing.
  const e = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'Imperio', type: 'Controllo', value: 0, flags: [] } as unknown as LogEntry
  expect(describeEntry(e, names)).toMatch(/non ha effetto|fallisce/i)
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- battleLogFail`
Expected: FAIL — the second case currently falls through to "lancia Imperio su Xxx" with no failure wording.

- [ ] **Step 3: Add the fail branch to `describeEntry`**

In `components/battle/BattleLog.tsx`, the dodge branch already exists (`flags.includes('dodge')` → "schiva"). Add a fail branch for a wasted offensive action — AFTER the dodge/block/Difesa branches and BEFORE the final damage line. Insert:

```ts
  // An offensive action (Attacco/Controllo) that dealt no damage and applied nothing
  // visible reads as a failure — surface it instead of a flat "lancia X".
  if ((entry.type === 'Attacco' || entry.type === 'Controllo')
      && !(typeof entry.value === 'number' && entry.value > 0)
      && !entry.flags.includes('heal') && !entry.flags.includes('block')) {
    return `${actor} lancia ${entry.action} ma non ha effetto su ${target ?? 'il bersaglio'}`
  }
```

(Place it right before the `const crit = …` / final positive-value return so the positive-damage path is unaffected. The dodge branch above already returned for dodges, so this only catches non-dodge zero-effect offensive actions.)

- [ ] **Step 4: Run, verify pass + suite**

Run: `npm run test -- battleLogFail` → PASS
Run: `npm run test -- "tests/ui/battleLog"` and `npm run test -- "tests/ui/battle"` → green (a prior test may assert the old flat "lancia X" for a zero-value control entry; update it to the new "non ha effetto" copy, keeping it meaningful)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/BattleLog.tsx tests/ui/battleLogFail.test.tsx tests/
git commit -m "feat(battle-ui): narrate a wasted/failed offensive action in the log"
```

---

## Task 5: Re-measure + re-base campaign balance

**Files:**
- Modify: `tests/engine/campaignBalance.test.ts` (only if the floor moved)

**Interfaces:** consumes the new combat behavior (Tasks 1-2).

- [ ] **Step 1: Run the balance test**

Run: `npm run test -- campaignBalance`
If green → the engine changes didn't move it below the floor; SKIP to Step 4 (no change needed, just confirm determinism).
If red → continue.

- [ ] **Step 2: Measure the new rates deterministically**

Create a throwaway measurement (do NOT commit it): copy the campaign-simulation helper pattern from `tests/engine/campaignBalance.test.ts` into a temp test `tests/_measure.test.ts` that runs `simulateCampaigns(300)` and `throw new Error('MEASURED ' + JSON.stringify(stats))`. Run:

```bash
npx vitest run tests/_measure.test.ts 2>&1 | grep -oE "MEASURED \{[^}]*\}"
rm tests/_measure.test.ts
```

Record clearRate / bossWinRate / firstStageWinRate / cappedRate.

- [ ] **Step 3: Re-base the floor with documented margin**

In `tests/engine/campaignBalance.test.ts`, adjust the relevant floor (`clearRate` and/or `bossWinRate`) to sit comfortably below the measured value (≈ half the measured clearRate, matching the file's existing methodology), and extend the comment with the date (2026-06-25), the new measured numbers, and the cause ("no-dead-heal + control-aware targeting changed outcomes"). Do NOT weaken the upper bound or the intent (still winnable, not a pushover).

- [ ] **Step 4: Verify determinism**

Run: `npm run test -- campaignBalance` three times → identical result each time (no flake).
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add tests/engine/campaignBalance.test.ts
git commit -m "test(balance): re-base floor after no-dead-heal + control-aware targeting"
```

(If Step 1 was green and no change was needed, skip the commit; note it in the report.)

---

## Task 6: Fix downstream seed-pinned fixtures + final verification + push

**Files:**
- Modify: any seed-coupled battle/relic test that broke from the engine changes.

- [ ] **Step 1: Identify remaining failures**

Run: `npm run test 2>&1 | grep -E "FAIL|✗|×"`
For each red that is NOT the known playFlow/campaignRunner flake (confirm those isolated), open it. Likely candidates: `relicCombat` (seed-coupled), any battle test asserting a specific log line / target. Fix each by updating the seed or the assertion to the new deterministic reality — NEVER weaken a test to vacuous. Where a fixture relied on a heal-on-dead or a specific control target, update it to reflect the corrected behavior.

- [ ] **Step 2: Full suite green**

Run: `npm run test` → all green except known flakes (confirm each isolated with `npx vitest run tests/ui/<file>`).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit (if fixtures changed) + confirm HEAD + push**

```bash
git add tests/
git commit -m "test(combat): update seed-coupled fixtures for corrected heal/targeting"
git rev-parse HEAD
git log --oneline -8
git push origin master
```

(Verify HEAD is this session's work before pushing — concurrent writer possible. If Step 1 found nothing to fix, skip the commit and just push the prior tasks.)

---

## Self-Review notes

- **Spec coverage:** Fix 1 → Task 1; Fix 2 → Task 2; Fix 3 → Task 3; Fix 4 → Task 4; balance re-base → Task 5; downstream fixtures + verify → Task 6. All covered.
- **Type consistency:** `mostWounded(units)` signature unchanged (Task 1) — its callers in `simulate.ts`/`targeting.ts` pass arrays already. `selectTarget` gains an optional 4th param `spell?` (Task 2) — the only caller (`simulate.ts:166`) is updated in the same task; the optional default keeps any other caller valid. `appliesControl(spell): Set<string>` defined + consumed within Task 2. `describeEntry` signature unchanged (Task 4 adds a branch, not a param).
- **Determinism:** the control filter (Task 2) runs before the existing deterministic sort and draws no rng; the heal guard (Task 1) is pure. Engine changes DO move outcomes → Tasks 5 (balance) + 6 (fixtures) absorb that.
- **Ordering:** engine fixes (1,2) first; UI (3,4) independent; balance (5) after engine; fixtures+verify (6) last.
- **Full-suite discipline:** every engine task explicitly says run the FULL suite and record new reds (a prior task missed failures by running only named files).
- **No new RNG / no revive mechanic / no hitChance miss** — per spec non-goals.
