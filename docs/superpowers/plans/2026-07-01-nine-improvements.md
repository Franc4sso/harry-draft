# Nine Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship nine improvements to the Harry Potter draft roguelike: always-3-node floors with no duplicates, per-area named bosses with signature effects, real per-level enemy stat growth, a spell-power audit, a victory-modal bugfix, clearer fatigue, a roomier tree with hover synergies, and a slimmed run sidebar.

**Architecture:** Existing Next.js 16 / React 19 app with a pure TypeScript combat/map engine under `game/engine/`, data tables under `data/`, and screens under `components/`. Balance is guarded by `campaignBalanceB.test.ts` against a win-rate floor of 0.15. Changes group into low-risk (UI/bugfix) and balance-heavy (map density, spells, enemy leveling, boss) — the latter re-measure the floor before committing final values.

**Tech Stack:** TypeScript, Next.js 16.2.9, React 19, Vitest, Tailwind v4, framer-motion.

## Global Constraints

- `npm run test` does NOT run typecheck — run `npm run typecheck` after any `.ts`/`.tsx` change (verify new/edited files compile).
- Balance floor: near-optimal `campaignBalanceB` win-rate must stay ≥ 0.15. Any task touching enemy power, map density, or spell output re-runs `npx vitest run campaignBalanceB` and reports the number before committing final tuning values.
- Enemy difficulty direction (user decision): enemies MUST gain real per-level stat growth (level 4 shows level-4 stats) AND the game must stay hard — spend any headroom on more enemy threat, not less. Aim for the low edge of the band, not a comfortable margin.
- Engine purity: `game/engine/` stays pure (no React/DOM). Combat is deterministic given a seeded `Rng`.
- Commit after every green task. Branch is `master`; push when the user asks or when finishing established work.
- Italian is the in-game copy language — user-facing strings stay Italian.

---

## Task 1: Always-3 middle floors + no-duplicate node types (Spec §A)

**Files:**
- Modify: `game/engine/map.ts:40-51` (floor widths)
- Modify: `game/engine/nodeGen.ts:64-84` (filler dedup)
- Test: `tests/map/area.test.ts` (create if absent; otherwise add cases)

**Interfaces:**
- Consumes: `generateArea(rng, seed, area, bias)` → `RunNode[]`; `assignAreaCategories(rng, widths, bias)` → `RunNodeType[][]`.
- Produces: middle floors always width 3; no floor has all-identical filler types where alternatives exist.

- [ ] **Step 1: Write the failing test — middle floors are width 3**

Add to `tests/map/area.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { makeRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const bias = { teamSize: 3, teamMax: 5 }

describe('area floor widths', () => {
  it('middle floors are always width 3', () => {
    for (let seed = 0; seed < 30; seed++) {
      const nodes = generateArea(makeRng(`s${seed}`), `s${seed}`, 0, bias)
      const byFloor = new Map<number, number>()
      for (const n of nodes) {
        const f = Number(/f(\d+)n/.exec(n.id)![1])
        byFloor.set(f, (byFloor.get(f) ?? 0) + 1)
      }
      const last = BALANCE.map.floorsPerArea - 1
      for (const [f, w] of byFloor) {
        if (f === 0 || f === last || f === last - 1) continue // entry/boss/infirmary funnel
        expect(w, `seed ${seed} floor ${f}`).toBe(3)
      }
    }
  })
})
```

Check `makeRng`'s real export name first (`grep -n "export function makeRng\|export const makeRng\|export function rng" game/engine/rng.ts`) and adjust the import if different.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/map/area.test.ts -t "width 3"`
Expected: FAIL (some middle floors are width 2).

- [ ] **Step 3: Force middle floors to width 3**

In `game/engine/map.ts`, replace the width line (currently `map.ts:50`):

```ts
    widths.push(forcedOne ? 1 : firstChoice ? 3 : rng.int(minWidth, maxWidth))
```

with:

```ts
    // Middle floors are always 3 wide (design: every non-funnel step offers 3 nodes;
    // first-step-among-3 + 2-nearest cap still hold via the edge-wiring below).
    widths.push(forcedOne ? 1 : 3)
```

`firstChoice`/`rng.int` become unused; leave `firstChoice` computed line only if other code reads it — otherwise delete the now-dead `firstChoice` assignment and drop `minWidth, maxWidth` from the destructure if unused elsewhere in the function. Verify with `grep -n "minWidth\|maxWidth\|firstChoice" game/engine/map.ts`.

- [ ] **Step 4: Run test to verify width passes**

Run: `npx vitest run tests/map/area.test.ts -t "width 3"`
Expected: PASS.

- [ ] **Step 5: Write the failing test — no all-identical filler floor**

Add to the same file:

```ts
describe('area filler dedup', () => {
  it('no middle floor is entirely one node type when 3-wide', () => {
    for (let seed = 0; seed < 60; seed++) {
      const nodes = generateArea(makeRng(`d${seed}`), `d${seed}`, 0, bias)
      const byFloor = new Map<number, string[]>()
      for (const n of nodes) {
        const f = Number(/f(\d+)n/.exec(n.id)![1])
        byFloor.set(f, [...(byFloor.get(f) ?? []), n.type])
      }
      const last = BALANCE.map.floorsPerArea - 1
      for (const [f, types] of byFloor) {
        if (f === 0 || f === last || f === last - 1) continue
        if (types.length < 3) continue
        const allSame = types.every(t => t === types[0])
        expect(allSame, `seed ${seed} floor ${f} all ${types[0]}`).toBe(false)
      }
    }
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/map/area.test.ts -t "dedup"`
Expected: FAIL on at least one seed (a 3-wide floor rolls all `battle`).

- [ ] **Step 7: Add per-floor filler dedup in nodeGen**

In `game/engine/nodeGen.ts`, the filler loop (`nodeGen.ts:64-68`) assigns fillers slot-by-slot with no sibling awareness. Replace step 3's loop:

```ts
  // 3. Fill the rest with weighted fillers (recruit-biased when team incomplete).
  for (const s of free()) {
    setCat(cats, s.floor, s.idx, pickFiller(rng, bias))
    used.add(key(s.floor, s.idx))
  }
```

with a version that avoids making a floor entirely one type. Group free slots by floor and, per floor, if the first picks would make every node on that floor identical (counting already-assigned guaranteed nodes too), re-roll the last free slot until it differs or a cap is hit:

```ts
  // 3. Fill the rest with weighted fillers (recruit-biased when team incomplete).
  //    Dedup: never leave a floor entirely one node type when it has >1 node and an
  //    alternative filler exists. Guaranteed nodes (elite/recruit/relic) count toward
  //    the floor's type set, so most floors are already mixed; this only catches the
  //    all-filler-same case (e.g. 3-wide floor rolling battle/battle/battle).
  const freeByFloor = new Map<number, Slot[]>()
  for (const s of free()) freeByFloor.set(s.floor, [...(freeByFloor.get(s.floor) ?? []), s])
  for (const [floor, floorSlots] of freeByFloor) {
    for (const s of floorSlots) {
      setCat(cats, s.floor, s.idx, pickFiller(rng, bias))
      used.add(key(s.floor, s.idx))
    }
    // If the whole floor collapsed to one type, re-roll the last slot until it differs.
    const types = cats[floor]!
    const width = types.length
    if (width > 1 && types.every(t => t === types[0])) {
      const last = floorSlots[floorSlots.length - 1]
      if (last) {
        for (let tries = 0; tries < 8; tries++) {
          const alt = pickFiller(rng, bias)
          if (alt !== types[0]) { setCat(cats, last.floor, last.idx, alt); break }
        }
      }
    }
  }
```

Note: `pickFiller` only yields `battle`/`recruit`/`relic`, so an alternative always exists — the 8-try cap is just RNG insurance. Keep `used`/`free()` semantics intact.

- [ ] **Step 8: Run both new tests + existing map tests**

Run: `npx vitest run tests/map/area.test.ts && npx vitest run tests/map`
Expected: PASS (all).

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 10: Re-measure the balance floor**

Run: `npx vitest run campaignBalanceB`
Expected: near-optimal win-rate ≥ 0.15. Record the number in the commit body. If it drops below, do NOT proceed — note it; the fix is deferred to Task 8's remeasure (more nodes = more player levels, which usually *raises* win-rate, so a drop here is unexpected and worth flagging).

- [ ] **Step 11: Commit**

```bash
git add game/engine/map.ts game/engine/nodeGen.ts tests/map/area.test.ts
git commit -m "feat(map): always-3 middle floors + per-floor filler dedup

campaignBalanceB near-optimal: <NUMBER>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fix victory modal showing on timeout with enemies alive (Spec §E)

**Files:**
- Modify: `game/engine/combat/simulate.ts:341-346` (expose timeout in result)
- Modify: `components/screens/BattleScreen.tsx:119-121` (modal outcome)
- Modify: `components/battle/BattleEndModal.tsx` (timeout copy)
- Test: `tests/combat/victory-timeout.test.ts` (create)

**Interfaces:**
- Consumes: `simulateBattle(...)` → `BattleResult { winner: Side, ... }`.
- Produces: `BattleResult.timedOut: boolean` (true when both sides still had living units at turnCap); `BattleEndModal` renders a "Tempo scaduto" variant when a win came from timeout.

- [ ] **Step 1: Write the failing test**

`tests/combat/victory-timeout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { BattleResult } from '@/types' // adjust to real BattleResult location

// Locate where BattleResult is declared: grep -rn "interface BattleResult\|type BattleResult" game types
describe('BattleResult.timedOut', () => {
  it('is set true when the sim ends by turnCap with both sides alive', () => {
    // Build a stalemate: two near-invincible teams so neither dies before turnCap.
    // Use the real simulateBattle with high-def, low-atk units. See sibling combat tests
    // for the toBattleUnits/simulateBattle harness shape.
    // Assert result.timedOut === true and both sides had alive units.
    expect(true).toBe(true) // replace with real harness assertion (see Step 3)
  })
})
```

Before writing the real assertion, read an existing combat test (`ls tests/combat` then read one) to copy the exact `simulateBattle` harness. Then assert `result.timedOut === true` for a constructed stalemate and `=== false` for a normal wipe.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/combat/victory-timeout.test.ts`
Expected: FAIL (`timedOut` undefined on result).

- [ ] **Step 3: Add `timedOut` to the sim result**

In `game/engine/combat/simulate.ts` near the winner computation (`:341-346`):

```ts
  const leftAlive = sideUnits('left').length
  const rightAlive = sideUnits('right').length
  let winner: Side
  if (leftAlive && !rightAlive) winner = 'left'
  else if (rightAlive && !leftAlive) winner = 'right'
  else winner = totalHpPct(L) >= totalHpPct(R) ? 'left' : 'right'
  const timedOut = leftAlive > 0 && rightAlive > 0 // both sides survived to turnCap
```

Add `timedOut` to the returned `BattleResult` object and to its type (`grep -rn "interface BattleResult\|type BattleResult" game types`, add `timedOut: boolean`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/combat/victory-timeout.test.ts`
Expected: PASS.

- [ ] **Step 5: Thread timedOut into the modal**

`components/screens/BattleScreen.tsx:119-121` currently:

```tsx
{r.modalReady && (
  <BattleEndModal outcome={result.winner === 'left' ? 'win' : 'loss'} onConfirm={onFinish} />
)}
```

Change to pass a timeout flag:

```tsx
{r.modalReady && (
  <BattleEndModal
    outcome={result.winner === 'left' ? 'win' : 'loss'}
    timedOut={result.timedOut}
    onConfirm={onFinish}
  />
)}
```

- [ ] **Step 6: Render timeout copy in the modal**

In `components/battle/BattleEndModal.tsx`, add an optional `timedOut?: boolean` prop. When `outcome === 'win' && timedOut`, show a distinct title/subtitle instead of the plain "Vittoria" — e.g. title "Vittoria ai punti" and a subtitle "Tempo scaduto — vinci per HP residui." Keep a clean loss/normal-win path. Read the current JSX (`:19,40-45`) and mirror its styling.

- [ ] **Step 7: Typecheck + tests**

Run: `npm run typecheck && npx vitest run tests/combat`
Expected: no type errors; tests pass.

- [ ] **Step 8: Commit**

```bash
git add game/engine/combat/simulate.ts components/screens/BattleScreen.tsx components/battle/BattleEndModal.tsx tests/combat/victory-timeout.test.ts types
git commit -m "fix(combat): distinguish timeout win from clean wipe in end modal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Clear fatigue indicator + dedicated log line (Spec §F)

**Files:**
- Modify: `components/battle/BattleLog.tsx:35-80` (Fatica case)
- Modify: `components/battle/UnitBust.tsx` (distinct fatigue icon/tone) — optional if flag distinct
- Modify: `components/screens/BattleScreen.tsx` or `components/battle/BattleArena.tsx` (fatigue banner)
- Test: `tests/battle/fatigue-log.test.ts` (create) — pure describe of the log formatter

**Interfaces:**
- Consumes: log entries with `action === 'Fatica'`, `actorId === targetId`, `type: 'system'`, `flags: ['dot']`.
- Produces: `describeEntry` returns a self-damage system line for Fatica (not "X lancia Fatica su X"); a "Sfinimento!" banner shows once fatigue begins.

- [ ] **Step 1: Write the failing test for the log formatter**

Read `components/battle/BattleLog.tsx` to find whether `describeEntry` is exported. If not, export it (pure function). `tests/battle/fatigue-log.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'

describe('fatigue log line', () => {
  it('reads as self-inflicted exhaustion, not a self-cast spell', () => {
    const line = describeEntry({
      turn: 20, action: 'Fatica',
      actorId: 'harry', actorSide: 'left',
      targetId: 'harry', targetSide: 'left',
      type: 'system', value: 12, flags: ['dot'],
    } as any, { harry: 'Harry' } as any) // match describeEntry's real signature
    expect(line).not.toMatch(/lancia Fatica/)
    expect(line).toMatch(/Sfinimento|Fatica/)
    expect(line).toMatch(/12/)
  })
})
```

Adjust the second arg to `describeEntry`'s real name-resolver signature (read it first).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/fatigue-log.test.ts`
Expected: FAIL (line contains "lancia Fatica su Harry").

- [ ] **Step 3: Add a dedicated Fatica case**

In `describeEntry` (`BattleLog.tsx:35-80`), before the generic positive-value line (`:76-78`), add:

```ts
  if (entry.action === 'Fatica') {
    return `Sfinimento — ${actor} perde ${entry.value} PV`
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/fatigue-log.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the "Sfinimento!" banner**

Fatigue begins when any log entry has `action === 'Fatica'` (first appears at `turn > BALANCE.combat.fatigueStart`). In the battle view (`BattleScreen.tsx` / `BattleArena.tsx`), derive `fatigueActive` from the replay: true once the current replay frame's turn exceeds `fatigueStart` OR a Fatica entry has played. Render a small persistent banner (Italian: "Sfinimento! Tutti i maghi perdono PV ogni turno.") styled distinctly from normal status chips. Read the replay hook (`hooks/useBattleReplay.ts`) to find the current turn/frame exposed to the view; if the current turn isn't exposed, add a `currentTurn` to its return.

- [ ] **Step 6: Distinct bust icon (optional polish)**

In `components/battle/UnitBust.tsx` (`:26,38,76`), the `dot` flag maps to the same flame as burn/poison. If a Fatica-specific frame flag is available, map it to a distinct icon/tone (e.g. an hourglass, muted grey) so fatigue reads apart from poison. If the frame only carries `flags:['dot']` with no action, skip this step (banner + log already disambiguate) and note it.

- [ ] **Step 7: Typecheck + tests**

Run: `npm run typecheck && npx vitest run tests/battle`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add components/battle/BattleLog.tsx components/battle/UnitBust.tsx components/screens/BattleScreen.tsx components/battle/BattleArena.tsx hooks/useBattleReplay.ts tests/battle/fatigue-log.test.ts
git commit -m "feat(battle): clear Sfinimento banner + dedicated fatigue log line

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Roomier tree + hover-only synergy chips (Spec §G)

**Files:**
- Modify: `components/screens/MapScreen.tsx:29` (spacing constants), `:148-174` (synergy chip visibility)

**Interfaces:**
- Consumes: `n.preview` (boss name + synergy-id chips), per-node hover/focus state.
- Produces: larger node spacing; synergy chips hidden until node hover/focus.

- [ ] **Step 1: Increase spacing constants**

`MapScreen.tsx:29`:

```ts
const COL = 132, ROW = 116, NODE = 60, BOSS = 80
```

Increase horizontal/vertical breathing room:

```ts
const COL = 168, ROW = 148, NODE = 60, BOSS = 80
```

(Node size unchanged; only the grid pitch grows so labels/chips don't collide.)

- [ ] **Step 2: Gate synergy chips on hover/focus**

The telegraph badges (`MapScreen.tsx:148-174`) render always-visible with `pointer-events-none`. Wrap the synergy-chip block in the same hover/focus opacity pattern the type label already uses (`group-hover:opacity-100 group-focus-visible:opacity-100`, `:145-147`). The node `<button>` already has `group`; add `opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100` to the synergy-chip container. Keep the boss-name chip visible if you want bosses always telegraphed — read `:148-174` and gate only the synergy pills, leaving the boss name persistent (matches the existing boss-hint hover nested element).

- [ ] **Step 3: Visual check (manual)**

Run: `npm run dev`, open the run map. Confirm: tree is roomier, synergy pills appear on node hover, no overlap, boss name still telegraphed. Note this is a visual step — no unit test.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/screens/MapScreen.tsx
git commit -m "feat(map-ui): roomier tree layout + hover-only synergy chips

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Slim sidebar — drop LOADOUT, fold role/spell/selector into first box (Spec §H)

**Files:**
- Modify: `components/screens/RunBRunner.tsx:33-45` (remove LoadoutPanel from aside)
- Modify: `components/run/TeamSynergyBar.tsx:47-83` (add role icon + equipped spell + spell selector per member)
- Delete: `components/run/LoadoutPanel.tsx` (after its logic is absorbed)
- Test: manual (UI); plus a render smoke test if a test harness for these components exists

**Interfaces:**
- Consumes: `team` (`DraftedWizard[]` with `m.wizard.role`, `m.spell`, `m.wizard.spellPool`), `onSetSpell(memberId, spellId)` (currently `c.setWizardSpell`).
- Produces: `TeamSynergyBar` vertical rows show role icon + equipped spell + inline spell selector; `LoadoutPanel` removed.

- [ ] **Step 1: Extend TeamSynergyBar member rows**

In `components/run/TeamSynergyBar.tsx` (vertical branch `:47-83`), each member row currently shows portrait + name + level. Add, per member:
- Role icon + tooltip: reuse `RoleIcon` from `components/cards/RoleIcon` and `roleTooltip` from `lib/roleInfo` (same as `WizardCard.tsx:84-90`).
- Equipped spell name + type chip: reuse `spellTypeChip`/`formatSpellStats` from `lib/glossary` (same helpers `WizardCard`/`WizardCardRow` use), reading `m.spell`.
- Inline spell selector (absorb LOADOUT): a collapsible control mirroring `LoadoutPanel.tsx:14-59` — a button toggling an `open` state that reveals `m.wizard.spellPool` buttons calling `onSetSpell(m.id, spell.id)` (confirm the member id field name; `LoadoutPanel` uses the same shape). Add an `onSetSpell` prop to `TeamSynergyBar`.

Keep the rows compact; the selector stays collapsed by default.

- [ ] **Step 2: Pass onSetSpell and remove LoadoutPanel from the aside**

`components/screens/RunBRunner.tsx:33-45`: pass `onSetSpell={c.setWizardSpell}` to `TeamSynergyBar` and delete the `<LoadoutPanel ... />` line.

```tsx
<TeamSynergyBar
  team={c.run.team}
  synergies={c.run.activeSynergies}
  orientation="vertical"
  onSetSpell={c.setWizardSpell}
/>
```

- [ ] **Step 3: Delete the now-unused LoadoutPanel**

Confirm no other importer: `grep -rn "LoadoutPanel" components app`. If only `RunBRunner` used it, delete `components/run/LoadoutPanel.tsx`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors (all `LoadoutPanel` imports gone; `onSetSpell` typed on `TeamSynergyBar`).

- [ ] **Step 5: Visual check (manual)**

Run: `npm run dev`, open the run map. Confirm: no LOADOUT box; each wizard row shows role + equipped spell; the inline selector changes the equipped spell and persists.

- [ ] **Step 6: Commit**

```bash
git add components/run/TeamSynergyBar.tsx components/screens/RunBRunner.tsx
git rm components/run/LoadoutPanel.tsx
git commit -m "feat(run-ui): fold role/spell/selector into team box; drop LOADOUT panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Spell audit — fix silence, buff tarantallegra & fianto, sweep weak spells (Spec §D)

**Files:**
- Modify: `game/engine/combat/simulate.ts` (call `canCastSpell` in the cast path)
- Modify: `data/spells.ts` (tarantallegra, fianto, others from audit)
- Modify: `game/engine/status.ts` if needed (silence gate wiring)
- Test: `tests/combat/silence.test.ts`, `tests/combat/spell-impact.test.ts` (create)

**Interfaces:**
- Consumes: `canCastSpell(unit)` (`status.ts:121`), spell defs in `data/spells.ts`.
- Produces: a silenced unit does NOT cast a spell (falls back to basic attack or skip per existing silence semantics); tarantallegra has a stun chance; fianto grants an absorbing shield.

- [ ] **Step 1: Write the audit table (documentation step)**

Create `docs/superpowers/notes/spell-audit-2026-07-01.md`: list every spell in `data/spells.ts` with its real in-combat effect and a verdict (inert / weak / ok). Use the explorer findings as the seed (tarantallegra weak, fianto invisible, silence inert, graded StatusDefs unreferenced). This drives which spells step 6 touches. Commit this note with the task.

- [ ] **Step 2: Write the failing silence test**

`tests/combat/silence.test.ts`: construct a unit with a `silence` status and assert that in a simulated turn it does NOT emit a spell-cast log entry (it attacks or is gated). Copy the `simulateBattle` harness from a sibling combat test. Assert the silenced unit's actions over the silence duration contain no `type` indicating a spell cast.

- [ ] **Step 3: Run silence test — fails**

Run: `npx vitest run tests/combat/silence.test.ts`
Expected: FAIL (silenced unit still casts).

- [ ] **Step 4: Wire canCastSpell into the cast path**

In `game/engine/combat/simulate.ts`, the turn loop chooses a spell then casts. Find where `selectSpell` result is cast (around the Difesa self-cast at `:225` and the cast dispatch). Gate the cast: if `!canCastSpell(u)`, skip the spell and fall through to a basic attack (or no-op if also disarmed), consistent with how `canAttack` is already checked in the damage handler. Import `canCastSpell` from `../status`. Do NOT double-apply — mirror the existing `canAct` gate structure (`:205`).

- [ ] **Step 5: Run silence test — passes**

Run: `npx vitest run tests/combat/silence.test.ts`
Expected: PASS.

- [ ] **Step 6: Buff tarantallegra and fianto**

In `data/spells.ts`:

- `tarantallegra` (`:24`): add a stun chance alongside the slow. Current: `effects: [{ kind: 'debuff', stat: 'spd', amount: 20, duration: 2 }]`. Change to also apply a short stun, e.g. `effects: [{ kind: 'debuff', stat: 'spd', amount: 30, duration: 2 }, { kind: 'stun', duration: 1 }]`. Confirm the inline `stun` kind is honored by `applyInlineEffect`/`preventsOf` (explorer confirmed inline `stun` → `['action']` gate works, `status.ts:112-113`).
- `fianto` (`:36`): convert the flat +30 def self-buff into an absorbing shield so it's visible and impactful. If `data/spells.ts` supports a `spec` with a `shield` handler (explorer: `shield` handler at `effects.ts:88-96`, absorbs via `absorbDamage`), give fianto a shield spec (e.g. shield = a function of caster def/level) instead of/in addition to a smaller def buff. Read `normalizeSpell.ts` + the `shield` spec shape used by another spell to copy the exact field names.

- [ ] **Step 7: Write spell-impact tests**

`tests/combat/spell-impact.test.ts`: assert tarantallegra can stun (over N seeds, at least one applies an `action`-preventing status to the target) and fianto grants a shield status (caster gains a `shield`/absorb after casting). Keep assertions probabilistic where RNG is involved (assert ≥1 occurrence across seeds).

- [ ] **Step 8: Run impact tests — pass**

Run: `npx vitest run tests/combat/spell-impact.test.ts`
Expected: PASS.

- [ ] **Step 9: Apply remaining audit fixes**

For any other spell the audit flagged inert/weak, apply the minimal fix (or explicitly defer with a one-line reason in the audit note). Do not scope-creep into new mechanics — reuse existing status kinds/handlers.

- [ ] **Step 10: Typecheck + full combat tests**

Run: `npm run typecheck && npx vitest run tests/combat`
Expected: pass.

- [ ] **Step 11: Re-measure the balance floor**

Run: `npx vitest run campaignBalanceB`
Expected: near-optimal ≥ 0.15. Stronger control spells help the player AND the enemy AI (both draft from the same pools), so net effect is usually small — record the number. If it moved materially, note the direction; final enemy-power tuning lands in Task 7.

- [ ] **Step 12: Commit**

```bash
git add game/engine/combat/simulate.ts data/spells.ts game/engine/status.ts docs/superpowers/notes/spell-audit-2026-07-01.md tests/combat/silence.test.ts tests/combat/spell-impact.test.ts
git commit -m "balance(spells): fix silence gate; buff tarantallegra/fianto; audit note

campaignBalanceB near-optimal: <NUMBER>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Real per-level enemy stat growth + re-tune to hold a hard floor (Spec §C)

**Files:**
- Modify: `game/engine/resolvers/combat.ts:62-67` (run enemy team through leveling)
- Modify: `game/engine/battlePrep.ts` (accept enemy leveling, or a parallel helper)
- Modify: `game/engine/combat/battlePackage.ts` / `combat/threat.ts` / `data/constants.ts` (menace re-tune)
- Test: `tests/combat/enemy-leveling.test.ts` (create); re-run `campaignBalanceB`

**Interfaces:**
- Consumes: `enemyLevelFor(area, kind, isFinalBoss)` (`threat.ts:9-18`), `leveledStats(dw)` (`leveling.ts:65-76`), `battleReadyTeam(team)` (`battlePrep.ts:10-21`).
- Produces: enemy `DraftedWizard`s carry `level` and pass through `leveledStats` before combat, so a level-N enemy shows level-N stats; `menace` reduced so net difficulty is ≥ today at the 0.15 floor.

- [ ] **Step 1: Write the failing enemy-leveling test**

`tests/combat/enemy-leveling.test.ts`: assert that an enemy team built for a higher area/level has strictly greater post-prep stats than the same team at level 1. Build via the real enemy team gen + the prep step, and compare a stat total. Assert level-4-ish enemy stat total > level-1 stat total.

- [ ] **Step 2: Run — fails**

Run: `npx vitest run tests/combat/enemy-leveling.test.ts`
Expected: FAIL (enemies are level-less; totals equal).

- [ ] **Step 3: Assign level to enemy units and run them through leveling**

Where the enemy team is built for a node (`battlePackage.ts` / `teamGen.ts`), stamp each enemy `DraftedWizard.level = enemyLevelFor(area, kind, isFinalBoss)` (clamped `[1, levelMax]`). In `game/engine/resolvers/combat.ts:62-67`, the player team goes through `battleReadyTeam(livingOf(state.team))` (which applies `leveledStats`) but `enemy` goes in raw. Run the enemy team through the same leveling path (a `battleReadyTeam`-equivalent that applies `leveledStats` without player-only side effects — read `battlePrep.ts:10-21` and factor a shared helper if the current one is player-specific).

- [ ] **Step 4: Run — passes**

Run: `npx vitest run tests/combat/enemy-leveling.test.ts`
Expected: PASS.

- [ ] **Step 5: Baseline-measure the floor with growth ON, menace unchanged**

Run: `npx vitest run campaignBalanceB`
Record the near-optimal win-rate. Growth-on with the old (negative-at-low-levels) menace will make enemies much stronger at low levels → win-rate likely drops below 0.15. This is expected; the next step re-tunes.

- [ ] **Step 6: Re-tune menace to hold the floor at the hard edge (measure-driven loop)**

The old flat `menace` (`menaceForLevel`, `menacePerLevel/menaceOffset` in `data/constants.ts`) was compensating for the *absence* of growth. With real growth, reduce menace so it no longer double-counts. Per the user's direction (keep it hard): tune menace so near-optimal `campaignBalanceB` lands at the LOW edge of the band (just ≥ 0.15), not comfortably above.

Loop:
1. Adjust `menaceOffset` (and/or `menacePerLevel`) by one step.
2. Run `npx vitest run campaignBalanceB`, record near-optimal win-rate.
3. Repeat until win-rate is ≥ 0.15 and as close to it as the seed granularity allows.

**STOP before committing final values** and report the lever values + measured win-rate to the user for approval (this is the balance-heavy gate the user asked to keep hard — confirm the difficulty target is met, not overshot).

- [ ] **Step 7: Verify the displayed level now matches shown stats**

Confirm the enemy stat bars in-battle reflect the leveled stats (they read from the same leveled `BattleUnit`). Manual check via `npm run dev` on an area-1+ battle: a level-4 enemy shows higher HP/ATK than a level-1 enemy of the same wizard.

- [ ] **Step 8: Typecheck + combat tests**

Run: `npm run typecheck && npx vitest run tests/combat`
Expected: pass.

- [ ] **Step 9: Commit (after user approves the tuning values)**

```bash
git add game/engine/resolvers/combat.ts game/engine/battlePrep.ts game/engine/combat/battlePackage.ts game/engine/combat/threat.ts data/constants.ts tests/combat/enemy-leveling.test.ts
git commit -m "balance(enemy): real per-level stat growth; re-tune menace to hard floor

Enemies now grow with level (level N shows level-N stats). Menace reduced from
<OLD> to <NEW> so net difficulty holds the 0.15 floor at its low edge.
campaignBalanceB near-optimal: <NUMBER>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Per-area named bosses guaranteed in team + Bellatrix ignores-taunt (Spec §B)

**Files:**
- Modify: `data/bosses.ts` (BossDef `bossWizardId` + `ignoresTaunt`; add `bellatrix_boss`; stamp Voldemort/Muro)
- Modify: `game/engine/combat/teamGen.ts:58-68` (inject guaranteed boss wizard)
- Modify: `types/run.ts` + `game/engine/combat/battlePackage.ts` + `game/engine/resolvers/combat.ts` + `game/engine/combat/simulate.ts` + `game/engine/combat/targeting.ts` (thread `ignoresTaunt`)
- Modify: `game/engine/combat/battlePackage.ts` (route area-1 boss node to `bellatrix_boss`)
- Test: `tests/combat/boss-identity.test.ts`, `tests/combat/ignores-taunt.test.ts` (create); re-run `campaignBalanceB`

**Interfaces:**
- Consumes: `BossDef`, `generateBossTeam(rng, boss)`, `selectTarget`/`threatScore` (`targeting.ts`), `tauntBonus` (`constants.ts:193`).
- Produces: `BossDef.bossWizardId?: string` (guaranteed unit) and `BossDef.ignoresTaunt?: boolean`; `bellatrix_boss` pinned to area 1; an `ignoresTaunt` attacker skips the Tank taunt.

- [ ] **Step 1: Add BossDef fields and Bellatrix def**

In `data/bosses.ts`, extend `BossDef` (`:3-16`):

```ts
  /** A specific wizard guaranteed as this boss's leader unit in the fought team. */
  bossWizardId?: string
  /** Attackers on this boss's side ignore the enemy Tank's taunt (target backline). */
  ignoresTaunt?: boolean
```

Add:

```ts
export const BELLATRIX: BossDef = {
  id: 'bellatrix_boss',
  name: 'Bellatrix Lestrange',
  budget: 900, // placeholder — calibrated in Step 8
  hpMult: 1.25,
  bossWizardId: 'bellatrix',
  ignoresTaunt: true,
  pinnedArea: 1,
  unitCount: 5,
}
```

Stamp existing bosses with their guaranteed unit:
- `voldemort_boss`: add `bossWizardId: 'voldemort'`.
- `muro_boss`: add `bossWizardId` for a thematic leader if one fits (else leave absent — Muro is a wall archetype, not a named character; note the decision).

- [ ] **Step 2: Write the failing boss-identity test**

`tests/combat/boss-identity.test.ts`: `generateBossTeam(rng, BELLATRIX)` must include a unit whose `wizard.id === 'bellatrix'`. Same for Voldemort.

- [ ] **Step 3: Run — fails**

Run: `npx vitest run tests/combat/boss-identity.test.ts`
Expected: FAIL (team is budget-drafted; bellatrix not guaranteed).

- [ ] **Step 4: Inject the guaranteed boss wizard**

In `game/engine/combat/teamGen.ts:58-68` (`generateBossTeam`), after drafting, if `boss.bossWizardId` is set, ensure that wizard is present as the leader:
- Draft the named wizard from `WIZARDS` (find by id) via `draftWizard(rng, wizard)`.
- If not already in the team, replace the lowest-power drafted unit with it (keep `unitCount` size).
- Apply the `hpMult` / `forcedSpellIds` overlay to THIS named unit as the leader (instead of "highest power drafted").

```ts
export function generateBossTeam(rng: Rng, boss: BossDef): DraftedWizard[] {
  const size = boss.unitCount ?? BALANCE.draft.teamSize
  const perUnit = boss.budget / size
  const team = pickTowardBudget(rng, perUnit, size)
  let leader: DraftedWizard
  if (boss.bossWizardId) {
    const named = WIZARDS.find(w => w.id === boss.bossWizardId)
    if (!named) throw new Error(`boss.bossWizardId not found: ${boss.bossWizardId}`)
    let idx = team.findIndex(d => d.wizard.id === boss.bossWizardId)
    if (idx < 0) {
      // replace the weakest unit with the guaranteed boss
      const weakest = team.reduce((w, d, i) => (powerOf(d) < powerOf(team[w]!) ? i : w), 0)
      team[weakest] = draftWizard(rng, named as Wizard)
      idx = weakest
    }
    leader = team[idx]!
  } else {
    leader = team.reduce((best, d) => (powerOf(d) > powerOf(best) ? d : best), team[0]!)
  }
  leader.stats = { ...leader.stats, hp: Math.round(leader.stats.hp * boss.hpMult) }
  leader.maxHp = leader.stats.hp
  const forced = boss.forcedSpellIds?.[0]
  if (forced && SPELL_BY_ID[forced]) leader.spell = SPELL_BY_ID[forced]!
  return team
}
```

- [ ] **Step 5: Run — passes**

Run: `npx vitest run tests/combat/boss-identity.test.ts`
Expected: PASS.

- [ ] **Step 6: Thread ignoresTaunt through to targeting**

Mirror the `unitDamageReduction` wiring the explorer documented:
1. `types/run.ts` (`NodeBattle`): add `ignoresTaunt?: boolean`.
2. `battlePackage.ts`: when routing a boss node, copy `boss.ignoresTaunt` onto `NodeBattle` (alongside where `unitDamageReduction`/`bossSynergy` are set, `:41-49,66`).
3. `resolvers/combat.ts`: read `pkg.ignoresTaunt ?? false`, pass to `simulateBattle(..., { rightIgnoresTaunt })`.
4. `simulate.ts`: set a per-unit `ignoresTaunt` flag on the right-side units (or the leader) in `toBattleUnits` (mirror `:36-42,49-50`).
5. `targeting.ts` (`threatScore`/`selectTarget`, `:39-42,63-92`): an attacker whose own `ignoresTaunt` is set skips the `tauntBonus` term (compute threat as if `tauntBonus` were 0), so it picks by real threat and hits the backline.

Decide scope: apply `ignoresTaunt` to the whole boss side (simpler, stronger) OR only the named boss unit. Given "Bellatrix ignores provocazione", applying it to Bellatrix's whole side is acceptable and simpler; note the choice.

- [ ] **Step 7: Write + run the ignores-taunt test**

`tests/combat/ignores-taunt.test.ts`: with a player team containing a Tank (high `tauntBonus`) and a fragile backliner, a boss-side attacker with `ignoresTaunt` targets the backliner, not the Tank. Assert the first boss-attacker action targets a non-Tank. Contrast: without the flag, it targets the Tank.

Run: `npx vitest run tests/combat/ignores-taunt.test.ts`
Expected: PASS.

- [ ] **Step 8: Route area-1 boss node to Bellatrix + calibrate budget/hpMult**

In `battlePackage.ts` (boss branch `:39-56`), where `area === 0 → MURO` and final → Voldemort, add `area === 1 → BELLATRIX`. Then calibrate `BELLATRIX.budget`/`hpMult` (and `ignoresTaunt` scope) so the area-1 boss sits in the band with the hard difficulty from Task 7. Measure loop:
1. Run `npx vitest run campaignBalanceB`.
2. Read the area-1 boss slice win-rate (if the test breaks out per-slice; else overall).
3. Adjust `BELLATRIX.budget`/`hpMult`; repeat until the boss is beatable but hard (near-optimal ≥ 0.15).

**STOP and report** the final Bellatrix numbers + measured win-rate to the user before committing.

- [ ] **Step 9: Typecheck + full test suite**

Run: `npm run typecheck && npx vitest run`
Expected: pass.

- [ ] **Step 10: Commit (after user approves Bellatrix tuning)**

```bash
git add data/bosses.ts game/engine/combat/teamGen.ts game/engine/combat/battlePackage.ts game/engine/combat/simulate.ts game/engine/combat/targeting.ts game/engine/resolvers/combat.ts types/run.ts tests/combat/boss-identity.test.ts tests/combat/ignores-taunt.test.ts
git commit -m "feat(boss): per-area named bosses guaranteed in team; Bellatrix ignores taunt

Area 1 boss = Bellatrix (guaranteed unit, ignores provocazione). Voldemort/Muro
now guaranteed as their own units too. campaignBalanceB near-optimal: <NUMBER>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task order & rationale

1. Task 1 (map density) — low risk, remeasure
2. Task 2 (victory modal bug) — independent
3. Task 3 (fatigue clarity) — independent
4. Task 4 (tree UI) — independent
5. Task 5 (sidebar UI) — independent
6. Task 6 (spell audit) — remeasure
7. Task 7 (enemy leveling) — balance gate, hard-floor tuning, user approval before commit
8. Task 8 (per-area bosses) — depends on Task 7 difficulty; user approval before commit

Balance-touching tasks (1, 6, 7, 8) each end by running `campaignBalanceB` and recording the number. Tasks 7 and 8 pause for user approval of tuning values before their final commit.
