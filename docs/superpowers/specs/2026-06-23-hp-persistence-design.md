# HP Persistence + Permanent Death — Design

**Date:** 2026-06-23
**Status:** Approved design, pre-implementation
**Scope:** Make player HP persist across battles within a run, make battle deaths permanent (roster shrinks), change the loss condition to "all player wizards dead", and let combat/UI handle a team smaller than 5. Lays groundwork for HP-based events (separate spec) and a mutable roster (shop, separate spec).

---

## 1. Motivation

Today every battle calls `toBattleUnits`, which sets `hp: buffed.hp` (= maxHp) and `alive: true` for each wizard (`simulate.ts:22`). The `finalSnapshot` (post-battle HP) is computed but **never written back** to `state.team` (verified: no `state.team =` / `.hp =` in `run.ts`/`useRun.ts`). So each challenge starts at full health and dead wizards return. This makes any heal/damage resource meaningless and removes attrition — the core tension of a roguelike run.

The player chose (brainstorming) the hardcore model: **wounded HP persists; a wizard reduced to 0 in battle is lost for the rest of the run; the run ends only when the whole living roster is gone.** This is the foundation HP-based events depend on, so it ships first, as its own spec.

## 2. Decisions (locked in brainstorming)

- **Wounded HP persists** between battles. A wizard at 40/100 starts the next fight at 40/100.
- **Permanent death:** a wizard reduced to 0 HP in any battle is removed from the run roster. The team can shrink 5→4→3…
- **Loss condition = empty living roster.** Surviving a battle with ≥1 living wizard means the run continues; the player advances on the map regardless of whether the enemies were all killed. The binary "win the battle to advance" rule is removed for non-boss nodes.
- **Boss:** defeating the boss (all enemies dead) wins the run. Reaching the boss with a depleted roster is the player's gamble.
- **`state.team` becomes the mutable run roster** — the living, wounded wizards carried forward. This is also the seam a future shop spec uses to add/swap wizards; this spec only ever *removes* (death) and *updates HP*, never adds.
- **Out of scope:** HP-based events, shop/recruiting, healing between battles by any means (a future heal source — relic/event — will write to the same persisted HP; none added here). The existing start-of-battle relic shields/heals still work as before (they apply to the battle, not the persisted pool).

## 3. Architecture

### 3.1 Data: persisted HP on the roster

`DraftedWizard` currently has `stats`, `maxHp`, `spell`, `wizard`. Add a persisted current-HP field:

```ts
// types/combat.ts — DraftedWizard
export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
  /** Current HP carried across battles in a run. Absent = full (treated as maxHp). */
  currentHp?: number
}
```

`currentHp` is optional so existing fixtures/draft code that don't set it are treated as full health (back-compat; `currentHp ?? maxHp`).

NOTE on `maxHp` vs relic/synergy buffs: the *battle* maxHp is `buffedStats.hp` (after synergy+relic), which can exceed `DraftedWizard.maxHp`. Persisted HP must be stored against the **base** roster so buffs recompute each battle. Decision: persist HP as a **fraction** is rejected (rounding drift); instead persist **absolute base-relative HP** and clamp into each battle's buffed maxHp. See §3.3.

### 3.2 Battle start: seed HP from the roster

`toBattleUnits` (`simulate.ts:14-25`) currently sets `hp: buffed.hp`. Change so a unit starts at its persisted HP, clamped to the battle's buffed maxHp:

```ts
const startHp = dw.currentHp ?? buffed.hp     // absent → full
return {
  ...dw, side, buffedStats: buffed, maxHp: buffed.hp,
  hp: Math.min(buffed.hp, Math.max(0, startHp)),  // clamp into buffed range
  cooldowns: {}, statusEffects: [], alive: true,
}
```

A wizard at 40 base HP entering a battle where relics push maxHp to 120 starts at 40/120 — wounds carry, buffs add headroom on top. (Only LEFT/player units read `currentHp`; enemies are always generated fresh at full, unchanged.)

### 3.3 Battle end: write survivors' HP, drop the dead (engine)

This is a RUN-level operation, not a battle-level one. `simulateBattle` stays pure and unchanged except it already returns `finalSnapshot` (per-unit `{id, hp, maxHp, alive}`). A new pure helper in `run.ts` applies the snapshot to the roster:

```ts
// run.ts
export function applyBattleToRoster(team: DraftedWizard[], snapshot: UnitSnapshot[]): DraftedWizard[] {
  const byId = new Map(snapshot.map(s => [s.id, s]))
  return team
    .filter(dw => byId.get(dw.wizard.id)?.alive !== false)   // drop the dead
    .map(dw => {
      const snap = byId.get(dw.wizard.id)
      if (!snap) return dw
      // Store HP relative to the wizard's BASE maxHp, not the buffed battle maxHp,
      // so next battle's buff recompute starts from a clean base. Scale snapshot hp
      // (out of buffed maxHp) down to base maxHp proportionally.
      const frac = snap.maxHp > 0 ? snap.hp / snap.maxHp : 0
      return { ...dw, currentHp: Math.round(dw.maxHp * frac) }
    })
}
```

RATIONALE for the fraction scale: the snapshot HP is out of the *buffed* maxHp (which varies battle to battle with relics/synergies). Persisting the raw number would mean a buff that later expires leaves a wizard over-healed or the math drifts. Storing the **fraction of max** carried as base-relative absolute HP keeps it stable: 40% wounded stays 40% wounded regardless of buff swings. This is the one subtle correctness point — covered by tests in §5.

### 3.4 `nextBattle` + loss condition (engine)

`nextBattle` (`run.ts:51-79`) changes:
1. After `simulateBattle`, apply the snapshot to the roster: `const newTeam = applyBattleToRoster(state.team, result.finalSnapshot)`.
2. Recompute `activeSynergies` from `newTeam` (a shrunk team may break synergies).
3. **Loss / win / advance condition** (`const wiped = newTeam.length === 0`):
   - `wiped` (whole roster dead) → `'defeat'` (true game over)
   - else if `isBoss` → boss is win-or-bust: `result.winner === 'left'` → `'win'`, otherwise → `'defeat'` (you reached the boss but failed to beat it)
   - else (non-boss, survived with ≥1 alive) → `'victory'` (advance on the map — **even if the battle's `winner` was `'right'`**, as long as ≥1 wizard lived)
4. The returned `state` carries `team: newTeam` and the recomputed synergies.

```ts
const newTeam = applyBattleToRoster(state.team, result.finalSnapshot)
const newSyn = detectSynergies(newTeam)
const wiped = newTeam.length === 0
const phase: RunState['phase'] =
  wiped ? 'defeat'
  : isBoss ? (result.winner === 'left' ? 'win' : 'defeat')  // boss: win-or-bust
  : 'victory'                                                // non-boss: survive → advance
return {
  state: { ...state, team: newTeam, activeSynergies: newSyn, stage: state.stage + 1, lastBattle: result, phase },
  result, enemy, enemySyn, isBoss,
}
```

EDGE CASE — boss survived-but-not-won: reaching the boss, surviving (≥1 alive) but not killing it (turn-cap winner by HP%) resolves to `'defeat'` unless `result.winner === 'left'`. The boss is terminal (no further node), so there is no "survive and loop back" — it is win-or-bust. Tested.

### 3.5 Combat with team < 5

`simulateBattle`/`toBattleUnits` already map over `team` of any length — no hardcoded 5. Verify no consumer assumes 5:
- `generateEnemyTeam` uses `BALANCE.draft.teamSize` for the ENEMY (unchanged — enemies stay full teams).
- Targeting/turn-order iterate `L`/`R` arrays — length-agnostic.
- The risk is purely display (see §3.6). Engine is already size-flexible; this spec adds a test proving a 2-wizard player team fights correctly.

### 3.6 UI

- **TeamScreen / BattleScreen / replay:** render `state.team` as-is; a shorter array renders fewer tiles. HP bars must read persisted HP (the battle's starting HP now reflects wounds). Verify BattleScreen/HP-bar components don't assume 5.
- **VictoryScreen:** must communicate attrition. Show who died this battle (diff roster before/after) and current roster size. Copy in Italian. Minimal: "Hai perso: <names>" when someone died, and "Squadra: N maghi" remaining.
- **MapScreen / CampaignRunner:** unaffected by roster size; `useRun` already routes phases. `defeat` now means roster wiped; `ResultScreen` defeat copy updated ("La tua squadra è stata annientata").
- **useRun:** `nextBattle` returns the shrunk team in `state.team`; `useRun` already does `setRun(state)`. The `team` prop passed to screens should come from `c.run.team` (live roster), NOT the original `team` arg. AUDIT: `CampaignRunner` currently passes the original `team` prop to `BattleScreen`/`VictoryScreen` — change those to `c.run.team` so the displayed roster shrinks. This is the key UI wiring change.

## 4. Data flow

```
confirmTeam → team = full roster (currentHp absent = full)
  │
chooseNode → nextBattle:
  │   simulateBattle(state.team …) → finalSnapshot
  │   applyBattleToRoster(team, snapshot) → newTeam (dead dropped, survivors' currentHp set)
  │   detectSynergies(newTeam) → newSyn
  │   wiped? → defeat ; boss? win-or-defeat ; else victory
  └ state.team = newTeam (carried into next battle: wounds + missing members persist)
```

## 5. Testing

- **applyBattleToRoster** (run.test.ts): dead wizards dropped; survivors' `currentHp` set to base-relative fraction of snapshot HP; full-HP survivor → `currentHp === maxHp`; a wizard at 50% buffed HP → `currentHp ≈ 50% of base maxHp` (the fraction-scale correctness point); empty input → empty output.
- **HP carries into next battle** (run.test.ts / simulate): a roster with `currentHp` below max starts the next `toBattleUnits` at that HP (clamped into buffed max); `currentHp` absent → starts full.
- **Permanent death** (run.test.ts): after a battle where a wizard dies (force via a lopsided fixture), `nextBattle().state.team` excludes that wizard and length decreases.
- **Loss condition** (run.test.ts): roster wiped (all die) → phase `'defeat'`; survive with ≥1 → phase `'victory'` even when `result.winner === 'right'`; boss won → `'win'`; boss survived-not-won → `'defeat'`.
- **Synergy recompute** (run.test.ts): a synergy that needed 3 of a house breaks when death drops the team below threshold (activeSynergies reflect the shrunk team).
- **Team < 5 combat** (simulate test): a 2-wizard player team vs a 5-enemy team simulates to a decided result without error.
- **Determinism:** same seed → same deaths/HP. The HP-seeding change is deterministic (reads roster, no new RNG). Existing seed-dependent suites must stay green where they don't depend on full-heal-each-battle; campaignBalance will shift (attrition lowers clear rate) — reconcile as a BAND like the map spec did, preserving intent (run completes, balance within a range). Document the new measured clear-rate.
- **UI:** light render test that VictoryScreen shows a death notice when the roster shrank; BattleScreen renders a <5 team without crashing (if testing-library available).

## 6. Risks

- **Balance shift.** Attrition makes runs harder; clear-rate drops. Mitigation: reconcile campaignBalance as a band; flag the measured rate to the human for a later tuning pass (don't retune game constants in this spec unless asked).
- **Fraction-scale HP drift** (§3.3). The base-relative fraction is the subtle bit. Mitigation: explicit tests for the buffed-maxHp→base-maxHp scaling; round once, clamp on entry.
- **UI showing stale roster.** If any screen still reads the original `team` prop instead of `run.team`, dead wizards would still appear. Mitigation: the §3.6 audit + a VictoryScreen test; grep all `team={` usages in CampaignRunner.
- **Death-spiral despair.** Permanent death + no heal source yet means a bad early battle can doom a run with no recovery. This is intended (hardcore), and the upcoming events/relics provide the heal counterplay. Noted so it's a conscious design state, not a surprise.
