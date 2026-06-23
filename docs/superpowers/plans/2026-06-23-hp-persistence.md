# HP Persistence + Permanent Death Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make player HP persist across battles in a run, make battle deaths permanent (roster shrinks), change the loss condition to "empty living roster", survive=advance, and make combat/UI handle a team smaller than 5.

**Architecture:** Add an optional `currentHp` to `DraftedWizard`. `toBattleUnits` seeds each unit from persisted HP (clamped into the buffed maxHp). A pure `applyBattleToRoster(team, snapshot)` drops the dead and writes survivors' HP as a base-relative fraction. `nextBattle` applies it, recomputes synergies, and derives phase from roster-wiped/boss/survive. UI reads the live `run.team` instead of the original prop.

**Tech Stack:** TypeScript, Vitest, Next.js (App Router), React, framer-motion.

## Global Constraints

- This is NOT stock Next.js — read `node_modules/next/dist/docs/` before any Next-specific code. (Minimal Next surface here.)
- Determinism is sacred: same seed → same deaths and same HP. The HP-seeding change adds NO new RNG (reads roster).
- HP is persisted as **base-relative absolute HP** (fraction of the wizard's BASE maxHp), NOT raw battle HP — because battle maxHp varies with relic/synergy buffs. Store `currentHp = round(baseMaxHp * (snapshotHp / snapshotMaxHp))`.
- `currentHp` is OPTIONAL; absent means full (`currentHp ?? maxHp`). Back-compat for existing fixtures/draft.
- Enemies are unaffected: always generated fresh at full HP. Only LEFT/player units read `currentHp`.
- Loss = empty living roster. Survive (≥1 alive) on a non-boss node → advance (`'victory'`) even if `result.winner === 'right'`. Boss is win-or-bust (`winner==='left'`→`'win'`, else `'defeat'`).
- `state.team` is the mutable run roster: this spec only REMOVES (death) and UPDATES HP — never adds members.
- UI must display the LIVE roster (`run.team`), not the original `team` prop, so deaths/wounds show.
- Italian for UI copy.
- Existing suite green at branch start: `npm test` (66 files / 290 tests). campaignBalance will shift (attrition) — reconcile as a BAND preserving intent, do not retune game constants.

---

### Task 1: `currentHp` on DraftedWizard + battle-start seeding

**Files:**
- Modify: `types/combat.ts` (add `currentHp?` to `DraftedWizard`)
- Modify: `game/engine/combat/simulate.ts:14-25` (`toBattleUnits` seeds from `currentHp`)
- Test: `tests/engine/combat/hpPersistence.test.ts` (new)

**Interfaces:**
- Produces: `DraftedWizard.currentHp?: number`. `toBattleUnits` now starts a unit at `min(buffedMaxHp, max(0, currentHp ?? buffedMaxHp))`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/combat/hpPersistence.test.ts
import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import type { DraftedWizard } from '@/types'

function dw(id: string, maxHp = 100, currentHp?: number): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp: maxHp, atk: 20, def: 10, spd: 10 }, maxHp, currentHp,
    spell: { id: 's', name: 's', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

describe('toBattleUnits HP seeding', () => {
  it('starts a unit at its persisted currentHp', () => {
    const [u] = toBattleUnits([dw('a', 100, 40)], 'left', [], [])
    expect(u!.hp).toBe(40)
    expect(u!.maxHp).toBe(100)
  })
  it('absent currentHp starts full', () => {
    const [u] = toBattleUnits([dw('a', 100)], 'left', [], [])
    expect(u!.hp).toBe(u!.maxHp)
  })
  it('clamps currentHp into the buffed max (never above maxHp)', () => {
    const [u] = toBattleUnits([dw('a', 100, 9999)], 'left', [], [])
    expect(u!.hp).toBe(u!.maxHp)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/combat/hpPersistence.test.ts`
Expected: FAIL — `currentHp` not on the type / not read; first test gets full HP (100) not 40.

- [ ] **Step 3: Add the type field**

In `types/combat.ts`, `DraftedWizard`:

```ts
export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
  /** Current HP carried across battles in a run. Absent = full (treated as maxHp). */
  currentHp?: number
}
```

- [ ] **Step 4: Seed HP in `toBattleUnits`**

In `simulate.ts`, the `toBattleUnits` map body currently does `hp: buffed.hp`. Change to read persisted HP, clamped:

```ts
return team.map(dw => {
  const synBuffed = applyBonuses(dw.stats, synergies)
  const buffed = applyRelicBonuses(synBuffed, team, relics)
  const startHp = dw.currentHp ?? buffed.hp
  return {
    ...dw, side, buffedStats: buffed, maxHp: buffed.hp,
    hp: Math.min(buffed.hp, Math.max(0, startHp)),
    cooldowns: {}, statusEffects: [], alive: true,
  }
})
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/engine/combat/hpPersistence.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Run the existing combat suite to confirm no regression**

Run: `npx vitest run tests/engine/combat/`
Expected: PASS — absent `currentHp` everywhere means full HP, identical to before.

- [ ] **Step 7: Commit**

```bash
git add types/combat.ts game/engine/combat/simulate.ts tests/engine/combat/hpPersistence.test.ts
git commit -m "feat(hp): currentHp on DraftedWizard; toBattleUnits seeds persisted HP"
```

---

### Task 2: `applyBattleToRoster` (pure: drop dead, persist survivor HP)

**Files:**
- Modify: `game/engine/run.ts` (add `applyBattleToRoster`)
- Test: `tests/engine/run.test.ts` (extend)

**Interfaces:**
- Consumes: `UnitSnapshot` (`{id, hp, maxHp, alive}`) from `@/types`, `DraftedWizard`.
- Produces: `export function applyBattleToRoster(team: DraftedWizard[], snapshot: UnitSnapshot[]): DraftedWizard[]` — returns the team with dead wizards removed and survivors' `currentHp` set to `round(baseMaxHp * snapshotHp/snapshotMaxHp)`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/engine/run.test.ts
import { applyBattleToRoster } from '@/game/engine/run'
import type { UnitSnapshot } from '@/types'

// reuse the file's existing DraftedWizard fixture builder if present; otherwise:
function dwFix(id: string, maxHp = 100): import('@/types').DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp: maxHp, atk: 20, def: 10, spd: 10 }, maxHp,
    spell: { id: 's', name: 's', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

describe('applyBattleToRoster', () => {
  const team = [dwFix('a', 100), dwFix('b', 100), dwFix('c', 100)]

  it('drops dead wizards from the roster', () => {
    const snap: UnitSnapshot[] = [
      { id: 'a', hp: 50, maxHp: 100, alive: true },
      { id: 'b', hp: 0, maxHp: 100, alive: false },
      { id: 'c', hp: 80, maxHp: 100, alive: true },
    ]
    const out = applyBattleToRoster(team, snap)
    expect(out.map(d => d.wizard.id)).toEqual(['a', 'c'])
  })

  it('persists survivor HP as base-relative fraction', () => {
    const snap: UnitSnapshot[] = [{ id: 'a', hp: 50, maxHp: 100, alive: true }]
    const out = applyBattleToRoster([dwFix('a', 100)], snap)
    expect(out[0]!.currentHp).toBe(50)
  })

  it('scales snapshot HP (out of buffed max) down to BASE maxHp', () => {
    // buffed maxHp 120, hp 60 = 50% → base maxHp 100 → currentHp 50
    const snap: UnitSnapshot[] = [{ id: 'a', hp: 60, maxHp: 120, alive: true }]
    const out = applyBattleToRoster([dwFix('a', 100)], snap)
    expect(out[0]!.currentHp).toBe(50)
  })

  it('full-HP survivor → currentHp equals base maxHp', () => {
    const snap: UnitSnapshot[] = [{ id: 'a', hp: 120, maxHp: 120, alive: true }]
    const out = applyBattleToRoster([dwFix('a', 100)], snap)
    expect(out[0]!.currentHp).toBe(100)
  })

  it('empty team → empty', () => {
    expect(applyBattleToRoster([], [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/run.test.ts`
Expected: FAIL — `applyBattleToRoster` not exported.

- [ ] **Step 3: Implement in `run.ts`**

Add import for `UnitSnapshot` to the existing type import, then:

```ts
export function applyBattleToRoster(
  team: DraftedWizard[], snapshot: UnitSnapshot[],
): DraftedWizard[] {
  const byId = new Map(snapshot.map(s => [s.id, s]))
  return team
    .filter(dw => byId.get(dw.wizard.id)?.alive !== false) // drop the dead; keep if no snapshot entry
    .map(dw => {
      const snap = byId.get(dw.wizard.id)
      if (!snap) return dw
      // Snapshot HP is out of the BUFFED battle maxHp; persist as a fraction of the
      // wizard's BASE maxHp so buff swings between battles don't distort wounds.
      const frac = snap.maxHp > 0 ? snap.hp / snap.maxHp : 0
      return { ...dw, currentHp: Math.round(dw.maxHp * frac) }
    })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine/run.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine/run.ts tests/engine/run.test.ts
git commit -m "feat(hp): applyBattleToRoster — drop dead, persist survivor HP as base fraction"
```

---

### Task 3: `nextBattle` applies roster + new phase logic

**Files:**
- Modify: `game/engine/run.ts:51-79` (`nextBattle`)
- Test: `tests/engine/run.test.ts` (extend)

**Interfaces:**
- Consumes: `applyBattleToRoster` (Task 2), `detectSynergies` (existing), `simulateBattle` (existing).
- Produces: `nextBattle` returns `state` with `team: newTeam` (post-battle roster), recomputed `activeSynergies`, and phase = `wiped? 'defeat' : isBoss ? (winner==='left'?'win':'defeat') : 'victory'`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to tests/engine/run.test.ts — uses the file's existing playerTeam() fixture + confirmTeam
describe('nextBattle roster persistence + phase', () => {
  it('survivors carry into state.team; dead are dropped', () => {
    // Build a confirmed run, fight one battle, assert team length <= start and
    // every surviving member has a currentHp defined (battle wrote it).
    let s = confirmTeam(startRun('persist-seed'), playerTeam())
    const startLen = s.team.length
    const out = nextBattle(s)
    expect(out.state.team.length).toBeLessThanOrEqual(startLen)
    for (const dw of out.state.team) expect(typeof dw.currentHp).toBe('number')
  })

  it('phase is victory when at least one wizard survives a non-boss node', () => {
    const s = confirmTeam(startRun('persist-seed'), playerTeam())
    const out = nextBattle(s)
    // first node is non-boss; with a normal team at least one should survive stage 0
    if (out.state.team.length > 0) expect(out.state.phase).toBe('victory')
    else expect(out.state.phase).toBe('defeat')
  })

  it('phase is defeat only when the whole roster is wiped', () => {
    // Construct a near-dead roster (currentHp 1 each) vs a hard fight to force a wipe,
    // OR assert the rule directly via applyBattleToRoster returning [] → defeat.
    // Direct rule check: a state whose post-battle team is empty must be 'defeat'.
    const s = confirmTeam(startRun('persist-seed'), playerTeam())
    const out = nextBattle(s)
    if (out.state.team.length === 0) expect(out.state.phase).toBe('defeat')
    else expect(out.state.phase).not.toBe('defeat')
  })

  it('recomputes synergies from the post-battle roster', () => {
    const s = confirmTeam(startRun('persist-seed'), playerTeam())
    const out = nextBattle(s)
    // activeSynergies must match detectSynergies(newTeam), not the pre-battle team
    const { detectSynergies } = require('@/game/engine/synergy')
    expect(out.state.activeSynergies).toEqual(detectSynergies(out.state.team))
  })
})
```

NOTE to implementer: `playerTeam()` is the fixture tests/engine/run.test.ts already uses for `confirmTeam`/`nextBattle` (from Task-3 of the map work). Reuse it. The wipe test is written defensively (asserts the RULE holds for whichever branch actually occurs) because forcing a guaranteed wipe with the real difficulty curve is brittle — if you CAN construct a deterministic guaranteed-wipe fixture (e.g. a 1-wizard team with currentHp 1 vs a boss-budget enemy), prefer asserting `phase === 'defeat'` directly; otherwise the defensive form is acceptable.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/run.test.ts`
Expected: FAIL — `nextBattle` doesn't yet write `team`/recompute synergies/derive the new phase.

- [ ] **Step 3: Rewrite the tail of `nextBattle`**

Replace the post-`simulateBattle` block (`run.ts` ~lines 69-78). Add `applyBattleToRoster` is already in the module (Task 2). New tail:

```ts
  const result = simulateBattle(state.team, enemy, battleRng, {
    leftSyn: state.activeSynergies, rightSyn: enemySyn, leftRelics: state.relics,
  })

  const newTeam = applyBattleToRoster(state.team, result.finalSnapshot)
  const newSyn = detectSynergies(newTeam)
  const wiped = newTeam.length === 0
  const phase: RunState['phase'] =
    wiped ? 'defeat'
    : isBoss ? (result.winner === 'left' ? 'win' : 'defeat') // boss: win-or-bust
    : 'victory'                                               // non-boss: survive → advance

  return {
    state: { ...state, team: newTeam, activeSynergies: newSyn, stage: state.stage + 1, lastBattle: result, phase },
    result, enemy, enemySyn, isBoss,
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine/run.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine/run.ts tests/engine/run.test.ts
git commit -m "feat(hp): nextBattle persists roster, recomputes synergies, derives phase (survive=advance, wipe=defeat)"
```

---

### Task 4: UI reads live roster + VictoryScreen attrition + suite reconciliation

**Files:**
- Modify: `components/screens/CampaignRunner.tsx` (BattleScreen `playerTeam`, TeamScreen — see below — use `c.run.team`; VictoryScreen gets the pre-battle roster for the death diff)
- Modify: `components/screens/VictoryScreen.tsx` (show who died + remaining roster size)
- Modify: `components/screens/ResultScreen.tsx` (defeat copy → roster annihilated)
- Modify: any test broken by attrition (campaignBalance.test.ts etc.)
- Test: `tests/screens/VictoryScreen.test.tsx` (new, if @testing-library/react present — it is, ^16.3.2)

**Interfaces:**
- Consumes: `RunController.run.team` (live roster, post-battle), `c.battle.result.finalSnapshot`.
- Produces: VictoryScreen shows fallen wizards; CampaignRunner passes `c.run.team` to BattleScreen.

- [ ] **Step 1: Audit which screens use the stale `team` prop**

Run: `grep -n "team={team}\|playerTeam={team}\|team=\{team\}" components/screens/CampaignRunner.tsx`
Expected: `TeamScreen team={team}` (line ~40) and `BattleScreen playerTeam={team}` (line ~61). The `team` arg is the ORIGINAL confirmed team; the live roster is `c.run.team`.

Decision: `TeamScreen` (the pre-run confirmation) legitimately shows the original full team — leave it as `team`. `BattleScreen` must show the LIVE roster (wounded/shrunk) — change `playerTeam={team}` → `playerTeam={c.run.team}`.

- [ ] **Step 2: Write the failing VictoryScreen test**

```tsx
// tests/screens/VictoryScreen.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VictoryScreen } from '@/components/screens/VictoryScreen'
import type { BattleResult } from '@/types'

const baseResult = (snap: BattleResult['finalSnapshot']): BattleResult => ({
  winner: 'left', turns: 3, log: [], mvpId: 'a', finalSnapshot: snap,
})

describe('VictoryScreen attrition', () => {
  it('names a wizard that fell this battle', () => {
    const result = baseResult([
      { id: 'a', hp: 50, maxHp: 100, alive: true },
      { id: 'b', hp: 0, maxHp: 100, alive: false },
    ])
    render(
      <VictoryScreen
        result={result} mvpName="A" battleNumber={1} enemyCount={4} bossNext={false}
        onNext={() => {}} fallenNames={['B']}
      />,
    )
    expect(screen.getByText(/B/)).toBeDefined()
    expect(screen.getByText(/Caduti|perso/i)).toBeDefined()
  })

  it('shows no death notice when nobody fell', () => {
    const result = baseResult([{ id: 'a', hp: 90, maxHp: 100, alive: true }])
    render(
      <VictoryScreen
        result={result} mvpName="A" battleNumber={1} enemyCount={4} bossNext={false}
        onNext={() => {}} fallenNames={[]}
      />,
    )
    expect(screen.queryByText(/Caduti/i)).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/screens/VictoryScreen.test.tsx`
Expected: FAIL — `VictoryScreen` has no `fallenNames` prop / no death notice.

- [ ] **Step 4: Add `fallenNames` to VictoryScreen**

In `VictoryScreen.tsx`, add the prop and a death notice block:

```tsx
export function VictoryScreen({
  result, mvpName, battleNumber, enemyCount, bossNext, onNext, fallenNames = [],
}: {
  result: BattleResult
  mvpName: string
  battleNumber: number
  enemyCount: number
  bossNext: boolean
  onNext: () => void
  /** Names of player wizards permanently lost this battle. */
  fallenNames?: string[]
}) {
  const survivors = result.finalSnapshot.filter(s => s.alive && /* left only */ true).length
```

Then inside the `GlowPanel`, after the survivors row, add:

```tsx
        {fallenNames.length > 0 && (
          <div className="flex flex-col gap-1 text-sm text-rose-300/90 border-t border-white/10 pt-2">
            <span className="text-rose-300">Caduti per sempre</span>
            <span className="text-white/70">{fallenNames.join(', ')}</span>
          </div>
        )}
```

NOTE: `survivors` counts all snapshot-alive units (both sides). It already worked before because only the player's victory matters; leave it but it's a known minor (counts enemy survivors too if alive). If you want it precise, the snapshot has no side field — so it's display-only and acceptable as-is. Do not over-engineer.

- [ ] **Step 5: Wire CampaignRunner — pass live roster + fallen names**

The fallen list = wizards in the PRE-battle roster but not in the post-battle `run.team`. `useRun` must expose the pre-battle roster or the fallen names. Simplest: compute in `useRun` and expose `lastFallen: string[]`.

In `hooks/useRun.ts`, capture the roster before `nextBattle` overwrites it. In `startBattle`:

```ts
const startBattle = useCallback(() => {
  const before = runRef.current.team
  const { state, result, enemy, enemySyn, isBoss } = nextBattle(runRef.current)
  const survivingIds = new Set(state.team.map(d => d.wizard.id))
  const fallen = before.filter(d => !survivingIds.has(d.wizard.id)).map(d => d.wizard.name)
  setLastFallen(fallen)
  runRef.current = state
  setRun(state)
  setBattle({ result, enemy, enemySyn, isBoss })
  setView('battle')
}, [])
```

Add `const [lastFallen, setLastFallen] = useState<string[]>([])` and expose `lastFallen` on `RunController` (add to the interface + return object).

In `CampaignRunner.tsx`:
- `BattleScreen playerTeam={c.run.team}` (was `{team}`).
- `VictoryScreen ... fallenNames={c.lastFallen}`.

- [ ] **Step 6: Update ResultScreen defeat copy**

In `ResultScreen.tsx`, the defeat branch copy (currently references stage). Update the defeat message to reflect roster annihilation, e.g.:

```tsx
: `La tua squadra è stata annientata alla sfida ${stageReached} di ${enemyCount}.`
```

Read the file first to place it in the existing conditional; keep the win branch unchanged.

- [ ] **Step 7: Reconcile the suite (attrition shifts balance)**

Run: `npx vitest run 2>&1 | tail -30`

Expected breakages + fixes:
- **campaignBalance.test.ts**: persistent HP + permanent death lowers clear-rate (wounds carry, deaths compound). The graph-walk test from the map spec now runs with attrition. Keep assertions as BANDS; widen the clear-rate floor downward to accommodate the new (lower) equilibrium, but keep it meaningful (don't set it to 0). Measure the new clear-rate (run the seed loop) and set the floor ~0.05 below it. Document the measured value in the report. Keep structural assertions (run completes, reaches a terminal phase) intact. DO NOT retune game constants (budgetStep/difficultySpan/eliteBudgetMult).
- **Any test asserting a fixed team size of 5 post-battle**, or full-HP-each-battle: update to reflect persistence (team may shrink, HP may carry). Preserve the test's intent.
- **useRunRelics / useRun campaign tests**: if they assert team length stays 5 across the run, relax to "≤ start size" and assert survivors carry currentHp. Preserve relic-flow coverage.

For each broken test make the MINIMAL intent-preserving change. Do not delete coverage.

- [ ] **Step 8: Full suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all green; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add components/screens/ hooks/useRun.ts tests/
git commit -m "feat(hp): UI shows live roster + fallen wizards; reconcile attrition balance"
```

---

### Task 5: Full-suite gate

**Files:** none (verification only).

- [ ] **Step 1: Run everything**

Run: `npm test`
Expected: all test files green (≥ baseline 66 files / 290 tests, plus new hpPersistence/roster/VictoryScreen tests).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 3: Manual smoke (report only)**

Document for the human: confirm team → fight → a wounded wizard shows reduced HP next battle → a wizard that died is gone from the battle screen and named on the victory screen → losing the whole roster ends the run (defeat) → surviving with ≥1 advances. Note the measured clear-rate.

- [ ] **Step 4: Final commit (if churn)**

```bash
git add -A && git commit -m "chore: hp persistence milestone green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**
- §3.1 `currentHp` on DraftedWizard → Task 1. ✅
- §3.2 battle-start seeding (clamped) → Task 1. ✅
- §3.3 `applyBattleToRoster` (drop dead, base-relative fraction) → Task 2. ✅
- §3.4 `nextBattle` apply + phase logic (wipe/boss/survive) → Task 3. ✅
- §3.5 team < 5 combat → already size-agnostic; Task 1's combat-suite run + Task 3 fixtures exercise shrunk teams. (A dedicated 2-wizard simulate test is folded into Task 1's hpPersistence file scope — ADDED below.) ✅
- §3.6 UI live roster + VictoryScreen attrition + ResultScreen copy → Task 4. ✅
- §5 testing (roster, HP carry, permanent death, loss condition, synergy recompute, determinism, UI) → Tasks 1-4. ✅

GAP FOUND in self-review: §3.5 wants an explicit "2-wizard team vs 5 enemies simulates without error" test; it wasn't its own step. FIX: add it to Task 1's test file (size-agnostic combat is a battle-engine property, belongs with the HP-seeding tests). Adding here as Task 1 Step 1b:

```ts
// add to tests/engine/combat/hpPersistence.test.ts
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'

it('a 2-wizard player team fights a 5-enemy team to a decided result', () => {
  const left = [dw('p1'), dw('p2')]
  const right = ['e1','e2','e3','e4','e5'].map(id => dw(id))
  const res = simulateBattle(left, right, createRng('small-team').fork(2))
  expect(['left', 'right']).toContain(res.winner)
  expect(res.finalSnapshot.length).toBe(7)
})
```
(Implementer: include this `it` in Task 1's test file; it needs no new production code — proves the engine is already size-flexible.)

**Placeholder scan:** No TBD/TODO. Judgment calls are explicit with rules: Task 3 Step 1 (defensive wipe assertion vs deterministic forced wipe — rule given), Task 4 Step 7 (which tests to reconcile + how, intent-preserving, no constant retuning). The `survivors` count minor in Task 4 Step 4 is flagged as display-only, not to over-engineer.

**Type consistency:** `currentHp?: number` (Task 1) read by `toBattleUnits` (Task 1) and written by `applyBattleToRoster` (Task 2), consumed by `nextBattle` (Task 3). `applyBattleToRoster(team, snapshot): DraftedWizard[]` signature consistent Tasks 2/3. `UnitSnapshot` shape `{id,hp,maxHp,alive}` matches `types/combat.ts`. `fallenNames`/`lastFallen: string[]` consistent Task 4 (VictoryScreen prop ← useRun). Phase values (`victory|win|defeat`) are existing `RunState['phase']` members.

**Known risk flagged in-plan:** attrition lowers clear-rate → Task 4 Step 7 reconciles as a band, measures, documents, no constant retuning (matches the map spec's approach and the spec's §6 risk).
