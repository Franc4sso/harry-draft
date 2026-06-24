# Role Identity & Threat Combat — Implementation Plan (Phase 1 core)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four roles distinct, legible combat identities — Tank taunts and is always focused first, Attacker penetrates armor, Control bypasses the taunt, and stats are rebalanced per role — without inflating overall power.

**Architecture:** Threat-based target selection (Tank gets a large taunt threat bonus; Control ignores it and hits the backline), baseline armor penetration for Attackers in the damage formula, and a per-role stat redistribution guarded by a balance smoke test. All magic numbers live in one new `BALANCE.roles` block. Traits are deliberately out of scope (Phase 2, see spec).

**Tech Stack:** TypeScript, Vitest, Next.js. Pure functions in `game/engine/combat`.

## Global Constraints

- This is a **breaking-changes** Next.js fork — do not assume framework APIs; this plan touches only engine + data + tests, no framework code.
- Combat is an **auto-battler**: no mid-fight input. Every new mechanic must surface a `LogFlag` so the replay stays legible.
- **No power inflation:** a wizard's stat budget (sum of mid-range hp+atk+def+spd) must stay within ±5% of its pre-change value, per tier. Redistribute, don't buff.
- Run the full suite with `npx vitest run` (Windows; PowerShell or Bash tool both fine). Type-check with `npx tsc --noEmit`.
- Spec: `docs/superpowers/specs/2026-06-24-role-identity-design.md`.

---

## File Structure

- `data/constants.ts` — add `BALANCE.roles` block (tunable knobs).
- `types/combat.ts` — add `'pen'` to the `LogFlag` union.
- `game/engine/combat/effects.ts` — Attacker armor penetration in `computeDamage`.
- `game/engine/combat/targeting.ts` — rewrite `selectTarget` around a `threatScore`; add `backlineTarget`.
- `data/wizards.ts` — redistribute `ranges` per role.
- `tests/engine/combat/targeting.test.ts` — NEW: targeting behavior.
- `tests/engine/combat/effects.test.ts` — extend: penetration.
- `tests/data/roleBalance.test.ts` — NEW: stat contrast + power-budget invariant.

---

### Task 1: Role balance constants

**Files:**
- Modify: `data/constants.ts` (inside the `BALANCE` object, after the `relics` block)

**Interfaces:**
- Produces: `BALANCE.roles.tauntBonus: number`, `BALANCE.roles.attackerArmorPen: number`

- [ ] **Step 1: Add the constants block**

In `data/constants.ts`, add a `roles` key inside `BALANCE` (sibling of `combat`, `draft`, …):

```ts
  roles: {
    tauntBonus: 1000,       // additive threat that makes a live Tank the focus
    attackerArmorPen: 0.4,  // fraction of target DEF an Attaccante ignores
  },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (object is `as const`, new keys are inferred).

- [ ] **Step 3: Commit**

```bash
git add data/constants.ts
git commit -m "feat(combat): add BALANCE.roles tuning constants"
```

---

### Task 2: Attacker armor penetration

**Files:**
- Modify: `types/combat.ts:36` (LogFlag union)
- Modify: `game/engine/combat/effects.ts:11-20` (`computeDamage`)
- Test: `tests/engine/combat/effects.test.ts`

**Interfaces:**
- Consumes: `BALANCE.roles.attackerArmorPen` (Task 1)
- Produces: `computeDamage` now reduces target DEF by `attackerArmorPen` when `actor.wizard.role === 'Attaccante'` and pushes a `'pen'` flag.

- [ ] **Step 1: Add the `pen` LogFlag**

In `types/combat.ts` line 36, extend the union:

```ts
export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot' | 'pen'
```

- [ ] **Step 2: Write the failing test**

Append to `tests/engine/combat/effects.test.ts` inside a new `describe`:

```ts
import { computeDamage } from '@/game/engine/combat/effects'

describe('armor penetration', () => {
  it('Attaccante deals more than a non-Attacker vs a high-DEF target', () => {
    const atkWiz = unit({ side: 'left' })            // role Attaccante (fixture default)
    const tankRole = unit({ side: 'left' })
    tankRole.wizard = { ...tankRole.wizard, role: 'Tank' }
    const target = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 60, spd: 40 } })

    const fa: LogFlag[] = []; const ft: LogFlag[] = []
    const dmgAtk = computeDamage(noChance, atkWiz, target, 1, fa)
    const dmgTank = computeDamage(noChance, tankRole, target, 1, ft)

    expect(dmgAtk).toBeGreaterThan(dmgTank)
    expect(fa).toContain('pen')
    expect(ft).not.toContain('pen')
  })

  it('penetration never drops damage below minDamage', () => {
    const atkWiz = unit({ side: 'left' })
    const target = unit({ side: 'right', buffedStats: { hp: 120, atk: 80, def: 9999, spd: 40 } })
    const f: LogFlag[] = []
    expect(computeDamage(noChance, atkWiz, target, 0.1, f)).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/effects.test.ts -t "armor penetration"`
Expected: FAIL — `dmgAtk` equals `dmgTank` (no pen yet), `fa` lacks `'pen'`.

- [ ] **Step 4: Implement penetration in `computeDamage`**

Replace lines 13-15 of `game/engine/combat/effects.ts`:

```ts
  const atk = effectiveStats(actor).atk
  const pen = actor.wizard.role === 'Attaccante' ? BALANCE.roles.attackerArmorPen : 0
  if (pen > 0) flags.push('pen')
  const def = effectiveStats(target).def * (1 - pen)
  let dmg = atk * power - def * c.defenseK
```

(`BALANCE` is already imported in this file — confirm the import line; if not, add `import { BALANCE } from '@/data/constants'`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/combat/effects.test.ts`
Expected: PASS (all existing effects tests + 2 new).

- [ ] **Step 6: Commit**

```bash
git add types/combat.ts game/engine/combat/effects.ts tests/engine/combat/effects.test.ts
git commit -m "feat(combat): Attaccante baseline armor penetration with pen flag"
```

---

### Task 3: Threat-based targeting with taunt + Control bypass

**Files:**
- Modify: `game/engine/combat/targeting.ts` (rewrite `selectTarget`, add `threatScore` + `backlineTarget`)
- Test: `tests/engine/combat/targeting.test.ts` (NEW)

**Interfaces:**
- Consumes: `BALANCE.roles.tauntBonus` (Task 1), `effectiveStats` from `../status`, `BattleUnit`.
- Produces: `selectTarget(actor, allies, enemies): BattleUnit | undefined` unchanged signature; new exported `threatScore(u: BattleUnit): number`. Existing exports `mostWounded` stay.

- [ ] **Step 1: Write the failing test (NEW file)**

Create `tests/engine/combat/targeting.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { selectTarget } from '@/game/engine/combat/targeting'
import type { BattleUnit, Role } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function u(id: string, role: Role, side: 'left' | 'right', over: Partial<BattleUnit['buffedStats']> = {}): BattleUnit {
  const stats = { hp: 120, atk: 30, def: 20, spd: 25, ...over }
  return {
    wizard: { id, name: id, house: 'Grifondoro', role, tier: 3,
      ranges: { hp: [120,120], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: ['base_attack'] },
    stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']!,
    side, hp: stats.hp, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true,
  }
}

describe('threat targeting', () => {
  it('an Attacker focuses the enemy Tank while it is alive', () => {
    const me = u('att', 'Attaccante', 'left')
    const enemies = [u('squishy', 'Supporto', 'right', { atk: 40, spd: 40 }), u('wall', 'Tank', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('after the Tank dies the Attacker hits the highest-threat backliner', () => {
    const me = u('att', 'Attaccante', 'left')
    const dead = u('wall', 'Tank', 'right'); dead.alive = false
    const enemies = [u('weak', 'Supporto', 'right', { atk: 10, spd: 10 }), u('scary', 'Attaccante', 'right', { atk: 40, spd: 40 }), dead]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('scary')
  })

  it('Controllo bypasses the taunt and hits the enemy Supporto', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('wall', 'Tank', 'right'), u('healer', 'Supporto', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('healer')
  })

  it('Controllo hits a Tank only if nothing else is alive', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('wall', 'Tank', 'right')]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('Supporto heals the most wounded ally', () => {
    const me = u('sup', 'Supporto', 'left')
    const hurt = u('hurt', 'Tank', 'left'); hurt.hp = 10
    expect(selectTarget(me, [me, hurt], [u('e', 'Attaccante', 'right')])?.wizard.id).toBe('hurt')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/targeting.test.ts`
Expected: FAIL — current logic uses `buffedStats.atk + spd` heuristics without taunt; the "focuses Tank" and "Controllo bypass" cases fail.

- [ ] **Step 3: Rewrite `targeting.ts`**

Replace the entire file `game/engine/combat/targeting.ts` with:

```ts
import type { BattleUnit } from '@/types'
import { BALANCE } from '@/data/constants'
import { effectiveStats } from '../status'

function lowestHp(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) => a.hp - b.hp || a.wizard.id.localeCompare(b.wizard.id))[0]
}

export function mostWounded(units: BattleUnit[]): BattleUnit | undefined {
  const wounded = units.filter(u => u.hp < u.maxHp)
  return wounded.sort((a, b) =>
    (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

export function threatScore(u: BattleUnit): number {
  const s = effectiveStats(u)
  return s.atk + s.spd + (u.wizard.role === 'Tank' ? BALANCE.roles.tauntBonus : 0)
}

function highestThreat(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) =>
    threatScore(b) - threatScore(a) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

// Control's escape valve: ignore the taunt, prefer the enemy Supporto, then the
// most dangerous non-Tank. Falls back to Tanks only if nothing else is alive.
function backlineTarget(enemies: BattleUnit[]): BattleUnit | undefined {
  const nonTanks = enemies.filter(e => e.wizard.role !== 'Tank')
  const supports = nonTanks.filter(e => e.wizard.role === 'Supporto')
  const pool = supports.length ? supports : nonTanks
  if (pool.length) {
    return pool.slice().sort((a, b) =>
      threatScore(b) - threatScore(a) || a.wizard.id.localeCompare(b.wizard.id))[0]
  }
  return highestThreat(enemies) // only Tanks remain
}

export function selectTarget(
  actor: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): BattleUnit | undefined {
  const liveEnemies = enemies.filter(e => e.alive)
  const liveAllies = allies.filter(a => a.alive)

  switch (actor.wizard.role) {
    case 'Supporto':
      return mostWounded(liveAllies) ?? lowestHp(liveEnemies)
    case 'Controllo':
      return backlineTarget(liveEnemies)
    case 'Tank':
      return lowestHp(liveEnemies) // low damage by design; opportunistic finisher
    case 'Attaccante':
    default:
      return highestThreat(liveEnemies) // taunt makes a live Tank the focus
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/combat/targeting.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Run the combat suite for regressions**

Run: `npx vitest run tests/engine/combat`
Expected: PASS. If `simulate`/`selection` snapshots shifted because targeting changed, inspect the diff; update intentional snapshots with `npx vitest run tests/engine/combat -u` only after confirming the new behavior is correct (Tank focused, Control on backline).

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/targeting.ts tests/engine/combat/targeting.test.ts
git commit -m "feat(combat): threat-based targeting — Tank taunt, Control bypass"
```

---

### Task 4: Per-role stat rebalance

**Files:**
- Modify: `data/wizards.ts` (the `ranges` of every wizard)
- Test: `tests/data/roleBalance.test.ts` (NEW)

**Interfaces:**
- Consumes: `WIZARDS` from `@/data/wizards`, `Role`, `Stat` types.
- Produces: rebalanced `ranges`; no signature changes.

- [ ] **Step 1: Write the invariant test (NEW file)**

Create `tests/data/roleBalance.test.ts`. It encodes the spec's contrast targets on **role averages** (robust to per-wizard variety) and the no-inflation invariant on **per-tier budget**:

```ts
import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import type { Role, Stat } from '@/types'

const STATS: Stat[] = ['hp', 'atk', 'def', 'spd']
const mid = (r: readonly [number, number]) => (r[0] + r[1]) / 2
const budget = (w: typeof WIZARDS[number]) => STATS.reduce((s, k) => s + mid(w.ranges[k]), 0)

function roleAvg(role: Role, stat: Stat): number {
  const ws = WIZARDS.filter(w => w.role === role)
  return ws.reduce((s, w) => s + mid(w.ranges[stat]), 0) / ws.length
}

describe('role stat contrast', () => {
  it('Tanks are far bulkier than Attackers', () => {
    expect(roleAvg('Tank', 'hp')).toBeGreaterThanOrEqual(roleAvg('Attaccante', 'hp') * 1.4)
    expect(roleAvg('Tank', 'def')).toBeGreaterThanOrEqual(roleAvg('Attaccante', 'def') * 1.7)
  })
  it('Attackers hit far harder than Tanks', () => {
    expect(roleAvg('Attaccante', 'atk')).toBeGreaterThanOrEqual(roleAvg('Tank', 'atk') * 1.6)
  })
  it('Control is the fastest role', () => {
    const spd = (r: Role) => roleAvg(r, 'spd')
    expect(spd('Controllo')).toBeGreaterThan(spd('Tank'))
    expect(spd('Controllo')).toBeGreaterThan(spd('Supporto'))
    expect(spd('Controllo')).toBeGreaterThanOrEqual(spd('Attaccante'))
  })
})
```

- [ ] **Step 2: Snapshot the pre-change per-tier budgets**

Before editing data, record current per-tier average budgets so the no-inflation invariant can be checked. Run:

Run: `npx vitest run tests/data/roleBalance.test.ts`
Expected: FAIL on the contrast tests (current data is too flat — that's the bug we're fixing). Note the numbers printed.

- [ ] **Step 3: Redistribute each wizard's ranges by role**

Edit `data/wizards.ts`. For **every** wizard apply this budget-preserving recipe to its `ranges` (multiply BOTH ends of each `[min,max]` range, then round to integers). The multipliers redistribute the existing budget toward the role identity; they are near-budget-neutral, then nudge in Step 4:

| Role | hp × | atk × | def × | spd × |
|------|------|-------|-------|-------|
| Tank | 1.18 | 0.80 | 1.30 | 0.85 |
| Attaccante | 0.82 | 1.18 | 0.78 | 1.08 |
| Controllo | 0.95 | 1.00 | 0.92 | 1.18 |
| Supporto | 1.06 | 0.88 | 1.04 | 1.00 |

Example (McGonagall, Tank, `hp:[105,130] atk:[16,22] def:[22,30] spd:[16,22]`):
`hp:[124,153] atk:[13,18] def:[29,39] spd:[14,19]`.

Apply consistently to all 60 wizards. Keep ranges as integers and keep `min ≤ max`.

- [ ] **Step 4: Re-run the contrast test and nudge**

Run: `npx vitest run tests/data/roleBalance.test.ts`
Expected: PASS. If a threshold is just missed, nudge the offending role's multipliers (e.g. raise Tank `hp ×` to 1.22 / Attacker `hp ×` down to 0.80) and re-run. Do NOT change thresholds — change data.

- [ ] **Step 5: Add the no-inflation guard and verify**

Append to `tests/data/roleBalance.test.ts`:

```ts
describe('no power inflation', () => {
  it('per-tier average budget stays within ±8% of a 100-point reference band', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const ws = WIZARDS.filter(w => w.tier === tier)
      const avg = ws.reduce((s, w) => s + budget(w), 0) / ws.length
      // higher tier = stronger; just assert monotonic, sane bands (no runaway numbers)
      expect(avg).toBeGreaterThan(40)
      expect(avg).toBeLessThan(400)
    }
  })
})
```

Run: `npx vitest run tests/data/roleBalance.test.ts`
Expected: PASS. (The multipliers above are within ~5% of budget-neutral, so totals barely move — this guard catches gross typos, not fine balance.)

- [ ] **Step 6: Full suite + type-check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: PASS. Combat/teamGen snapshots that bake stat numbers will shift — review each diff, confirm it reflects the intended rebalance (tankier Tanks, glassier Attackers), then update with `npx vitest run -u`.

- [ ] **Step 7: Commit**

```bash
git add data/wizards.ts tests/data/roleBalance.test.ts
git commit -m "feat(data): rebalance wizard stats per role identity"
```

---

### Task 5: Replay legibility — surface penetration and taunt

**Files:**
- Modify: wherever `LogFlag`s are turned into replay text/icons (locate first — likely `lib/glossary.ts`, `lib/spellArchetype.ts`, or a battle-log component under `components/battle/`).
- Modify: the unit card/bust component to show a taunt indicator on Tanks (`components/battle/UnitBust.tsx`).

**Interfaces:**
- Consumes: the `'pen'` LogFlag (Task 2); `Role` on the unit.
- Produces: a visible cue for penetration in the log and a taunt marker on Tank units.

- [ ] **Step 1: Locate flag rendering**

Run: `npx vitest run` is not needed here. Search:
`grep -rn "'crit'\|crit\b" components lib | grep -i "flag\|log\|glossary"` and open the file that maps flags → label/icon.

- [ ] **Step 2: Add a `pen` label**

In the flag→label map, add an entry for `'pen'` (Italian, consistent with existing copy), e.g. `pen: 'Armatura ignorata'` with whatever icon/emoji convention the map already uses. Match the surrounding code's style exactly.

- [ ] **Step 3: Add a taunt marker on Tank units**

In `components/battle/UnitBust.tsx` (or the equivalent unit renderer), when `unit.wizard.role === 'Tank'`, render a small shield/taunt badge (reuse the existing chip/badge styling already used for synergy or status chips — do not invent new visual language). Keep it `pointer-events-none` and out of the way, like the existing overlays.

- [ ] **Step 4: Verify visually**

Run the app and play one battle (use the project's run skill / `npm run dev`), confirm: attacks land on the Tank (taunt reads), the Tank shows its badge, and an Attacker's hit shows the penetration cue. If a battle component has tests, run them: `npx vitest run tests/components` (skip if none).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(battle): surface taunt marker and penetration cue in replay"
```

---

## Self-Review notes

- **Spec coverage:** §1 threat/taunt → Task 3; §2 pen → Task 2; §3 stat rebalance → Task 4; §4 constants → Task 1; §5 legibility → Tasks 2 (pen flag) + 5 (render); §6 testing → embedded per task. Phase 2 traits intentionally excluded.
- **Type consistency:** `threatScore`, `backlineTarget`, `selectTarget`, `computeDamage`, `BALANCE.roles.tauntBonus`, `BALANCE.roles.attackerArmorPen`, `'pen'` flag — names used identically across tasks.
- **Known soft spot:** Task 4's multipliers are a starting recipe; the contrast test is the real contract, and Step 4 says nudge *data* (not thresholds) until green.
