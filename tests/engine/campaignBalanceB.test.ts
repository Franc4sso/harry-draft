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
