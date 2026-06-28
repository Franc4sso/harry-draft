# Veleno Validation & Counter-Web — Implementation Plan (Plan D of the Veleno slice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Validate the Veleno build with the deterministic engine: (1) counter-web matchup tests proving Veleno *beats* armor/shields and *loses* to regen and to burst; (2) a favor-Veleno run sweep that measures and asserts viability, draftability (Tossicità uptake), poison-damage share, and turn-budget.

**Architecture:** Test-only. No production code changes. Both tasks add deterministic, seeded tests modeled on the existing battle/`campaignBalanceB` harnesses. Task 2 also prints the real metrics to the console so the numbers are visible even when the guard asserts are loose (this is a validation gate, not a fixed target).

**Tech Stack:** TypeScript, Next.js, Vitest. Builds on Plan A (veleno status/tick/relics) and Plan B (Tossicità synergy + cap-lift), both merged.

## Global Constraints

- **Determinism:** every test uses fixed seeds; same seed → same result. No `Math.random`/`Date`.
- **No production changes:** this plan adds only test files. If a test reveals the build needs a *balance* change, that is a separate follow-up — record it, don't silently retune production here.
- **Counter-web invariants under test (slice spec §7.1):** veleno tick subtracts HP directly → bypasses both DEF (the formula only reduces *attack* damage by DEF) and shields (`absorbDamage` is never called for dot) → **beats Tank/Scudi**; veleno is a `removable` DOT and regen ticks against it → **loses to Regen**; veleno needs turns to ramp → **loses to Burst** (applier killed before the ramp).
- **Harness API (verbatim, from `tests/engine/campaignBalanceB.test.ts`):** `startRunB(seed)`, `starterOffer(seed, house)`, `chooseStarters(s, house, ids, rng)`, `reachable(s)`, `moveTo(s, id)`, `resolveCurrent(s, choice, rng)`, `recruitOffer(s, node, rng)`, `relicOffer(s, node, rng)`, `clearAreaAndAdvance(s, rng)`, `registerCoreResolvers()`. Choices: `{kind:'combat-ack'}`, `{kind:'recruit-pick', wizardId, replaceId?}`, `{kind:'relic-pick', relicId}`. `s.lastBattle` is a `BattleResult` (`.turns`, `.log`, `.winner`). `simulateBattle(left, right, rng, { leftSyn?, rightSyn?, leftRelics?, rightRelics?, rightMenace? })`.

---

## File Structure

- **Test** `tests/engine/velenoCounters.test.ts` — new; the 3 counter-web matchup tests.
- **Test** `tests/engine/velenoSweep.test.ts` — new; the favor-Veleno run sweep + metrics report.

---

### Task 1: Counter-web matchup tests

**Files:**
- Test: `tests/engine/velenoCounters.test.ts` (create)

**Interfaces:** Consumes `simulateBattle`, `createRng`, `RELICS`, `WIZARDS`, `SPELL_BY_ID`, types `BattleResult`/`DraftedWizard`/`ActiveRelic`/`ActiveSynergy`. Uses the Pugnale relic `pugnale-bellatrix` (100% onHit veleno, from Plan A).

- [ ] **Step 1: Write the matchup tests**

Create `tests/engine/velenoCounters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, Stats } from '@/types'

const pugnale = RELICS.find(r => r.id === 'pugnale-bellatrix')!   // 100% onHit → veleno

function mk(id: string, stats: Stats): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}
// Synthetic high-regen synergy for the Regen counter (kept off the roster so it's controlled).
function regenSyn(amount: number): ActiveSynergy {
  return { synergy: { id: 'test-regen', name: 'Test Regen', kind: 'group', requires: { count: 1 }, bonus: { regen: amount } }, memberIds: [] }
}
const pug: ActiveRelic[] = [{ relic: pugnale, stageObtained: 0 }]

describe('Veleno counter-web', () => {
  // A weak-attack poison applier: physical barely scratches, poison does the work.
  const velenoTeam = [mk('bellatrix', { hp: 200, atk: 8, def: 15, spd: 30 })]

  it('BEATS a Tank/Scudi enemy (poison bypasses huge DEF)', () => {
    // Enemy: enormous DEF (physical → minDamage), modest HP. Poison ignores DEF → kills it.
    const tank = [mk('greyback', { hp: 260, atk: 5, def: 500, spd: 1 })]
    const r: BattleResult = simulateBattle(velenoTeam, tank, createRng('ctr-tank'), { leftRelics: pug })
    expect(r.winner).toBe('left')
  })

  it('LOSES to a Regen enemy (sustain out-heals the poison)', () => {
    // Same matchup as the tank, but the enemy now regenerates 60/turn → out-heals the early ramp.
    const tank = [mk('greyback', { hp: 260, atk: 5, def: 500, spd: 1 })]
    const win = simulateBattle(velenoTeam, tank, createRng('ctr-regen'), { leftRelics: pug })
    const withRegen = simulateBattle(velenoTeam, tank, createRng('ctr-regen'), { leftRelics: pug, rightSyn: [regenSyn(60)] })
    expect(win.winner).toBe('left')          // baseline: poison wins
    expect(withRegen.winner).not.toBe('left') // regen flips it: poison can't out-pace the heal
  })

  it('LOSES to Burst (applier killed before the ramp)', () => {
    // A single squishy applier vs a fast one-shotter: dies turn 1, ~no poison accrues.
    const squishy = [mk('bellatrix', { hp: 30, atk: 8, def: 5, spd: 5 })]
    const burst = [mk('harry', { hp: 200, atk: 400, def: 20, spd: 99 })]
    const r = simulateBattle(squishy, burst, createRng('ctr-burst'), { leftRelics: pug })
    expect(r.winner).toBe('right')
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run tests/engine/velenoCounters.test.ts`
Expected: all 3 PASS. These encode the counter web: poison ignores DEF/shields (beats Tank/Scudi), regen out-heals it (loses to Regen), and burst denies the ramp (loses to Burst).

If a case is not decisive on the chosen seed/stats (e.g. the tank survives, or regen doesn't flip the result), tune the stats in the obvious direction (more enemy DEF/HP for the tank; higher regen amount for the regen case; higher burst ATK/SPD for the burst case) until each is unambiguous, and note the final values in your report. Do NOT weaken an assertion to pass — adjust the scenario so the intended property holds decisively.

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: PASS (current baseline 680 + 3 new = 683). Test-only; nothing else affected.

- [ ] **Step 4: Commit**

```bash
git add tests/engine/velenoCounters.test.ts
git commit -m "test(veleno): counter-web matchups — beats Tank/Scudi, loses to Regen/Burst"
```

---

### Task 2: Favor-Veleno viability sweep

**Files:**
- Test: `tests/engine/velenoSweep.test.ts` (create)

**Interfaces:** Consumes the full harness API (Global Constraints), plus `detectSynergies` (to detect Tossicità on the final team), `powerOf` (`@/game/engine/combat/teamGen`), and `BALANCE` (`@/data/constants`). The veleno relic ids to prefer: `ampolla-veleno`, `pugnale-bellatrix`, `boccino-doro`.

- [ ] **Step 1: Write the sweep harness + metrics**

Create `tests/engine/velenoSweep.test.ts`. It plays a *favor-Veleno* policy: Serpeverde starters preferring veleno-tagged, recruit veleno-tagged wizards, pick veleno relics when offered. It records win rate, Tossicità uptake, poison-damage share, and per-battle turns, and prints them. Guard asserts are deliberately loose floors that catch a *broken* build; the printed numbers are the real signal.

```typescript
import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { BALANCE } from '@/data/constants'
import type { RunNode, RunState, DraftedWizard } from '@/types'

registerCoreResolvers()

const VELENO_RELICS = new Set(['ampolla-veleno', 'pugnale-bellatrix', 'boccino-doro'])
const isVeleno = (dw: DraftedWizard) => (dw.wizard.tags ?? []).includes('veleno')

function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  // prefer recruit while we still want veleno bodies and the roster has room
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

interface RunMetrics { outcome: 'win' | 'defeat'; tossicita: boolean; dot: number; enemyDmg: number; turns: number[] }

function favorVelenoRun(seed: string): RunMetrics {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Serpeverde')
  const starters = [...offer]
    .sort((a, b) => (Number(isVeleno(b)) - Number(isVeleno(a))) || (powerOf(b) - powerOf(a)))
    .slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Serpeverde', starters, createRng(seed))
  const m: RunMetrics = { outcome: 'defeat', tossicita: false, dot: 0, enemyDmg: 0, turns: [] }
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') { m.outcome = 'win'; break }
    if (s.phase === 'defeat') { m.outcome = 'defeat'; break }
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, rng)
      if (s.lastBattle) {
        m.turns.push(s.lastBattle.turns)
        for (const e of s.lastBattle.log) {
          if (e.targetSide !== 'right') continue
          const v = e.value ?? 0
          m.enemyDmg += v
          if (e.flags.includes('dot')) m.dot += v
        }
      }
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const pick = [...off].sort((a, b) => (Number(isVeleno(b)) - Number(isVeleno(a))) || (powerOf(b) - powerOf(a)))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      // when full, replace the lowest-power NON-veleno member if any, else lowest power
      const replaceId = full
        ? ([...s.team].sort((a, b) => (Number(isVeleno(a)) - Number(isVeleno(b))) || (powerOf(a) - powerOf(b)))[0]!.wizard.id)
        : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: pick.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const pick = off.find(r => VELENO_RELICS.has(r.id)) ?? off[0]!
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: pick.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'area-cleared') { s = clearAreaAndAdvance(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    break
  }
  m.tossicita = detectSynergies(s.team).some(a => a.synergy.id === 'tossicita')
  return m
}

describe('favor-Veleno viability sweep', () => {
  const N = 120
  const runs = Array.from({ length: N }, (_, i) => favorVelenoRun(`vrun-${i}`))
  const wins = runs.filter(r => r.outcome === 'win').length
  const winRate = wins / N
  const tossRate = runs.filter(r => r.tossicita).length / N
  const totalDot = runs.reduce((s, r) => s + r.dot, 0)
  const totalEnemyDmg = runs.reduce((s, r) => s + r.enemyDmg, 0)
  const dotShare = totalEnemyDmg > 0 ? totalDot / totalEnemyDmg : 0
  const allTurns = runs.flatMap(r => r.turns).sort((a, b) => a - b)
  const medianTurns = allTurns.length ? allTurns[Math.floor(allTurns.length / 2)]! : 0
  const maxTurns = allTurns.length ? allTurns[allTurns.length - 1]! : 0

  // eslint-disable-next-line no-console
  console.log(`[veleno sweep] N=${N} winRate=${winRate.toFixed(3)} tossicitaRate=${tossRate.toFixed(3)} dotShare=${dotShare.toFixed(3)} medianTurns=${medianTurns} maxTurns=${maxTurns}`)

  it('is deterministic (same seeds → same outcomes)', () => {
    const again = Array.from({ length: N }, (_, i) => favorVelenoRun(`vrun-${i}`)).map(r => r.outcome)
    expect(again).toEqual(runs.map(r => r.outcome))
  })
  it('the build can win (not structurally broken)', () => {
    expect(winRate).toBeGreaterThan(0.05)
  })
  it('the build is draftable (Tossicità activates in a meaningful share of runs)', () => {
    expect(tossRate).toBeGreaterThan(0.10)
  })
  it('poison is a real damage channel when favored', () => {
    expect(dotShare).toBeGreaterThan(0.05)
  })
  it('fights resolve before the turn cap (no stalls)', () => {
    expect(maxTurns).toBeLessThan(BALANCE.combat.turnCap)
  })
})
```

- [ ] **Step 2: Run the sweep**

Run: `npx vitest run tests/engine/velenoSweep.test.ts`
Expected: PASS, and the `[veleno sweep] ...` line prints the real metrics. Record those numbers in your report verbatim — they are the validation result.

If a guard assert FAILS, do NOT loosen it blindly. First confirm the harness is wiring the favor-Veleno policy correctly (Serpeverde starters chosen, veleno recruits/relics preferred, `s.lastBattle.log` read for the right side). If the policy is correct and a metric is genuinely low (e.g. `tossicitaRate` < 0.10 because veleno relics/recruits rarely appear, or `winRate` < 0.05), that is a real finding about draftability/balance — report it as DONE_WITH_CONCERNS with the numbers and your diagnosis, and relax that one assert to a floor just below the observed value with an inline comment explaining it is a recorded baseline, not a target. The other asserts and the printed metrics stand.

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: PASS (683 + up to 5 new). Test-only.

- [ ] **Step 4: Commit**

```bash
git add tests/engine/velenoSweep.test.ts
git commit -m "test(veleno): favor-Veleno viability/draftability/dot-share/turn-budget sweep"
```

---

## Self-Review

**1. Spec coverage (slice spec §8 sweep + §7.1 counter web):**
- Viability (win rate), distinction (dot share), draftability (Tossicità uptake), turn-budget (median/max) → Task 2. ✓ (Asserts are loose floors + printed metrics, per the spec's "gate, then tune the dials" framing — calibration to a specific target is a follow-up, not this plan.)
- Counter web: beats Tank/Scudi (DEF/shield bypass), loses to Regen, loses to Burst → Task 1. ✓
- Optional Umbridge boss (slice spec §7) — deferred (the §7.1 matchup tests already validate the counter principle; a scripted boss is a content task for later).

**2. Placeholder scan:** none. Both tests contain complete code. The stat-tuning notes (Task 1 Step 2, Task 2 Step 2) are bounded, instructed adjustments with explicit directions and a "don't weaken the assertion" guardrail — not TBDs.

**3. Type consistency:** `RunMetrics` fields used consistently in `favorVelenoRun` and the describe aggregation. `isVeleno`/`VELENO_RELICS` reused across pick functions. Harness API calls match the verbatim signatures in Global Constraints. `regenSyn` returns a valid `ActiveSynergy` (synergy with `bonus.regen`).

---

## What this leaves to Plan C
Plan C (loadout panel + on-screen "VELENO ×N" callouts + MVP recap) is the remaining slice piece — pure UI/UX, gated on the user's visual direction. Plan D's numbers should inform whether any balance dial needs a turn before investing in that UI.
