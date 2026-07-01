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
//   statMult 1.08) → winRate ~0.117, far below the 0.15 floor. Full area-boss parity requires a
//   future player-power spike or a scripted-boss slice — flat final-boss menace alone cannot reach it.
//   Parity DEFERRED pending player-power buff (Slice 3).
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

function runOne(seed: string, battleTurns?: number[]): 'win' | 'defeat' {
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
      const best = [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: off[0]!.id }, createRng(seed))
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
