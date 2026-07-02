import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { BALANCE } from '@/data/constants'
import type { RunNode, RunState } from '@/types'

// Register at module scope (idempotent): the greedy runs below are evaluated in
// the describe body at collection time, BEFORE any beforeAll hook would fire.
//
// *** KNOWN FAILING (2026-07-01, menace removal — urgent balance fix; UNRESOLVED) ***
// Enemy "menace" (a stat multiplier layered on top of leveled stats) is REMOVED — see
// data/constants.ts campaignB for the full rationale (it was a double nerf crushing
// every real enemy level to a 0.05-0.13x stat multiplier: enemies showing "2 attack,
// 1 defense" in area 0 despite having grown much higher leveled stats). Enemies now
// fight at their FULL leveled stats (multiplier 1.0). This makes them dramatically
// stronger, and campaignBalanceB winRate CRASHED from 0.1667 to 0.0000.
//
// Budget (`campaignB.baseBudget`/`budgetStep`/`eliteBudgetMult`/`bossBudgetMult`, plus
// Il Muro's own `budget`/`hpMult` in data/bosses.ts) was swept as the ONLY remaining
// difficulty lever (menace must not be reintroduced). Sweep highlights (120 seeds):
//   [300,70,1.15,1.3,muro(1000,1.3)] (baseline, unchanged since menace removal): 0.0000
//   [150,40,0.90,1.0,muro(600,0.9)]:  0.0000
//   [ 80,20,0.70,0.8,muro(400,0.7)]:  0.0167 (2/120)
//   [ 40,10,0.50,0.6,muro(250,0.5)]:  0.0167 (2/120)  <- SHIPPED (best found)
//   Even DEGENERATE values (baseBudget=0, budgetStep=0, eliteBudgetMult=0.05,
//   bossBudgetMult=0.05, enemyCountByArea=[2,2,3], Muro budget=10/hpMult=0.1/
//   unitDamageReduction=0.1/unitCount=2 — i.e. enemies at their absolute floor stats
//   and area-0 boss reduced to 2 units) only reached 0.0167 (2/120), NOT 0.15.
// Root cause: this is NOT a budget problem. `budgetWindow`'s percentile mapping floors
// out at the roster's weakest wizards regardless of how low the target budget goes —
// a diagnostic confirmed budget=0 produces IDENTICAL enemy stats to budget=300 (an
// area-0 elite squad measured lv4 atk=19/hp=78 in both cases). Loss-location tracing
// showed losses concentrated at area0-elite (37/120) and area0-boss (20-60/120)
// REGARDLESS of how far Muro/eliteBudgetMult were pushed down — an isolated matchup
// test (full HP, level-3 player trio vs area-0 elite trio, near-zero enemy budget)
// still only won 80% 1-on-1, but the SEQUENTIAL campaign (HP persistence across
// normal+elite+boss, plus the near-optimal test policy not always visiting the
// guaranteed pre-boss Infermeria) compounds those losses well below the floor.
// The real bottleneck is structural (area-0 enemy unit count 3 vs the player's
// starting 2, stacked with HP attrition across sequential fights), OUTSIDE the
// budget lever this task is scoped to change.
// CONCLUSION: campaignBalanceB's winnability assertion is EXPECTED TO FAIL (0.0167 <
// 0.15) after this menace-removal change. This was reported rather than masked with a
// fake-passing budget value or a reintroduced menace multiplier (explicitly forbidden).
// Recommendation for a follow-up slice: either (a) raise `normalEnemyCount`/starting
// roster size so area-0 unit counts match, (b) add an early forced-heal or reduce
// HP-persistence bleed between area-0 fights, or (c) revisit the near-optimal test
// policy's infirmary-skipping behavior — budget/boss-stat tuning alone cannot fix this.
//
// *** STILL FAILING (2026-07-02, enemy-LEVEL lowering — user-directed follow-up;
// UNRESOLVED, same root cause) ***
// User decision: lower enemy LEVELS (campaignB normalLevelBase/eliteLevelBase/
// bossLevelBase/perArea, data/constants.ts) instead of raising the starting roster,
// keeping enemies at honest FULL leveled stats for their (now lower) level — no
// menace/crush multiplier reintroduced. Swept bases 2/4/6 (perArea 2) all the way
// down to the hard floor (level 1 everywhere, perArea 0) — see data/constants.ts
// campaignB for the full table. Result: winRate is FLAT at ≈0.0167-0.0250 across the
// ENTIRE sweep range, topping out at 0.0250 only at the fully-degenerate all-level-1
// setting (which also breaks the elite>normal/area monotonicity invariants this file
// and enemyLevel.test.ts/finalBossClimax.test.ts require, so it was not shipped).
// Diagnostic confirmed why: `simulate.ts`'s turn loop lets EVERY living unit act
// EVERY turn — so `enemyCountByArea[0]=3` (elite/boss) vs the player's starting
// 2-3-unit roster is a permanent action-economy deficit (more enemy actions per turn
// than player actions) that compounds every round independent of per-unit stat
// totals; a direct stat-magnitude check at enemy level 1 showed enemy total team
// power was already comparable to or below the player's, yet win rate barely moved.
// This is the SAME structural bottleneck the budget sweep above already identified,
// now confirmed independent of BOTH levers (budget and level) that are allowed
// without reintroducing menace. CONCLUSION: the 0.15 floor is not reachable by
// tuning enemy stats (budget or level) alone; it requires a structural change
// (unit-count parity and/or guaranteed HP recovery between area-0 fights) — see the
// recommendation above, still valid. Shipped normalLevelBase/eliteLevelBase/
// bossLevelBase = 1/2/3 (perArea 1) — the best value found that preserves every
// required ordering invariant — as an honest partial mitigation, not a claim that
// the floor is met.
//
// Calibration (2026-06-29, post enemy-scaling fix — menaceOffset -1.05→-0.70, finalBossMenace -0.35→-0.50):
//   Observed winRate=0.167 (20/120 wins). Band tightened to [0.15, 0.45] for "much harder" target.
//   lv2-normal statMult 0.42 (was 0.07), lv10-boss statMult 1.38 (was 1.03) — enemies at level-coherent stats.
// Recalibration (2026-06-29, post death&recovery — Tasks 1–4 added death/benching + Infermeria heal):
//   finalBossMenace raised from -0.50 to -0.45 (statMult 0.50→0.55). Measured WITHOUT live Infermeria
//   (the Infermeria was dead code — generateMap not used at runtime). Numbers in this comment were wrong.
// Recalibration (2026-06-30, C1 fix — Infermeria now on LIVE path via generateArea):
//   Live Infermeria removes one combat floor per area (floor last-1 → infirmary instead of battle/recruit/relic).
//   Net effect: less XP/power-building per area; menaceOffset eased -0.70→-0.75 to compensate.
//   finalBossMenace raised to -0.31 (statMult 0.69, was 0.55). -0.31 is the highest value in the [0.15, 0.45]
//   band (winRate ≈ 0.158); -0.30 drops to 0.142. Does not reach area-2 boss statMult 1.38 (+0.38) — Slice 3.
// Recalibration (2026-06-30, floor-1=3 map change — first floor forced to 3 nodes for "first choice among 3"):
//   Floor-1 width=3 lowers win-rate ~1-2 pp; -0.31 now yields 0.142 (< 0.15 floor).
//   finalBossMenace eased to -0.40 (statMult 0.60): -0.36 → 0.158 (too close to edge), -0.40 → 0.167 (20/120).
//   Boss still well below area-2 strength (1.38); real climax awaits a player-power buff — Slice 3.
// Recalibration (2026-06-30, Task 6 house mechanics tuned — RAVEN_CRIT/HUFF_REDUCE/SLYTH_CUNNING adjusted):
//   winRate=0.183 (22/120). Grifondoro dodge kept at baseline (0.04/0.08/0.14) — raising dodge lowers win
//   rate (defensive stalls without enough damage output). Crit raised to push Corvonero to parity.
//   campaignBalanceB unchanged; house-mechanic tuning has <0.02 impact on Grifondoro win rate.
// Moderate boss buff (2026-07-01, backlog item #5 — finalBossMenace -0.40→-0.384, statMult 0.60→0.616):
//   The Serpeverde balance tune (Voldemort atk trim, post-Task6) moved the true winRate at -0.40 to
//   0.1583 (19/120), leaving only 0.0083 headroom. Empirical ceiling: -0.383→0.1500 (exactly 0.15, fails
//   strict >); -0.384→0.1583 (passes). -0.384 is the highest holding the floor. winRate=0.1583 (19/120).
//   Area-boss parity (statMult ≥ 1.33) is DEFERRED — see docs/superpowers/specs/2026-06-30-strong-final-boss-design.md.
// Recalibration (2026-07-01, snowball-flatten — growthBudgetPerLevel 0.40→0.28, user-approved):
//   Lowering player growth budget weakens players at high levels; menaceOffset eased more negative to compensate.
//   Sweep: -0.75→0.0667 (8/120), -0.60→0.0417 (5/120, wrong dir — less neg = harder early), -0.90→0.1417 (17/120),
//   -0.93→0.1583 (19/120, only 0.0083 headroom), -1.00→0.2000 (24/120, headroom 0.05 ✓).
//   Final: menaceOffset -0.75→-1.00. winRate=0.2000 (24/120), headroom=0.05 above 0.15 floor.
// Recalibration (2026-07-01, Task 1 — raise finalBossMenace; robustness fix):
//   Baseline (post snowball-flatten, menaceOffset=-1.00): finalBossMenace -0.384 → winRate 0.2000 (24/120).
//   Sweep (finalBossMenace → winRate): -0.30→0.1167 (14/120), -0.33→0.1500 (18/120, fails strict >),
//     -0.32→0.1083 (13/120), -0.334→pass, -0.331→pass, -0.3305→pass,
//     -0.3302→0.1583 (19/120, pass), -0.3301→0.1500 (18/120, fails strict >).
//   Absolute max holding the floor: -0.3302 (statMult 0.6698, winRate 0.1583, headroom 0.0083).
//   FRAGILE: -0.3302 is a 1-seed noise-fit (1 seed above the floor — flips on rng changes).
//   Robustness fix: use -0.34 (statMult 0.66), winRate=0.1667 (20/120), headroom=0.0167 (2 seeds).
//   Raising the final boss alone is a very winRate-expensive lever: parity (finalBossMenace +0.08,
//   statMult 1.08) → winRate ~0.042 (5/120), far below the 0.15 floor. Full area-boss parity requires a
//   future player-power spike or a scripted-boss slice — flat final-boss menace alone cannot reach it.
//   Parity DEFERRED pending player-power buff (Slice 3).
// Calibration (2026-07-01, Muro wall — 3-unit): added the two-profile veleno harness (preferVeleno
//   variant of runOne: recruit picks bias to veleno-tagged wizards, relic picks to veleno-keyword
//   relics; fallback to the power-greedy pick). Veleno bypasses MURO.unitDamageReduction by design
//   (poison ticks subtract HP directly), so it is the intended counter to the wall. MURO is now a
//   3-unit scripted area-0 boss (budget 1000, hpMult 1.3); prior task's canaries flipped green as a
//   side effect of the unit-count drop, NOT from wall tuning — so the margin was unmeasured until now.
//   Only allowed lever this slice: MURO.unitDamageReduction. Sweep (wall → [overall, scudi, withVeleno, noVeleno]):
//     wall 0.35 → [0.1500, 0.092, 0.217, 0.150]  (overall == 0.15, FAILS strict > floor)
//     wall 0.40 → [0.1583, 0.083, 0.225, 0.158]  (all four hold; overall headroom 0.0083)
//     wall 0.45 → [0.1583, 0.083, 0.225, 0.158]  (identical discrete outcomes to 0.40)
//     wall 0.50 → [0.1500, 0.083, 0.217, 0.150]  (overall == 0.15, FAILS strict > floor)
//   overall winRate == noVeleno winRate (the overall harness IS the noVeleno path). It is a small
//   plateau: {0.40, 0.45} pass identically; 0.35 and 0.50 each flip one seed to a loss (0.1500).
//   Chosen: wall 0.40 (mid of the passing plateau; conservative on the soft-wall/noVeleno side; no
//   number change vs. the shipped value — the sweep CONFIRMS 0.40 already satisfies all four targets).
//   Final winRates: campaignBalanceB overall 0.1583 (headroom 0.0083 above 0.15 floor, in (0.15,0.45)),
//   scudiRigen 0.083 (> 0.05 floor, headroom 0.033), withVeleno 0.225 > noVeleno 0.158 (gap +0.067 ✓),
//   noVeleno 0.158 > 0 (soft wall ✓). All four targets hold.
//   Area-0 boss power (MURO budget/hpMult/unitCount/wall) is now a floor-sensitive lever: any change to
//   it, or to Area-0 enemy scaling, must re-measure the campaignBalanceB floor (headroom is only ~1 seed).
// Calibration (2026-07-01, Task 8 — Bellatrix area-1 boss, ignoresTaunt signature):
//   Routed area 1's boss node to BELLATRIX (bossWizardId:'bellatrix', ignoresTaunt:true — whole boss
//   side skips the player Tank's tauntBonus in threat scoring, so it hits the real backline). This
//   alone dropped the floor: baseline (budget 900, hpMult 1.25, unitCount 5) measured 0.1417 (< 0.15).
//   ignoresTaunt is the dominant lever, not budget/hpMult: at unitCount 5, winRate stayed flat at
//   0.1417/0.1333 across budget 350→900 and hpMult 1.0→1.25 (with the flag on); toggling the flag OFF
//   at the same budget/hpMult recovered 0.1417–0.1500 (still short). unitCount 3 (matching Muro's
//   pattern) moved the needle more than budget: at hpMult 1.0, winRate sat flat at 0.1500 (fails
//   strict >) across budget 200→900 — a hard plateau independent of budget. hpMult had to drop
//   below 1.0 to flip the deciding seed: hpMult 0.85 passes at 0.1583 across budget∈[200,450]
//   (stable plateau, chosen budget 300 = mid); the exact boundary is hpMult 0.875 (pass, 0.1583) vs
//   0.88 (fail, 0.1500) — a 1-seed margin, consistent with every other floor-adjacent lever in this
//   file. Final: BELLATRIX budget 300, hpMult 0.85, unitCount 3, ignoresTaunt true.
//   winRate=0.1583 (19/120, headroom 0.0083 above the 0.15 floor). Area-1 boss power is now a
//   floor-sensitive lever: any future change to BELLATRIX or Area-1 enemy scaling must re-measure.
//
// *** STILL FAILING (2026-07-02, Task 18c — normalEnemyCount 2→1; UNRESOLVED, root cause
// confirmed elite/boss not normal fights) ***
// User decision: normal (non-elite/non-boss) battles field only 1 enemy wizard
// (`campaignB.normalEnemyCount` 2→1); `enemyCountByArea` ([3,4,5], elite/boss) left
// UNCHANGED per explicit instruction. Result: winRate did NOT move at all —
// campaignBalanceB stayed at 0.0167 (2/120), esecuzioneSweep/scudiRigenSweep/velenoSweep
// stayed at 0.000/0.0167→0.0333/0.0333 (noise-level, same order of magnitude as before).
// A loss-location trace of the same 120 seeds (near-optimal pickNode, which prefers
// `elite` over `battle` whenever both are reachable) explains why: losses concentrate at
// area0-elite (36/120), area2-boss (18/120), area0-boss (17/120), area1-elite (12/120),
// area1-boss (11/120), area2-elite (10/120) — only 10 (battle) + 4 (battle) = 14/120
// losses were ever at a plain normal-battle node, and those were already survivable
// relative to the elite/boss bottleneck. Shrinking normalEnemyCount fixes fights the
// near-optimal player was already winning; it cannot touch the actual bottleneck
// (elite/boss unit-count vs. the player's still-small early roster), which
// `enemyCountByArea` governs and this task was explicitly told not to touch.
// CONCLUSION: normalEnemyCount alone does not clear the 0.15 floor. Shipped anyway
// (1 enemy in normal fights is a real, uncontroversial UX/economy improvement per the
// user's decision) but it does NOT resolve area-0 winnability by itself. The next lever
// is elite/boss unit count and/or budget/hpMult on `enemyCountByArea`-driven nodes, or a
// structural change (extra roster growth / guaranteed recovery before area-0 elite) —
// see the recommendation in the prior (2026-07-01) note, still valid. Reported per the
// task's explicit instruction to STOP and report rather than unilaterally trim
// elite/boss counts.
registerCoreResolvers()

// Near-optimal ("upper-bound") player policy. A pure recruit/relic-first greedy is
// NOT upper-bound: it dodges every fight and reaches each area boss at level 1, so it
// is structurally unwinnable. A competent player builds a functional core, then FIGHTS
// for EXP (the run's only power source), filling the roster and grabbing relics along
// the way. This models the strongest realistic player the band must remain beatable for.
function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

// Veleno = the intended counter to the Muro wall (poison bypasses unitDamageReduction).
// The preferVeleno policy variant biases recruit picks to veleno-tagged wizards and relic
// picks to veleno-keyword relics; otherwise it is identical to the near-optimal policy.
function isVeleno(dw: { wizard: { tags?: string[] } }): boolean {
  return (dw.wizard.tags ?? []).includes('veleno')
}

function runOne(seed: string, battleTurns?: number[], preferVeleno = false): 'win' | 'defeat' {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Grifondoro')
  const starters = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starters, createRng(seed))
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') return 'win'
    if (s.phase === 'defeat') return 'defeat'
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, rng)
      if (battleTurns && s.lastBattle) battleTurns.push(s.lastBattle.turns)
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const velenoCand = [...off].filter(isVeleno).sort((a, b) => powerOf(b) - powerOf(a))[0]
      const best = preferVeleno
        ? (velenoCand ?? [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!)
        : [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const velenoRelic = off.find(r => (r.keywords ?? []).includes('veleno'))
      const chosen = preferVeleno ? (velenoRelic ?? off[0]!) : off[0]!
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: chosen.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'infirmary-node') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'area-cleared') { s = clearAreaAndAdvance(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    break
  }
  return 'defeat'
}

describe('campaign balance (new loop)', () => {
  const N = 120
  const outcomes = Array.from({ length: N }, (_, i) => runOne(`run-${i}`))
  const winRate = outcomes.filter(o => o === 'win').length / N

  // eslint-disable-next-line no-console
  console.log(`[campaignBalanceB overall] winRate=${winRate.toFixed(4)}`)

  it('is winnable but not trivial for a near-optimal player', () => {
    expect(winRate).toBeGreaterThan(0.15)
    expect(winRate).toBeLessThan(0.45)
  })
  it('is deterministic (same seeds → same outcomes)', () => {
    const again = Array.from({ length: N }, (_, i) => runOne(`run-${i}`))
    expect(again).toEqual(outcomes)
  })
  it('no battle stalls to the turn cap on any seed (avoids stalemates)', () => {
    const turns: number[] = []
    for (let i = 0; i < N; i++) runOne(`run-${i}`, turns)
    expect(turns.length).toBeGreaterThan(0)
    expect(Math.max(...turns)).toBeLessThan(BALANCE.combat.turnCap)
  })
})

describe('Muro wall — veleno is the counter', () => {
  const N = 120
  const withVeleno = Array.from({ length: N }, (_, i) => runOne(`run-${i}`, undefined, true))
  const noVeleno = Array.from({ length: N }, (_, i) => runOne(`run-${i}`, undefined, false))
  const wr = (o: ('win' | 'defeat')[]) => o.filter(x => x === 'win').length / N

  // eslint-disable-next-line no-console
  console.log(`[muro veleno] N=${N} withVeleno=${wr(withVeleno).toFixed(3)} noVeleno=${wr(noVeleno).toFixed(3)}`)

  it('veleno players win more than non-veleno players (the wall teaches)', () => {
    expect(wr(withVeleno)).toBeGreaterThan(wr(noVeleno))
  })
  it('soft wall: non-veleno play is still winnable (above zero)', () => {
    expect(wr(noVeleno)).toBeGreaterThan(0)
  })
})
