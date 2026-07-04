# Scaling Jokers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add within-run "scaling jokers" — relics that grow permanently within a single run (reset each run) by counting the player's kills, delivering the Balatro-style combo payoff.

**Architecture:** The battle sim already knows when units die; we add a per-side kill tally to `BattleResult`. A new `Relic.scaling` descriptor + an `ActiveRelic.runCounter` let three starter jokers grow: after each battle the combat resolver adds `kills.left` to every player scaling relic's `runCounter`; stat/keyword read paths (`applyRelicBonuses`, `keywordDamageMult`) turn the counter into a capped bonus at the start of each subsequent battle. State lives only on `RunState` → automatic reset per run, `MetaProfile` untouched.

**Tech Stack:** TypeScript, Vitest, Next.js. Pure functional engine in `game/engine/`.

## Global Constraints

- **NOT cross-run.** No writes to `MetaProfile`. Counter lives on `RunState.relics[i].runCounter` only. Verbatim difficulty rule: do NOT soften difficulty (memory `difficulty-validated-harder-is-good`).
- **No friendly fire / no self-scaling.** Only count kills where the victim is an ENEMY of the killer. Never count recoil self-kills or fatigue deaths.
- **Cap at read time.** `runCounter` accumulates uncapped; the bonus is `min(runCounter * per, cap)` computed where it is read. Never clamp the stored counter.
- **Data-driven.** New jokers = pure data in `data/relics.ts`. No bespoke per-relic engine branches beyond the generic `scaling` primitive.
- After ANY task that touches `data/relics.ts`, `data/unlocks.ts`, or the sim, run the FULL suite (`npx vitest run`) — adding relics/hooks perturbs the map/combat RNG stream and shifts balance harnesses (lesson: memory `event-nodes-feature`).
- The three jokers' starting values (authoritative): `fame-vorace` {stat:'attack', per:2, cap:20}; `collezionista-anime` {stat:'maxHp', per:8, cap:80}; `marchio-vorace` {stat:'velenoMult', per:0.03, cap:0.45}.

---

### Task 1: Sim counts kills per side (`BattleResult.kills`)

**Files:**
- Modify: `types/combat.ts:98-108` (add `kills` to `BattleResult`)
- Modify: `game/engine/combat/simulate.ts` (init counter, increment at kill sites A & C, include in return line 382)
- Test: `tests/engine/killCount.test.ts` (create)

**Interfaces:**
- Produces: `BattleResult.kills: { left: number; right: number }` — number of ENEMY units killed by each side (direct-hit and DoT kills only; excludes recoil self-kills and fatigue deaths).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/killCount.test.ts`. Mirror the setup style of the existing `tests/engine/relicCombat.test.ts` (how it builds `DraftedWizard[]` and calls `simulateBattle`). The test asserts the winning side's `kills` equals the number of enemies wiped.

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { makeTeam } from './helpers/makeTeam' // reuse the existing test helper used by relicCombat.test.ts; if none exists, build DraftedWizard[] inline as that file does

describe('BattleResult.kills', () => {
  it('credits the winning side with one kill per enemy wiped', () => {
    // A strong left team vs a weak right team so left wipes right.
    const left = makeTeam(['harry', 'ron', 'hermione'])   // adjust to real wizard ids present in data/wizards
    const right = makeTeam(['crfeatura-debole-1'])          // a single weak enemy; use a real weak wizard id
    const res = simulateBattle(left, right, createRng('kill-seed'))
    expect(res.winner).toBe('left')
    expect(res.kills.left).toBe(right.length) // every enemy died to the player
    expect(res.kills.right).toBe(0)           // player lost nobody
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/killCount.test.ts`
Expected: FAIL — `res.kills` is `undefined` (property does not exist).

- [ ] **Step 3a: Add the type**

In `types/combat.ts`, inside `interface BattleResult` (after `timedOut`):

```ts
  /** ENEMY units killed by each side this battle (direct-hit + DoT kills; excludes recoil
   *  self-kills and fatigue deaths). Drives within-run relic scaling. */
  kills: { left: number; right: number }
```

- [ ] **Step 3b: Count kills in the sim**

In `game/engine/combat/simulate.ts`, near the top of `simulateBattle` (next to where other per-battle accumulators like `log` are initialized):

```ts
  const kills = { left: 0, right: 0 }
```

At kill-site **A** (direct-hit death, currently lines ~266-273, the `if (!realTarget.alive) {` block), add ONE line inside the block, before `fireReactive('onDeath', ...)`:

```ts
      if (!realTarget.alive) {
        // A kill: the victim is always an enemy of its killer here → credit the opposite side.
        kills[realTarget.side === 'left' ? 'right' : 'left']++
        fireReactive('onDeath', realTarget, turn)
```

At kill-site **C** (DoT-tick death, currently lines ~308-315, the `if (!u.alive) {` block), add ONE line inside the block, before `fireReactive('onDeath', u, turn)`:

```ts
      if (!u.alive) {
        // DoT kill: poison/burn on `u` was applied by u's enemy → credit the opposite side.
        kills[u.side === 'left' ? 'right' : 'left']++
        fireReactive('onDeath', u, turn)
```

Do NOT touch kill-site B (recoil self-kill, `if (!actor.alive)`) or site D (fatigue, inside the turnCap block) — those are self-inflicted deaths with no enemy killer.

- [ ] **Step 3c: Include `kills` in the return**

In `simulate.ts`, change the return (line ~382) from:

```ts
  return { winner, turns: turn, log, mvpId, finalSnapshot: snapshot, snapshots, timedOut }
```
to:
```ts
  return { winner, turns: turn, log, mvpId, finalSnapshot: snapshot, snapshots, timedOut, kills }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/killCount.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite (BattleResult shape changed)**

Run: `npx vitest run`
Expected: All green. If any test constructs a `BattleResult` literal by hand and now fails to compile (missing `kills`), add `kills: { left: 0, right: 0 }` to that literal. `npx tsc --noEmit` must also be clean.

- [ ] **Step 6: Commit**

```bash
git add types/combat.ts game/engine/combat/simulate.ts tests/engine/killCount.test.ts
git commit -m "feat(engine): BattleResult.kills — per-side enemy kill tally"
```

---

### Task 2: Scaling descriptor + read-time bonus (`applyRelicBonuses`, `keywordDamageMult`)

**Files:**
- Modify: `types/relic.ts:15-59` (add `RelicScaling`, `Relic.scaling`, `ActiveRelic.runCounter`)
- Modify: `game/engine/relics.ts:83-103` (`applyRelicBonuses`) and `:33-46` (`keywordDamageMult`); add `scalingStatBonus` helper
- Test: `tests/engine/relicScaling.test.ts` (create)

**Interfaces:**
- Consumes: nothing from Task 1 (independent).
- Produces:
  - `RelicScaling` type: `{ trigger: 'kill'; stat: 'attack' | 'maxHp' | 'velenoMult'; per: number; cap: number }`.
  - `Relic.scaling?: RelicScaling`; `ActiveRelic.runCounter?: number`.
  - `scalingStatBonus(relic: Relic, runCounter: number | undefined, stat: RelicScaling['stat']): number` in `game/engine/relics.ts` → `relic.scaling?.stat === stat ? Math.min((runCounter ?? 0) * relic.scaling.per, relic.scaling.cap) : 0`.
  - `applyRelicBonuses` folds `attack`→atk and `maxHp`→hp (flat, post-percent).
  - `keywordDamageMult` folds `velenoMult` into the `'veleno'` multiplier.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/relicScaling.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyRelicBonuses, keywordDamageMult, scalingStatBonus } from '@/game/engine/relics'
import type { ActiveRelic, Relic, Stats, DraftedWizard } from '@/types'

const atkJoker: Relic = {
  id: 'test-atk', name: 'T', desc: '', rarity: 'epica',
  scaling: { trigger: 'kill', stat: 'attack', per: 2, cap: 20 },
}
const velJoker: Relic = {
  id: 'test-vel', name: 'V', desc: '', rarity: 'epica', keywords: ['veleno'],
  scaling: { trigger: 'kill', stat: 'velenoMult', per: 0.03, cap: 0.45 },
}
const baseStats: Stats = { hp: 100, atk: 50, def: 10, spd: 10 }
const team: DraftedWizard[] = [] // scaling ignores team composition (no condition)

describe('relic scaling', () => {
  it('scalingStatBonus grows per counter and clamps at cap', () => {
    expect(scalingStatBonus(atkJoker, 5, 'attack')).toBe(10)   // 5*2
    expect(scalingStatBonus(atkJoker, 20, 'attack')).toBe(20)  // capped
    expect(scalingStatBonus(atkJoker, 0, 'attack')).toBe(0)
    expect(scalingStatBonus(atkJoker, undefined, 'attack')).toBe(0)
    expect(scalingStatBonus(atkJoker, 5, 'maxHp')).toBe(0)     // wrong stat
  })

  it('applyRelicBonuses adds scaled attack from runCounter', () => {
    const relics: ActiveRelic[] = [{ relic: atkJoker, stageObtained: 0, runCounter: 5 }]
    const out = applyRelicBonuses(baseStats, team, relics)
    expect(out.atk).toBe(60) // 50 + 5*2
  })

  it('keywordDamageMult adds scaled veleno mult from runCounter', () => {
    const relics: ActiveRelic[] = [{ relic: velJoker, stageObtained: 0, runCounter: 10 }]
    const mult = keywordDamageMult(team, relics, [], 'veleno')
    expect(mult).toBeCloseTo(1.30) // 1 + 10*0.03
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/relicScaling.test.ts`
Expected: FAIL — `scalingStatBonus` is not exported / `scaling` not on the type.

- [ ] **Step 3a: Add the types**

In `types/relic.ts`, add above `interface Relic`:

```ts
export interface RelicScaling {
  /** What event increments the run counter. Only 'kill' for now. */
  trigger: 'kill'
  /** Which stat the counter feeds. */
  stat: 'attack' | 'maxHp' | 'velenoMult'
  /** Bonus added per counter unit. */
  per: number
  /** Absolute cap on the cumulative bonus (applied at read time). */
  cap: number
}
```

Add to `interface Relic` (after `active?`):

```ts
  /** Within-run scaling ("joker"): grows a stat as the run counter climbs. Reset each run. */
  scaling?: RelicScaling
```

Add to `interface ActiveRelic` (after `assignedTo`):

```ts
  /** Within-run cumulative trigger count for `relic.scaling`. Undefined == 0. Never persisted to MetaProfile. */
  runCounter?: number
```

- [ ] **Step 3b: Add the helper + fold into read paths**

In `game/engine/relics.ts`, add (after `relicMatchesCondition`):

```ts
/** Read-time scaling bonus for a relic's `scaling` descriptor, clamped at cap. */
export function scalingStatBonus(
  relic: Relic, runCounter: number | undefined, stat: RelicScaling['stat'],
): number {
  const s = relic.scaling
  if (!s || s.stat !== stat) return 0
  return Math.min((runCounter ?? 0) * s.per, s.cap)
}
```

Add the import for `RelicScaling` to the existing type import line at the top of `game/engine/relics.ts`.

In `keywordDamageMult`, change the relic loop to read the counter and add the veleno contribution. Replace:

```ts
  for (const { relic } of relics) {
    if (!relic.keywordMult) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    mult += relic.keywordMult[keyword] ?? 0
  }
```
with:
```ts
  for (const { relic, runCounter } of relics) {
    if (relicMatchesCondition(team, relic.condition)) {
      mult += relic.keywordMult?.[keyword] ?? 0
    }
    if (keyword === 'veleno') mult += scalingStatBonus(relic, runCounter, 'velenoMult')
  }
```

In `applyRelicBonuses`, accumulate the scaled flat bonuses and add them AFTER the percent multiply. Replace the whole function body with:

```ts
  let { hp, atk, def, spd } = stats
  let pct = 0
  let scaledHp = 0
  let scaledAtk = 0
  for (const { relic, runCounter } of relics) {
    scaledHp += scalingStatBonus(relic, runCounter, 'maxHp')
    scaledAtk += scalingStatBonus(relic, runCounter, 'attack')
    if (!relic.bonus) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    const b = relic.bonus
    hp += b.hp ?? 0
    atk += b.atk ?? 0
    def += b.def ?? 0
    spd += b.spd ?? 0
    pct += b.allPct ?? 0
  }
  const m = 1 + pct
  return {
    hp: Math.round(hp * m) + scaledHp,
    atk: Math.round(atk * m) + scaledAtk,
    def: Math.round(def * m),
    spd: Math.round(spd * m),
  }
```

(Note: scaling ignores `relicMatchesCondition` on purpose — a joker scales for its holder regardless of team composition.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/relicScaling.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: green (no relic has `scaling` yet, so behavior is unchanged for existing relics).

- [ ] **Step 6: Commit**

```bash
git add types/relic.ts game/engine/relics.ts tests/engine/relicScaling.test.ts
git commit -m "feat(engine): relic scaling descriptor + read-time capped bonus"
```

---

### Task 3: Persist the counter across battles (resolver write-back)

**Files:**
- Modify: `game/engine/relics.ts` (add `applyRelicScaling`)
- Modify: `game/engine/resolvers/combat.ts:105-117` (fold into the `resolve` spread)
- Test: `tests/engine/relicScalingPersist.test.ts` (create)

**Interfaces:**
- Consumes: `BattleResult.kills` (Task 1), `ActiveRelic.runCounter` + `Relic.scaling` (Task 2).
- Produces: `applyRelicScaling(relics: ActiveRelic[], killDelta: number): ActiveRelic[]` in `game/engine/relics.ts` — returns a new array with `runCounter` incremented by `killDelta` for every relic that has a `scaling` descriptor; non-scaling relics returned unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/relicScalingPersist.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyRelicScaling } from '@/game/engine/relics'
import type { ActiveRelic, Relic } from '@/types'

const joker: Relic = {
  id: 'j', name: 'J', desc: '', rarity: 'epica',
  scaling: { trigger: 'kill', stat: 'attack', per: 2, cap: 20 },
}
const plain: Relic = { id: 'p', name: 'P', desc: '', rarity: 'comune' }

describe('applyRelicScaling', () => {
  it('increments runCounter only for scaling relics', () => {
    const relics: ActiveRelic[] = [
      { relic: joker, stageObtained: 0, runCounter: 3 },
      { relic: plain, stageObtained: 0 },
    ]
    const out = applyRelicScaling(relics, 4)
    expect(out[0]!.runCounter).toBe(7)          // 3 + 4
    expect(out[1]!.runCounter).toBeUndefined()  // plain relic untouched
  })

  it('treats undefined runCounter as 0', () => {
    const out = applyRelicScaling([{ relic: joker, stageObtained: 0 }], 2)
    expect(out[0]!.runCounter).toBe(2)
  })

  it('is a no-op for zero kills', () => {
    const out = applyRelicScaling([{ relic: joker, stageObtained: 0, runCounter: 5 }], 0)
    expect(out[0]!.runCounter).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/relicScalingPersist.test.ts`
Expected: FAIL — `applyRelicScaling` is not exported.

- [ ] **Step 3a: Implement `applyRelicScaling`**

In `game/engine/relics.ts`:

```ts
/** After a battle, add `killDelta` to the run counter of every scaling relic. Pure. */
export function applyRelicScaling(relics: ActiveRelic[], killDelta: number): ActiveRelic[] {
  if (killDelta <= 0) return relics
  return relics.map(ar =>
    ar.relic.scaling ? { ...ar, runCounter: (ar.runCounter ?? 0) + killDelta } : ar,
  )
}
```

- [ ] **Step 3b: Wire into the combat resolver**

In `game/engine/resolvers/combat.ts`, import `applyRelicScaling` from `@/game/engine/relics` (add to the existing relics import if present, else a new import). Then in `combatResolver.resolve`, change the returned spread (lines ~111-115) from:

```ts
    return {
      ...state,
      team: out.survivors,
      activeSynergies: detectSynergies(livingOf(out.survivors)),
      lastBattle: out.result,
    }
```
to:
```ts
    return {
      ...state,
      team: out.survivors,
      relics: applyRelicScaling(state.relics, out.result.kills.left),
      activeSynergies: detectSynergies(livingOf(out.survivors)),
      lastBattle: out.result,
    }
```

(`out.result` is the `BattleResult`; `kills.left` = enemies the player killed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/relicScalingPersist.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add game/engine/relics.ts game/engine/resolvers/combat.ts tests/engine/relicScalingPersist.test.ts
git commit -m "feat(engine): persist relic scaling counter across battles (resolver write-back)"
```

---

### Task 4: The three jokers + availability + enemy exclusion

**Files:**
- Modify: `data/relics.ts` (add 3 jokers to `RELICS`; export `SCALING_RELIC_IDS`)
- Modify: `data/unlocks.ts:37-40` (add 3 joker ids to `STARTER_RELICS`)
- Modify: `game/engine/relics.ts:128-138` (`selectEnemyRelics` excludes scaling relics)
- Test: `tests/data/scalingJokers.test.ts` (create) + extend an integration check

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: relic ids `fame-vorace`, `collezionista-anime`, `marchio-vorace` in `RELICS`; `SCALING_RELIC_IDS: string[]` exported from `data/relics.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/data/scalingJokers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RELICS, RELIC_BY_ID, SCALING_RELIC_IDS } from '@/data/relics'
import { STARTER_RELICS } from '@/data/unlocks'
import { selectEnemyRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

const JOKERS = ['fame-vorace', 'collezionista-anime', 'marchio-vorace']

describe('scaling jokers data', () => {
  it('defines all three jokers with a valid scaling descriptor', () => {
    for (const id of JOKERS) {
      const r = RELIC_BY_ID[id]
      expect(r, id).toBeDefined()
      expect(r!.scaling, id).toBeDefined()
      expect(r!.scaling!.trigger).toBe('kill')
      expect(r!.scaling!.per).toBeGreaterThan(0)
      expect(r!.scaling!.cap).toBeGreaterThan(0)
    }
    expect(RELIC_BY_ID['marchio-vorace']!.keywords).toContain('veleno')
    expect(SCALING_RELIC_IDS.sort()).toEqual([...JOKERS].sort())
  })

  it('makes jokers available in real play (STARTER_RELICS)', () => {
    for (const id of JOKERS) expect(STARTER_RELICS, id).toContain(id)
  })

  it('never arms an enemy team with an (inert) scaling joker', () => {
    // Ask for the whole pool; scaling relics must be filtered out.
    const picked = selectEnemyRelics(createRng('enemy-seed'), RELICS.length)
    const ids = picked.map(p => p.relic.id)
    for (const id of JOKERS) expect(ids, id).not.toContain(id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/scalingJokers.test.ts`
Expected: FAIL — jokers/`SCALING_RELIC_IDS` don't exist.

- [ ] **Step 3a: Add the jokers to `data/relics.ts`**

Append to the `RELICS` array (match the existing object style in that file):

```ts
  {
    id: 'fame-vorace', name: 'Fame Vorace', rarity: 'epica',
    desc: 'A ogni nemico sconfitto, +2 attacco per il resto della run (max +20).',
    scaling: { trigger: 'kill', stat: 'attack', per: 2, cap: 20 },
  },
  {
    id: 'collezionista-anime', name: 'Collezionista di Anime', rarity: 'epica',
    desc: 'A ogni nemico sconfitto, +8 salute massima per il resto della run (max +80).',
    scaling: { trigger: 'kill', stat: 'maxHp', per: 8, cap: 80 },
  },
  {
    id: 'marchio-vorace', name: 'Marchio Vorace', rarity: 'epica', keywords: ['veleno'],
    desc: 'A ogni nemico sconfitto, +3% danno da veleno per il resto della run (max +45%).',
    scaling: { trigger: 'kill', stat: 'velenoMult', per: 0.03, cap: 0.45 },
  },
```

Add after the `RULE_BREAKING_RELIC_IDS` line in `data/relics.ts`:

```ts
export const SCALING_RELIC_IDS: string[] = ['fame-vorace', 'collezionista-anime', 'marchio-vorace']
```

- [ ] **Step 3b: Make them available in real runs**

In `data/unlocks.ts`, append the three ids to the `STARTER_RELICS` array (so `setRelicPoolRestriction([...STARTER_RELICS, ...])` in `hooks/useRunB.ts:119` offers them from the first run):

```ts
  'fame-vorace', 'collezionista-anime', 'marchio-vorace',
```

- [ ] **Step 3c: Exclude jokers from enemy relic selection**

In `game/engine/relics.ts`, import `SCALING_RELIC_IDS` from `@/data/relics` (extend the existing `RELICS` import). In `selectEnemyRelics`, change:

```ts
  const remaining = [...RELICS]
```
to:
```ts
  const scaling = new Set(SCALING_RELIC_IDS)
  const remaining = RELICS.filter(r => !scaling.has(r.id))
```

(Scaling relics would be inert on enemies — enemy relics never persist a `runCounter` — so keep them out of the enemy pool.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/scalingJokers.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the end-to-end scaling test**

Add to `tests/engine/relicScalingPersist.test.ts` a run-level check that a carried joker actually boosts the carrier's attack in a later battle. Build a minimal `RunState` with `relics: [{ relic: RELIC_BY_ID['fame-vorace']!, stageObtained: 0, runCounter: 0 }]`, resolve one combat node that yields kills, and assert `state.relics[0].runCounter` rose by `lastBattle.kills.left`, and that `applyRelicBonuses` on the carrier now returns `+2 * runCounter` attack (capped at 20). Reuse the combat-node setup from `tests/engine/relicCombat.test.ts` (copy its node/enemy construction). Assert the counter resets: a freshly constructed `RunState` (via `runEngine` init) has `relics` with no `runCounter`.

- [ ] **Step 6: Run full suite + typecheck (RELICS + STARTER_RELICS changed → harnesses shift)**

Run: `npx vitest run && npx tsc --noEmit`
Expected: The three new relics perturb `weightedPick` RNG and the map stream. Balance harnesses (`campaignBalanceB`, `campaignBalanceRestricted`, veleno/esecuzione/magieOscure sweeps, `relicBalance`, `relicRestriction`) may shift. If a harness asserts an exact relic offer or a tight winRate band, re-anchor per Task 5. Do NOT loosen a real correctness assertion to make it pass.

- [ ] **Step 7: Commit**

```bash
git add data/relics.ts data/unlocks.ts game/engine/relics.ts tests/data/scalingJokers.test.ts tests/engine/relicScalingPersist.test.ts
git commit -m "feat(data): three scaling jokers — available in run, excluded from enemies"
```

---

### Task 5: Full-suite re-anchor + difficulty guard

**Files:**
- Modify: whichever balance-harness tests shifted (only their reference values / smoke bounds — never a real correctness assertion).

**Interfaces:** none produced.

- [ ] **Step 1: Run the full suite and capture failures**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -60`
Expected: identify any failing balance harness and WHY (exact-offer assertion vs winRate band).

- [ ] **Step 2: Difficulty guard — measure the real proxy**

Run: `npx vitest run tests/engine/campaignBalanceRestricted.test.ts --reporter=verbose --disableConsoleIntercept`
(The `--disableConsoleIntercept` flag is REQUIRED or the winRate console line is swallowed — memory `next-session-todo`.)
Expected: read the restricted-pool winRate. Baseline before this feature ≈ 0.21. **If it rose materially (e.g. > ~0.28), the jokers are softening the game — lower the caps** in `data/relics.ts` (e.g. halve `cap`) and re-run. Record the observed winRate in the commit message.

- [ ] **Step 3: Re-anchor shifted references**

For each harness that shifted only because the RNG stream moved (not a real regression), update its reference value / smoke bound the same way prior difficulty passes did (see `tests/engine/campaignBalanceB.test.ts` comments). Keep archetype-signal assertions; convert only confounded reference floors to structural `> 0` smoke checks with a comment referencing this feature.

- [ ] **Step 4: Final verification**

Run: `npx vitest run && npx tsc --noEmit`
Expected: FULL suite green, types clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: re-anchor balance harnesses after scaling jokers (restricted winRate <observed>)"
```

---

## Self-Review

**Spec coverage:**
- Within-run scaling, resets each run → Task 3 (counter on RunState.relics) + Task 4 Step 5 (reset assertion). ✓
- One kill-detection mechanism → Task 1 (`BattleResult.kills`; note: implemented as a kill tally, NOT a bus reactive hook — simpler, no listener side-effects; the spec's "onKill hook" intent is satisfied by kill counting). ✓
- Data-driven `scaling` primitive → Task 2 (`Relic.scaling`). ✓
- 3 jokers pushing distinct builds (aggro / bruiser / veleno-combo) → Task 4. ✓
- Persistence via battle-result delta → resolver write-back → Task 3. ✓
- No MetaProfile writes → confirmed (only `state.relics` touched). ✓
- No friendly fire / self-scaling → Task 1 counts only enemy deaths at sites A & C. ✓
- Availability for playtest → Task 4 Step 3b (STARTER_RELICS). ✓
- Full-suite re-anchor + difficulty guard → Task 5. ✓

**Placeholder scan:** test wizard ids (`'harry'`, `'crfeatura-debole-1'`) are marked "adjust to real ids" — the implementer must substitute ids that exist in `data/wizards`; every other step is concrete. No TBD/TODO.

**Type consistency:** `BattleResult.kills: {left,right}` (Task 1) is read as `out.result.kills.left` (Task 3) ✓. `RelicScaling.stat` union `'attack'|'maxHp'|'velenoMult'` (Task 2) matches the three jokers' `stat` values (Task 4) ✓. `scalingStatBonus`/`applyRelicScaling` names consistent across Tasks 2-4 ✓. `SCALING_RELIC_IDS` exported in Task 4, consumed in `selectEnemyRelics` same task ✓.
