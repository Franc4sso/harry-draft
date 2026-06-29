# Death & Recovery System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wizard death non-eliminating (0-HP benched), add a full-heal-and-revive Infermeria node guaranteed before every boss, allow dead→alive swap at recruit, and raise the final boss to a real climax now that pre-boss recovery exists.

**Architecture:** Five coupled pieces: (1) engine — death stops removing wizards from the roster; combat/synergies/levels/defeat count only the living; (2) a new `infirmary` node type + resolver that sets every wizard to full HP; (3) the map generator forces an Infermeria-only floor immediately before each boss; (4) recruit swap accepts a dead wizard as the replace target; (5) `finalBossMenace` rises to a climax value, tuned with the pre-boss heal in place. Determinism is preserved (no new RNG in death/heal paths).

**Tech Stack:** TypeScript, Vitest, the run engine (`game/engine/`), React (recruit UI), `@/`-aliased imports.

## Global Constraints

- **Death = 0 HP benched, NOT elimination.** Remove the `.filter(alive !== false)` drop in `game/engine/run.ts:17`. Dead wizards stay in the roster at `currentHp = 0`.
- **Only the LIVING are fielded.** Combat receives only wizards with `currentHp > 0` (or `currentHp === undefined`, meaning full). A benched dead wizard is never a `BattleUnit`.
- **Synergies (combat) count only the living.** `detectSynergies` for the player's battle must receive the living team, not the full roster. (UI outside battle may still show roster-wide synergies — do not change that.)
- **Dead wizards do not gain levels.** Level-ups from a clear apply only to wizards that fought (the living).
- **Defeat = ALL dead, not empty team.** `wiped` becomes `team.length > 0 && team.every(dead)`.
- **Infermeria = full recovery.** Every wizard (living wounded + dead) goes to `currentHp = maxHp`. No choice, single ack.
- **Pre-boss Infermeria is guaranteed.** The floor immediately before each boss is Infermeria-only, on every path.
- **Determinism:** no new RNG in death/heal/Infermeria/map-floor paths. Existing seeded tests must stay green except where a balance value (finalBossMenace) intentionally changes outcomes — those are recalibrated, not masked.
- **A dead wizard is identified by `(dw.currentHp ?? dw.maxHp) <= 0`.** Use this predicate consistently (a helper is fine).
- Tests: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`.

---

### Task 1: Death is non-eliminating + only-living fielded + defeat = all-dead

**Files:**
- Modify: `game/engine/run.ts:7-26` (`applyBattleToRoster` — stop dropping the dead)
- Modify: `game/engine/resolvers/combat.ts` (field only living; levels only to living)
- Modify: `game/engine/runEngine.ts:105` (defeat = all dead)
- Create: `game/engine/roster.ts` (a tiny `isDead`/`livingOf` helper)
- Test: `tests/engine/deathBench.test.ts`

**Interfaces:**
- Produces: `isDead(dw: DraftedWizard): boolean` = `(dw.currentHp ?? dw.maxHp) <= 0`; `livingOf(team: DraftedWizard[]): DraftedWizard[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/deathBench.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isDead, livingOf } from '@/game/engine/roster'
import { applyBattleToRoster } from '@/game/engine/run'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, UnitSnapshot } from '@/types'

const mk = (id: string, currentHp?: number): DraftedWizard => ({
  wizard: WIZARDS.find(w => w.id === id)!, stats: { hp: 100, atk: 10, def: 10, spd: 10 },
  maxHp: 100, spell: SPELL_BY_ID['base_attack']!, ...(currentHp !== undefined ? { currentHp } : {}),
})

describe('death bench helpers', () => {
  it('isDead: 0 HP is dead, undefined/positive is alive', () => {
    expect(isDead(mk('harry', 0))).toBe(true)
    expect(isDead(mk('harry', 1))).toBe(false)
    expect(isDead(mk('harry'))).toBe(false)   // undefined currentHp = full = alive
  })
  it('livingOf drops the dead', () => {
    const team = [mk('harry', 50), mk('voldemort', 0), mk('snape')]
    expect(livingOf(team).map(d => d.wizard.id)).toEqual(['harry', 'snape'])
  })
})

describe('applyBattleToRoster keeps the dead benched at 0 HP', () => {
  const team = [mk('harry'), mk('voldemort')]
  const snapshot: UnitSnapshot[] = [
    { id: 'harry', side: 'left', hp: 40, maxHp: 100, alive: true } as UnitSnapshot,
    { id: 'voldemort', side: 'left', hp: 0, maxHp: 100, alive: false } as UnitSnapshot,
  ]
  it('the dead wizard stays in the roster at currentHp 0 (not removed)', () => {
    const out = applyBattleToRoster(team, snapshot)
    expect(out.map(d => d.wizard.id)).toEqual(['harry', 'voldemort'])   // both kept
    expect(out.find(d => d.wizard.id === 'voldemort')!.currentHp).toBe(0)
    expect(out.find(d => d.wizard.id === 'harry')!.currentHp).toBe(40)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/deathBench.test.ts`
Expected: FAIL — `roster.ts` doesn't exist; `applyBattleToRoster` still drops the dead.

- [ ] **Step 3: Create the helper**

Create `game/engine/roster.ts`:
```ts
import type { DraftedWizard } from '@/types'

/** A wizard is dead when its persisted HP is 0 (undefined currentHp means full = alive). */
export function isDead(dw: DraftedWizard): boolean {
  return (dw.currentHp ?? dw.maxHp) <= 0
}

/** The living subset of a roster — the only wizards that field in combat. */
export function livingOf(team: DraftedWizard[]): DraftedWizard[] {
  return team.filter(dw => !isDead(dw))
}
```

- [ ] **Step 4: Stop dropping the dead in applyBattleToRoster**

In `game/engine/run.ts`, the current body filters then maps (line 16-25). Change it to KEEP every wizard, updating HP from the snapshot (dead → currentHp 0):
```ts
  const byId = new Map(snapshot.filter(s => s.side === 'left').map(s => [s.id, s]))
  return team.map(dw => {
    const snap = byId.get(dw.wizard.id)
    if (!snap) return dw                                  // no snapshot entry → unchanged
    const frac = snap.maxHp > 0 ? snap.hp / snap.maxHp : 0
    return { ...dw, currentHp: Math.round(dw.maxHp * frac) }   // 0 when dead → benched
  })
```
(The dead are no longer filtered out — they persist at currentHp 0.)

- [ ] **Step 5: Field only the living + level only the living (combat.ts)**

In `game/engine/resolvers/combat.ts`, where the player team is prepared for battle:
- Change `const ready = battleReadyTeam(state.team)` to field only the living:
  ```ts
  import { livingOf } from '../roster'
  // ...
  const ready = battleReadyTeam(livingOf(state.team))
  ```
  (`playerSyn = detectSynergies(ready)` now automatically counts only the living.)
- The level grant: `applyBattleToRoster(state.team, result.finalSnapshot)` then `persisted.map(gainLevels)`. Only the living should level. Change the level step so a wizard that is dead after the battle (currentHp 0) does NOT gain levels:
  ```ts
  const persisted = applyBattleToRoster(state.team, result.finalSnapshot)
  const survivors = persisted.map(dw => isDead(dw) ? dw : gainLevels(dw, levelsGained).dw)
  ```
  Add `import { isDead, livingOf } from '../roster'` at the top.

- [ ] **Step 6: Defeat = all dead (runEngine.ts)**

In `game/engine/runEngine.ts:105`, change:
```ts
  const wiped = resolved.team.length === 0
```
to:
```ts
  const wiped = resolved.team.length > 0 && resolved.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)
```

- [ ] **Step 7: Run the test + extend it for living-only fielding**

Append to `tests/engine/deathBench.test.ts` a battle-level test that a dead benched wizard is not fielded and an all-dead roster is a defeat. Use a seeded `simulateBattle` via the run engine if practical, OR assert at the `livingOf` boundary that `battleReadyTeam(livingOf(team))` excludes the dead:
```ts
import { battleReadyTeam } from '@/game/engine/battlePrep'
describe('only the living are fielded', () => {
  it('battleReadyTeam(livingOf(...)) excludes a benched dead wizard', () => {
    const team = [mk('harry', 50), mk('voldemort', 0)]
    const fielded = battleReadyTeam(livingOf(team))
    expect(fielded.map(d => d.wizard.id)).toEqual(['harry'])
  })
})
```
Run: `npx vitest run tests/engine/deathBench.test.ts` → PASS.

- [ ] **Step 8: Determinism gate — full suite**

Run: `npx vitest run`
Expected: watch for fallout. Tests that assumed a dead player wizard is REMOVED from the team may now see it benched. Two legitimate kinds of change: (a) a campaign/balance test's win rate may shift slightly because a team that loses a member mid-run now keeps a 0-HP benched body (no longer auto-wiped) — if `campaignBalanceB`/`serpeverdeBalance` move, record the new numbers (band may still hold; if `campaignBalanceB` leaves [0.15,0.45], note it — Task 5 recalibrates the boss anyway). (b) a test asserting `team.length` shrinks on death must be updated to the new benched semantics. Do NOT update a test whose failure is a real logic break. `npx tsc --noEmit` → PASS.

- [ ] **Step 9: Commit**

```bash
git add game/engine/roster.ts game/engine/run.ts game/engine/resolvers/combat.ts game/engine/runEngine.ts tests/engine/deathBench.test.ts
# add any balance/length test you had to update
git commit -m "feat(death): death benches at 0 HP (no elimination); field/synergy/level/defeat count only the living"
```

---

### Task 2: Infermeria node type + resolver (full heal + full revive)

**Files:**
- Modify: `types/run.ts` (add `'infirmary'` to BOTH `RunNodeType` AND `RunEvent.kind` unions)
- Modify: `game/engine/nodeCatalog.ts` (add the `infirmary` catalog entry)
- Create: `game/engine/resolvers/infirmary.ts`
- Modify: `game/engine/runEngine.ts:29` (register `infirmaryResolver` in `registerCoreResolvers`)
- Test: `tests/engine/infirmary.test.ts`

**Interfaces:**
- Consumes: `isDead` (Task 1).
- Produces: `infirmaryResolver` (a `NodeResolver`); resolving an infirmary node sets every roster wizard to `currentHp = maxHp`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/infirmary.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { infirmaryResolver } from '@/game/engine/resolvers/infirmary'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import type { DraftedWizard, RunNode, RunState } from '@/types'

const mk = (id: string, currentHp?: number): DraftedWizard => ({
  wizard: WIZARDS.find(w => w.id === id)!, stats: { hp: 100, atk: 10, def: 10, spd: 10 },
  maxHp: 100, spell: SPELL_BY_ID['base_attack']!, ...(currentHp !== undefined ? { currentHp } : {}),
})

describe('infirmaryResolver', () => {
  it('heals the wounded and revives the dead to full HP', () => {
    const state = { team: [mk('harry', 30), mk('voldemort', 0), mk('snape')], relics: [], log: [] } as unknown as RunState
    const node = { id: 'inf-0', type: 'infirmary', next: [] } as RunNode
    const out = infirmaryResolver.resolve(state, node, { kind: 'combat-ack' }, createRng('x'))
    expect(out.team.every(d => d.currentHp === d.maxHp)).toBe(true)   // all full
    expect(out.team.find(d => d.wizard.id === 'voldemort')!.currentHp).toBe(100)  // revived
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/infirmary.test.ts`
Expected: FAIL — `infirmaryResolver` / the `infirmary` type don't exist.

- [ ] **Step 3: Add the node type**

In `types/run.ts`, add `'infirmary'` to the `RunNodeType` union (in the Fase-1 group, since it's generated/resolved now):
```ts
  | 'battle' | 'elite' | 'boss' | 'recruit' | 'relic' | 'infirmary'
```

- [ ] **Step 4: Add the catalog entry**

In `game/engine/nodeCatalog.ts`, add to `NODE_CATALOG`:
```ts
  infirmary:  { type: 'infirmary',  label: 'Infermeria',    emoji: '🏥', theme: "Ala dell'Infermeria", isCombat: false, resolverId: 'infirmary',  generatedInPhase: 1 },
```

- [ ] **Step 5: Create the resolver**

Create `game/engine/resolvers/infirmary.ts` (model the shape on the existing relicResolver in `recruit.ts`):
```ts
import type { NodeResolver } from './types'
import type { RunEvent } from '@/types'

/** Full recovery: every wizard (wounded or dead) returns to full HP. No choice. */
export const infirmaryResolver: NodeResolver = {
  id: 'infirmary',
  enter: () => ({ offers: {}, isCombat: false }),
  resolve: (state, node, _choice, _rng) => {
    const team = state.team.map(dw => ({ ...dw, currentHp: dw.maxHp }))
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'infirmary', summary: "L'Infermeria ti rimette in sesto: tutti tornano in piena salute." }
    return { ...state, team, log: [...(state.log ?? []), ev] }
  },
}
```
⚠️ CONFIRMED: `RunEvent.kind` in `types/run.ts:30` is `'recruit' | 'relic' | 'elite' | 'boss' | 'levelMilestone'` — it does NOT include `'infirmary'`. Add `'infirmary'` to that union (one edit in `types/run.ts`), so the resolver's `kind: 'infirmary'` typechecks.

- [ ] **Step 6: Register the resolver**

CONFIRMED: `registerCoreResolvers` is in `game/engine/runEngine.ts:29`, registering resolvers via `registerResolver(...)` (combat at :31-33, recruit :34, relic :35). Add the import `import { infirmaryResolver } from './resolvers/infirmary'` near the existing resolver imports, and add `registerResolver(infirmaryResolver)  // id 'infirmary'` alongside recruit/relic.

- [ ] **Step 7: Run the test + typecheck + full suite**

Run: `npx vitest run tests/engine/infirmary.test.ts` → PASS.
Run: `npx tsc --noEmit` → PASS (the `NODE_CATALOG` Record is exhaustive over `RunNodeType`, so the new union member forces the catalog entry — that's why Steps 3+4 go together).
Run: `npx vitest run` → no regression (new node type isn't generated yet — Task 3 does that).

- [ ] **Step 8: Commit**

```bash
git add types/run.ts game/engine/nodeCatalog.ts game/engine/resolvers/infirmary.ts game/engine/runEngine.ts tests/engine/infirmary.test.ts
# add the resolver-registration file if separate
git commit -m "feat(infirmary): Infermeria node type + resolver (full heal + full revive)"
```

---

### Task 3: Guaranteed Infermeria floor before each boss (map generator)

**Files:**
- Modify: `game/engine/map.ts` (the `typeForFloor` / floor-type logic)
- Test: `tests/engine/mapInfirmary.test.ts`

**Interfaces:**
- Consumes: the `infirmary` node type (Task 2).
- Produces: a generated map where the floor immediately before each boss floor is Infermeria-only, reachable on every path.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/mapInfirmary.test.ts`. Generate a map and assert: the floor before the boss is all `infirmary`, and every node on the pre-boss floor leads to the boss (so any path passes through it).

```ts
import { describe, it, expect } from 'vitest'
import { generateMap } from '@/game/engine/map'  // confirm the export name
import { createRng } from '@/game/engine/rng'

describe('map: guaranteed Infermeria before the boss', () => {
  it('the floor before the boss is Infermeria-only', () => {
    for (const seed of ['m0', 'm1', 'm2', 'm3', 'm4']) {
      const nodes = generateMap(createRng(seed))   // adjust to the real signature
      const boss = nodes.find(n => n.type === 'boss')!
      // the pre-boss floor = all nodes whose `next` includes the boss id
      const preBoss = nodes.filter(n => n.next.includes(boss.id))
      expect(preBoss.length).toBeGreaterThan(0)
      expect(preBoss.every(n => n.type === 'infirmary')).toBe(true)   // all Infermeria
      // every pre-boss node leads to the boss → any path hits an Infermeria
      expect(preBoss.every(n => n.next.includes(boss.id))).toBe(true)
    }
  })
})
```
NOTE: read `game/engine/map.ts` first to get the real `generateMap` export name + signature (it may take `(rng, area)` or return a richer object). Adjust the test to the real shape; the REQUIRED assertion is "the floor immediately before the boss is all `infirmary` and leads to the boss".

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/mapInfirmary.test.ts`
Expected: FAIL — the pre-boss floor is currently `battle`/`elite`, not `infirmary`.

- [ ] **Step 3: Force the pre-boss floor to Infermeria**

In `game/engine/map.ts`, the floor type is decided by `typeForFloor(f)`:
```ts
  const typeForFloor = (f: number): RunNodeType =>
    f === last ? 'boss' : eliteFloors.includes(f) ? 'elite' : 'battle'
```
The boss is at `last`; force `last - 1` to be an Infermeria floor (and make it a single node like the boss/start, so the path funnels through it). Change the width decision AND the type:
- In the width loop, treat `last - 1` like `last`/`0` (width 1):
  ```ts
  if (f === 0 || f === last || f === last - 1) widths.push(1)
  ```
- In `typeForFloor`:
  ```ts
  const typeForFloor = (f: number): RunNodeType =>
    f === last ? 'boss' : f === last - 1 ? 'infirmary' : eliteFloors.includes(f) ? 'elite' : 'battle'
  ```
Guard: if `floors` is very small (e.g. `last - 1 <= 0`), don't collide with the start floor — only apply when `last - 1 >= 1`. Check the `floors` minimum in the existing config; if floors can be ≤ 2, wrap the override in `if (last - 1 >= 1)`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/engine/mapInfirmary.test.ts` → PASS (5 seeds).

- [ ] **Step 5: Full suite + typecheck**

Run: `npx tsc --noEmit` → PASS.
Run: `npx vitest run` → watch for map-shape tests that pinned floor counts/types (e.g. a test asserting "N battle floors" or exact node counts). Update those to the new pre-boss-Infermeria layout (it's an intended structural change), noting each. Do NOT mask a real break. `campaignBalanceB`/`serpeverdeBalance` win rates may shift (players now always heal pre-boss) — record new numbers; Task 5 recalibrates.

- [ ] **Step 6: Commit**

```bash
git add game/engine/map.ts tests/engine/mapInfirmary.test.ts
# add any map-shape test you updated
git commit -m "feat(map): guaranteed Infermeria floor immediately before every boss"
```

---

### Task 4: Dead→alive swap at the recruit node

**Files:**
- Modify (if needed): `game/engine/resolvers/recruit.ts` (confirm `replaceId` accepts a dead wizard)
- Modify: `components/screens/RecruitNodeScreen.tsx` (or the recruit UI — find it) so a dead wizard is selectable as the replace target
- Test: `tests/engine/recruitSwapDead.test.ts` (+ a UI test if the UI changes)

**Interfaces:**
- Consumes: benched-dead roster (Task 1), `isDead` (Task 1).

- [ ] **Step 1: Write the failing engine test**

Create `tests/engine/recruitSwapDead.test.ts`. Assert that a `recruit-pick` with `replaceId` pointing at a DEAD wizard swaps it out (dead leaves, recruit joins alive).

```ts
import { describe, it, expect } from 'vitest'
import { recruitResolver } from '@/game/engine/resolvers/recruit'  // confirm export
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import type { DraftedWizard, RunNode, RunState } from '@/types'

const mk = (id: string, currentHp?: number): DraftedWizard => ({
  wizard: WIZARDS.find(w => w.id === id)!, stats: { hp: 100, atk: 10, def: 10, spd: 10 },
  maxHp: 100, spell: SPELL_BY_ID['base_attack']!, ...(currentHp !== undefined ? { currentHp } : {}),
})

describe('recruit swap of a dead wizard', () => {
  it('replaceId on a dead wizard drops it and adds the recruit alive', () => {
    // A full team with one dead member; recruit a new wizard replacing the dead one.
    const team = ['harry','voldemort','snape','draco','lucius'].map((id,i) => mk(id, i===1 ? 0 : 100))
    const state = { team, relics: [], log: [], stage: 1, teamMax: 5 } as unknown as RunState
    const node = { id: 'rec-0', type: 'recruit', next: [] } as RunNode
    // pick any offered wizard id not on the team; here we trust recruitOffer — instead drive the resolver
    // with an explicit recruit-pick whose wizardId is a fresh roster id and replaceId = the dead 'voldemort'.
    const out = recruitResolver.resolve(state, node, { kind: 'recruit-pick', wizardId: 'cedric', replaceId: 'voldemort' }, createRng('x'))
    expect(out.team.map(d => d.wizard.id)).not.toContain('voldemort')   // dead swapped out
    expect(out.team.map(d => d.wizard.id)).toContain('cedric')           // recruit in
    expect(out.team.find(d => d.wizard.id === 'cedric')!.currentHp ?? 100).toBeGreaterThan(0)  // alive
  })
})
```
NOTE: read `recruit.ts` first — the resolver may validate `wizardId` against the offer. If it rejects an arbitrary `wizardId`, construct the state/offer so `cedric` (or whatever) is offerable, OR test the swap mechanic at whatever boundary the resolver actually exposes. The REQUIRED behavior: a `replaceId` pointing at a dead wizard removes it and the recruit joins. If the resolver ALREADY does this correctly (replaceId is id-based, indifferent to alive/dead), this test simply passes after Step 2's read and the engine needs NO change — note that and move to the UI.

- [ ] **Step 2: Run it; fix the resolver only if needed**

Run: `npx vitest run tests/engine/recruitSwapDead.test.ts`
If it PASSES already (replaceId is alive-agnostic), the engine is done — proceed to the UI step. If it FAILS because the resolver filters dead wizards out of replace candidates, remove that filter so a dead `replaceId` is honored. Show the minimal change.

- [ ] **Step 3: UI — make a dead wizard selectable as the replace target**

Find the recruit UI: `grep -rn "replaceId\|RecruitNode\|recruit-pick" components/`. In that screen, the team list used to pick who to replace must INCLUDE dead wizards (shown as dead/0-HP, e.g. greyed with a "Morto" badge) and allow selecting one as `replaceId`. If the UI already lists the whole team (dead included) the only change is a visual dead-state indicator; if it filters to living, remove that filter for the replace picker. Read the component before editing; make the minimal change. Add/extend a UI test asserting a dead team member is selectable as the replace target.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/engine/recruitSwapDead.test.ts` and the UI test → PASS.
Run: `npx tsc --noEmit` → PASS.

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → no regression.
```bash
git add game/engine/resolvers/recruit.ts components/ tests/engine/recruitSwapDead.test.ts
git commit -m "feat(recruit): a dead wizard can be swapped out for a recruit"
```

---

### Task 5: Raise the final boss to a climax (tuned with pre-boss heal)

**Files:**
- Modify: `data/constants.ts` (`campaignB.finalBossMenace`)
- Modify: `tests/engine/campaignBalanceB.test.ts` (recalibrate comments/band if needed)
- Modify (comments): the archetype sweeps + `serpeverdeBalance.test.ts` (new numbers)

**Interfaces:**
- Consumes: the guaranteed pre-boss Infermeria (Task 3) — the reason a strong boss stays winnable.

- [ ] **Step 1: Raise finalBossMenace and tune**

In `data/constants.ts`, change `finalBossMenace` from `-0.50` to `+0.30` (statMult 1.30, ≈ the area-2 boss). Update the comment to remove the "TEMPORARY" note and explain it's now a climax backed by the pre-boss heal.

- [ ] **Step 2: Run campaignBalanceB, tune to band**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts --reporter=verbose 2>&1 | grep -E "campaign|winRate|passed|failed"`
Expected: with the pre-boss Infermeria healing the player, a +0.30 boss should keep the run in `[0.15, 0.45]`. Record the winRate.
TUNE: if winRate < 0.15 (boss too hard even with the heal), lower finalBossMenace toward +0.20. If > 0.45 (boss too soft — unlikely), raise toward +0.40. Keep it ≥ the area-2 boss statMult (1.38 → finalBossMenace ≥ +0.38) IF the band allows; otherwise document that the run-survivability ceiling caps it just below the area-2 boss and that's the accepted trade-off. Bake the final value + update the comment.

- [ ] **Step 3: Refresh the sweep + Serpeverde diagnostic comments**

Run the 4 archetype sweeps + `serpeverdeBalance.test.ts`; update ONLY their top-of-file diagnostic comments with the new post-boss-buff winRates. No assertion changes (floors are >0.05; serpeverde band stays disabled — Slice 3 handles it).

- [ ] **Step 4: Full suite + typecheck + commit**

Run: `npx tsc --noEmit` → PASS. Run: `npx vitest run` → all green.
```bash
git add data/constants.ts tests/engine/campaignBalanceB.test.ts tests/engine/*Sweep.test.ts tests/engine/serpeverdeBalance.test.ts
git commit -m "balance(boss): final boss is a real climax (finalBossMenace -0.50→<final>), backed by the pre-boss Infermeria"
```

---

### Task 6: Update the backlog handoff doc

**Files:**
- Modify: `docs/superpowers/remaining-work.md`

- [ ] **Step 1: Record the death & recovery system**

In `docs/superpowers/remaining-work.md`, add a "✅ Done" bullet summarizing the death&recovery system (death benches at 0 HP, Infermeria full-heal+revive guaranteed pre-boss, dead-swap at recruit, defeat=all-dead, final boss raised to a climax). Note the resurrection CONSUMABLE is still a pending separate slice. Leave the other pending slices (modal timing, random battle generation, map 3-options) listed.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/remaining-work.md
git commit -m "docs(death-recovery): mark the death & recovery system done"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` → PASS.
- [ ] `npx vitest run` → all green. New: deathBench, infirmary, mapInfirmary, recruitSwapDead. campaignBalanceB in [0.15,0.45] with the strong boss.
- [ ] Record: final finalBossMenace value, campaignBalanceB winRate, Serpeverde winRate.
- [ ] `git push origin master`.

## Self-Review notes (author)

- **Spec coverage:** §1 death→Task 1; §2 Infermeria→Task 2; §3 pre-boss floor→Task 3; §4 swap→Task 4; §5 strong boss→Task 5; validation woven into each task's tests; backlog→Task 6. ✓
- **The "only living" rule** is enforced at three points (field, synergy, level) all in Task 1 Step 5, via `livingOf`/`isDead` — single source of truth. ✓
- **Determinism gates** at Task 1/2/3 full-suite steps; balance shifts are recalibrated in Task 5, not masked. ✓
- **Type consistency:** `isDead`/`livingOf` defined Task 1, reused Tasks 2/4. `infirmary` type defined Task 2, consumed Task 3. `finalBossMenace` is the Slice-1 temporary value raised here. ✓
- **Coupling note:** Task 5 (strong boss) MUST come after Task 3 (pre-boss heal) — the heal is what makes the strong boss winnable. Order enforced.
