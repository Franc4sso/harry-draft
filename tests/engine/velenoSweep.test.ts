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

// DIAGNOSTIC CONCLUSION (2026-06-28). Observed: winRate=0.758 tossicitaRate=0.525
// dotShare=0.359 medianTurns=2 maxTurns=39. A throwaway 3-policy diagnostic showed:
//   favorVeleno     winRate=0.758 medianTurns=2
//   serpeverdePower winRate=0.867 medianTurns=2   (Serpeverde, power-only, no veleno pref)
//   gryffPower      winRate=0.275 medianTurns=3   (calibrated Grifondoro baseline, in-band)
// → The veleno KIT is balanced (even slightly UNDER pure power: 0.758 < 0.867 — favoring
//   veleno costs win rate). The high win rate is a SERPEVERDE house-power imbalance, NOT a
//   veleno-slice defect, and medianTurns=2 is Serpeverde-specific (Grifondoro=3). Fixing the
//   Serpeverde imbalance (roster rebalance + recalibration) is a SEPARATE task, out of this
//   slice's scope. Do not nerf veleno on account of this win rate.
// Post-deatheater-nerf (25→12): winRate now 0.775 (was 0.758). Still > 0.05, kit intact.
//   Note: deatheater synergy fires in ~17% of power-greedy runs; nerf has negligible effect on
//   overall Serpeverde win rate — the imbalance root cause is Voldemort tier-1 stats + house synergy.
// Post-enemy-scaling-fix (menaceOffset -1.05→-0.70, 2026-06-29): winRate=0.442 tossicitaRate=0.317
//   dotShare=0.381 medianTurns=3 maxTurns=39. Kit still viable (>> 0.05 floor). Serpeverde
//   house-power skew partially mitigated by harder enemies; remaining gap handled in Slice 2.
// Post-boss-buff (finalBossMenace -0.50→-0.45, 2026-06-29): winRate=0.383 tossicitaRate=0.617
//   dotShare=0.389 medianTurns=2 maxTurns=39. Kit intact (>> 0.05 floor). Slight drop expected
//   (harder final boss); Serpeverde house-power skew remains the main driver.
// Post-live-infirmary (2026-06-30, C1 fix — menaceOffset -0.70→-0.75, finalBossMenace -0.45→-0.31): winRate=0.483
//   tossicitaRate=0.567 dotShare=0.390 medianTurns=3 maxTurns=37. Kit intact (>> 0.05).
// Post-floor-1=3 map change (2026-06-30, finalBossMenace -0.31→-0.40): winRate=0.492
//   tossicitaRate=0.558 dotShare=0.367 medianTurns=3 maxTurns=38. Kit intact (>> 0.05).
registerCoreResolvers()

const VELENO_RELICS = new Set(['ampolla-veleno', 'pugnale-bellatrix', 'boccino-doro'])
const isVeleno = (dw: DraftedWizard) => (dw.wizard.tags ?? []).includes('veleno')

function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
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
    if (s.phase === 'infirmary-node') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
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
