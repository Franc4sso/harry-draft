# Provocazione Vera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Tank's Provocazione a real taunt — every attacking enemy role (Attaccante, Tank, offensive Supporto, and a Controllo that can hard-control) targets a taunting Tank; only a Controllo spending a stun/freeze/silence bypasses it.

**Architecture:** One file — `game/engine/combat/targeting.ts`, function `selectTarget`. Add a small `activeTauntTank(enemies)` helper (a live Tank that provokes and isn't hard-controlled). Gate the Tank / Controllo / offensive-Supporto branches on it. Reuse the existing `threatScore` tauntBonus and the existing "stunned Tank loses taunt" rule (`isUnderHardControl`). No new engine state, no new status.

**Tech Stack:** TypeScript, Vitest. All logic in `game/engine/combat/targeting.ts`; helpers `HARD_CONTROL_KINDS`/`isUnderHardControl` from `game/engine/combat/roleCounter.ts`.

## Global Constraints

- Copy in italiano. Commit + push to master without asking when work is done.
- ONLY `targeting.ts` logic — no new engine state, no new status, no change to `tauntBonus` (=1000), role passives, or the RPS cycle.
- Reuse the existing "Tank under hard-control loses Provocazione" rule (`threatScore` via `isUnderHardControl`) — do not duplicate it.
- `npm run test` does NOT run typecheck → run `npm run typecheck` separately.
- The balance bot doesn't understand counters → winRates are smoke checks. Re-measure `campaignBalanceB` + `campaignBalanceRestricted`; assert lives are `winRate > 0`.
- `ignoresTaunt` (Bellatrix) must skip the taunt gate for EVERY role, not only Attaccante.

## Behaviour table (enemy Tank provokes AND is not hard-controlled)

| Attacking enemy role | Target |
|---|---|
| Attaccante | the taunting Tank (unchanged — already `highestThreat` when taunt active) |
| Tank | the taunting Tank (`highestThreat`) — was `lowestHp` |
| Supporto w/ offensive spell | the taunting Tank (`highestThreat`) |
| Controllo **with a hard-control spell** (stun/freeze/silence) | the taunting Tank (`highestThreat`) — to break the taunt |
| Controllo with a soft/other spell | `backlineTarget` (scavalca — no point hammering an unbreakable wall) |
| Supporto/healer (Cura/Difesa spell) | its own allies (unchanged) |

When the taunting Tank IS hard-controlled, or there is no taunting Tank, every role reverts to its natural targeting.

**Sim evidence (validated 2026-07-07):** the naive "Controllo always targets the taunting Tank" made a soft-control Controllo hammer the Tank uselessly (68 hits, 2 on backline, never breaking the taunt). The hard-control gate fixed it: confundo (soft) → Tank 0 / backline 12; petrificus/imperio (hard) → nearly all on the Tank.

---

### Task 1: `activeTauntTank` helper + Tank/Supporto branches honor the taunt

**Files:**
- Modify: `game/engine/combat/targeting.ts`
- Test: `tests/engine/combat/targeting.test.ts`

**Interfaces:**
- Consumes: `isUnderHardControl` (already imported from `./roleCounter`), `highestThreat`, `lowestHp`, `backlineTarget`, `threatScore` (all already in this file).
- Produces: `function activeTauntTank(enemies: BattleUnit[], ignoresTaunt: boolean): boolean` — true iff some live enemy Tank provokes (role Tank, alive, not `isUnderHardControl`) and the actor does not ignore taunt.

- [ ] **Step 1: Write failing tests (Tank + offensive Supporto honor the taunt)**

Add to `tests/engine/combat/targeting.test.ts` (uses the file's existing `u(id, role, side, over)` helper and `selectTarget`):

```ts
  it('an enemy Tank focuses the taunting Tank, not the squishiest', () => {
    const me = u('bruiser', 'Tank', 'left')
    const enemies = [u('squishy', 'Supporto', 'right', { atk: 10, spd: 10 }), u('wall', 'Tank', 'right')]
    // A Tank normally hits lowest-HP; with an enemy taunt active it must hit the wall.
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('wall')
  })

  it('an offensive Supporto focuses the taunting Tank', () => {
    const me = u('narc', 'Supporto', 'left')
    const enemies = [u('squishy', 'Attaccante', 'right', { atk: 40, spd: 40 }), u('wall', 'Tank', 'right')]
    // Give the Supporto an offensive spell so it aims at an enemy at all.
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['serpensortia']!)?.wizard.id).toBe('wall')
  })

  it('a Tank ignores a STUNNED enemy Tank (taunt suppressed) and hits the squishiest', () => {
    const me = u('bruiser', 'Tank', 'left')
    const stunnedWall = u('wall', 'Tank', 'right'); stunnedWall.statusEffects = [{ kind: 'stun', remaining: 1, stacks: 1 } as never]
    const enemies = [u('squishy', 'Supporto', 'right', { hp: 30, atk: 10, spd: 10 }), stunnedWall]
    expect(selectTarget(me, [me], enemies)?.wizard.id).toBe('squishy')
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/engine/combat/targeting.test.ts -t "taunting Tank"`
Expected: the Tank and offensive-Supporto cases FAIL (current code: Tank→lowestHp hits squishy; offensive Supporto→highestThreat already works but verify).

- [ ] **Step 3: Add the helper + gate the Tank and Supporto branches**

In `game/engine/combat/targeting.ts`, add the helper above `selectTarget`:

```ts
// A live enemy Tank that is actively provoking (role Tank, alive, not hard-controlled).
// The actor's own ignoresTaunt (Bellatrix) frees it from every taunt.
function activeTauntTank(enemies: BattleUnit[], ignoresTaunt: boolean): boolean {
  if (ignoresTaunt) return false
  return enemies.some(e => e.wizard.role === 'Tank' && e.alive && !isUnderHardControl(e))
}
```

In `selectTarget`, compute once (after `enemyPool` is built):

```ts
  const ign = actor.ignoresTaunt ?? false
  const taunt = activeTauntTank(enemyPool, ign)
```

Change `case 'Tank'`:

```ts
    case 'Tank':
      return taunt ? highestThreat(enemyPool, ign) : lowestHp(enemyPool)
```

Change the offensive branch of `case 'Supporto'` (the `spell.type === 'Attacco' || 'Controllo'` block) so an active taunt overrides:

```ts
      if (spell && (spell.type === 'Attacco' || spell.type === 'Controllo')) {
        if (taunt) return highestThreat(enemyPool, ign)
        return spell.type === 'Controllo' ? backlineTarget(enemyPool) : highestThreat(enemyPool)
      }
```

(Do NOT change the Attaccante branch's own `tauntActive`/`ign` logic in this task — it already honors the taunt; Task 1 must not break it. Leave `case 'Controllo'` for Task 2.)

- [ ] **Step 4: Run the new tests + the whole file**

Run: `npx vitest run tests/engine/combat/targeting.test.ts`
Expected: PASS (new cases green; the pre-existing "Attacker focuses the enemy Tank" and Affondo/Controllo cases still green).

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/targeting.ts tests/engine/combat/targeting.test.ts
git commit -m "feat(combat): Tank + offensive Supporto honor the Provocazione taunt"
```

---

### Task 2: Controllo bypasses the taunt only with a hard-control spell

**Files:**
- Modify: `game/engine/combat/targeting.ts` (`case 'Controllo'` + the roleCounter import)
- Test: `tests/engine/combat/targeting.test.ts`

**Interfaces:**
- Consumes: `activeTauntTank` (Task 1), `appliesControl` (already in this file), `HARD_CONTROL_KINDS` (add to the existing `./roleCounter` import), `highestThreat`, `backlineTarget`.

- [ ] **Step 1: Write failing tests (hard-control → Tank; soft-control → backline)**

Add to `tests/engine/combat/targeting.test.ts`:

```ts
  it('a Controllo with a HARD-control spell targets the taunting Tank to break it', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('healer', 'Supporto', 'right'), u('wall', 'Tank', 'right')]
    // petrificus applies stun (a hard control) → spend it on the wall.
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['petrificus']!)?.wizard.id).toBe('wall')
  })

  it('a Controllo with a SOFT-control spell scavalca the taunt to the backline', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const enemies = [u('healer', 'Supporto', 'right'), u('wall', 'Tank', 'right')]
    // confundo applies only a spd debuff (no hard control) → no point hammering the wall.
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['confundo']!)?.wizard.id).toBe('healer')
  })

  it('a Controllo with hard-control still scavalca when the Tank is already stunned', () => {
    const me = u('ctrl', 'Controllo', 'left')
    const stunnedWall = u('wall', 'Tank', 'right'); stunnedWall.statusEffects = [{ kind: 'stun', remaining: 1, stacks: 1 } as never]
    const enemies = [u('healer', 'Supporto', 'right'), stunnedWall]
    expect(selectTarget(me, [me], enemies, SPELL_BY_ID['petrificus']!)?.wizard.id).toBe('healer')
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/engine/combat/targeting.test.ts -t "Controllo"`
Expected: the hard-control case FAILS (current Controllo → `backlineTarget` always hits healer, never the wall).

- [ ] **Step 3: Import HARD_CONTROL_KINDS + gate the Controllo branch**

In `game/engine/combat/targeting.ts`, extend the existing roleCounter import:

```ts
import { isUnderHardControl, HARD_CONTROL_KINDS } from './roleCounter'
```

Replace `case 'Controllo': return backlineTarget(enemyPool)` with:

```ts
    case 'Controllo': {
      // Controllo counters a taunting Tank ONLY by hard-controlling it (stun/freeze/silence),
      // spending that control to break the taunt. With a soft spell it scavalca to the backline
      // — hammering an unbreakable wall is wasted (validated by sim). Once the Tank is stunned,
      // activeTauntTank is false → it scavalca like usual.
      const canHardControl = spell
        ? [...appliesControl(spell)].some(k => HARD_CONTROL_KINDS.has(k))
        : false
      return (taunt && canHardControl) ? highestThreat(enemyPool) : backlineTarget(enemyPool)
    }
```

- [ ] **Step 4: Run the new tests + the whole targeting file + controlTargeting**

Run: `npx vitest run tests/engine/combat/targeting.test.ts tests/engine/controlTargeting.test.ts`
Expected: PASS. The existing "Controllo bypasses the taunt and hits the enemy Supporto" (targeting.test.ts:37) and "Controllo hits a Tank only if nothing else is alive" (:43) both call `selectTarget` with NO spell arg → `canHardControl=false` → they route to `backlineTarget` exactly as before, so they STAY green unchanged. Do not modify them.

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/targeting.ts tests/engine/combat/targeting.test.ts
git commit -m "feat(combat): Controllo bypasses taunt only via hard-control (else scavalca)"
```

---

### Task 3: Full-sim regression + balance re-measure

**Files:**
- Test: uses existing suites; no new file unless a regression needs one.

- [ ] **Step 1: Full-battle sanity — the taunting Tank draws the fire**

Write a throwaway test (delete after) that runs a full `simulateBattle`: a taunting player Tank + squishy carry vs a MIXED enemy team (Attaccante + Tank + Controllo-with-hard-control + Supporto). Count enemy hits on the player Tank vs the carry. Expected: the Tank absorbs the large majority of enemy actions until it is stunned. Record the ratio in the report, then delete the throwaway.

- [ ] **Step 2: Full regression + typecheck**

Run: `npm run test` → all green (report count). `npm run typecheck` → clean. Fix any test that asserted the OLD Tank/Controllo targeting; only re-anchor if the assertion INTENT is preserved (flag each one in the report).

- [ ] **Step 3: Balance re-measure**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts tests/engine/campaignBalanceRestricted.test.ts` → PASS (`winRate > 0`). Record both winRates. Measure before/after via git-stash of `targeting.ts` if a delta is wanted. If `campaignBalanceB` drops below ~0.15 (the documented floor), STOP and report — do NOT touch `tauntBonus`; the lever is the Controllo bypass breadth.

- [ ] **Step 4: Commit any re-anchored fixtures + update HANDOFF**

Add a HANDOFF section (provocazione vera: all attacking roles honor the taunt; Controllo bypass gated on hard-control; balance numbers). Then:

```bash
git add -A
git commit -m "test(combat): provocazione full-sim + balance re-measure; docs(handoff)"
git push origin master
```

---

## Self-review notes

- Spec coverage: behaviour table (Task 1 Tank/Supporto, Task 2 Controllo), `activeTauntTank` helper (Task 1), hard-control gate (Task 2), `ignoresTaunt` for all roles (Task 1 helper takes `ignoresTaunt`), stunned-Tank-frees-team (reuses `isUnderHardControl`, tested Task 1/2), balance re-measure (Task 3). All covered.
- Type consistency: `activeTauntTank(enemies, ignoresTaunt)` used identically in Tasks 1 & 2; `HARD_CONTROL_KINDS`/`appliesControl`/`highestThreat`/`backlineTarget` names match the actual exports.
- The Attaccante branch is explicitly left unchanged (already honors taunt) — Task 1 must not regress it; Step 4 of Task 1 re-runs the whole file to catch that.
- Note for the implementer: `case 'Controllo'` currently is a bare `return backlineTarget(enemyPool)` with no block — Task 2 converts it to a `{ ... }` block; make sure the switch still compiles (add braces).
