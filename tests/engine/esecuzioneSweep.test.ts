import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { detectSynergies } from '@/game/engine/synergy'
import { teamExecute } from '@/game/engine/execute'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { BALANCE } from '@/data/constants'
import type { RunNode, RunState, DraftedWizard } from '@/types'

// DIAGNOSTIC NOTE (2026-06-29). This is the Esecuzione mirror of velenoSweep. It biases choices
// to esecuzione-tagged wizards + the spada-grifondoro/sigillo-carnefice relics and reports
// winRate / executeUptake / turn-budget.
// Observed: winRate=0.850 spietatezzaRate=0.325 execUptakeRate=0.325 medianTurns=2 maxTurns=43.
// That 0.850 sits right beside the velenoSweep serpeverdePower=0.867 baseline (and far above the
// calibrated gryffPower=0.275) — i.e. the high win rate is the Serpeverde house-power skew, NOT an
// execute-kit defect (the kit is the same multiplier whatever the house). See remaining-work.md #4.
// Post-deatheater-nerf (25→12): winRate now 0.850 (was 0.850). Still > 0.05, kit intact.
//   deatheater synergy fires rarely in tag-biased picks; nerf has negligible effect on win rate.
// Post-enemy-scaling-fix (menaceOffset -1.05→-0.70, 2026-06-29): winRate=0.792 spietatezzaRate=0.308
//   execUptakeRate=0.350 medianTurns=2 maxTurns=40. Kit viable (>> 0.05 floor). Serpeverde skew
//   partially reduced; Voldemort rebalance (Slice 2) will further close the gap.
// Post-boss-buff (finalBossMenace -0.50→-0.45, 2026-06-29): winRate=0.792 spietatezzaRate=0.325
//   execUptakeRate=0.367 medianTurns=2 maxTurns=40. Kit intact (>> 0.05 floor). No change; boss
//   buff negligible for Serpeverde-biased runs at this stat level.
// Post-live-infirmary (2026-06-30, C1 fix — menaceOffset -0.70→-0.75, finalBossMenace -0.45→-0.31): winRate=0.808
//   spietatezzaRate=0.308 execUptakeRate=0.333 medianTurns=3 maxTurns=38. Kit intact (>> 0.05).
// Post-floor-1=3 map change (2026-06-30, finalBossMenace -0.31→-0.40): winRate=0.792
//   spietatezzaRate=0.267 execUptakeRate=0.267 medianTurns=3 maxTurns=39. Kit intact (>> 0.05).
// Post-Task-6 house tuning (2026-06-30, SLYTH_CUNNING adjusted): winRate=0.750
//   spietatezzaRate=0.267 execUptakeRate=0.267 medianTurns=3 maxTurns=39. Kit intact (>> 0.05).
//   Small drop (~0.04) from lower cunning values; Serpeverde dominance unchanged (Voldemort spell kit).
//
// Metric choice — IMPORTANT: there is NO total-damage assertion here. Execute is a damage
// MULTIPLIER on the killing blow, not a discrete channel like poison's `dot` flag, so a
// "execute damage share" number can't be cleanly attributed from the log without an engine
// change (deferred — see remaining-work.md, drama is user-gated). Instead we use winRate +
// turn-budget (kill-speed) + executeUptake (does the team actually field an execute source),
// echoing the velenoSweep lesson that kill speed — not total damage — is the honest signal.
//
// Expect the same SERPEVERDE house-power skew velenoSweep surfaced: most esecuzione wizards are
// Serpeverde (voldemort/snape/bellatrix/lucius/draco/greyback/crabbe/marcus), so a high winRate
// here is a house-power artifact, NOT an Esecuzione-slice defect. The Serpeverde rebalance is a
// SEPARATE task (remaining-work.md #4). Do not nerf the execute kit on account of this win rate.
registerCoreResolvers()

const EXEC_RELICS = new Set(['spada-grifondoro', 'sigillo-carnefice'])
const isExec = (dw: DraftedWizard) => (dw.wizard.tags ?? []).includes('esecuzione')

function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

interface RunMetrics { outcome: 'win' | 'defeat'; spietatezza: boolean; execUptake: boolean; turns: number[] }

function favorEsecuzioneRun(seed: string): RunMetrics {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Serpeverde')
  const starters = [...offer]
    .sort((a, b) => (Number(isExec(b)) - Number(isExec(a))) || (powerOf(b) - powerOf(a)))
    .slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Serpeverde', starters, createRng(seed))
  const m: RunMetrics = { outcome: 'defeat', spietatezza: false, execUptake: false, turns: [] }
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') { m.outcome = 'win'; break }
    if (s.phase === 'defeat') { m.outcome = 'defeat'; break }
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, rng)
      if (s.lastBattle) m.turns.push(s.lastBattle.turns)
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const pick = [...off].sort((a, b) => (Number(isExec(b)) - Number(isExec(a))) || (powerOf(b) - powerOf(a)))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full
        ? ([...s.team].sort((a, b) => (Number(isExec(a)) - Number(isExec(b))) || (powerOf(a) - powerOf(b)))[0]!.wizard.id)
        : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: pick.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const pick = off.find(r => EXEC_RELICS.has(r.id)) ?? off[0]!
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
  const synergies = detectSynergies(s.team)
  m.spietatezza = synergies.some(a => a.synergy.id === 'spietatezza')
  m.execUptake = teamExecute(s.team, s.relics, synergies) !== undefined
  return m
}

describe('favor-Esecuzione viability sweep', () => {
  const N = 120
  const runs = Array.from({ length: N }, (_, i) => favorEsecuzioneRun(`erun-${i}`))
  const wins = runs.filter(r => r.outcome === 'win').length
  const winRate = wins / N
  const spietatezzaRate = runs.filter(r => r.spietatezza).length / N
  const execUptakeRate = runs.filter(r => r.execUptake).length / N
  const allTurns = runs.flatMap(r => r.turns).sort((a, b) => a - b)
  const medianTurns = allTurns.length ? allTurns[Math.floor(allTurns.length / 2)]! : 0
  const maxTurns = allTurns.length ? allTurns[allTurns.length - 1]! : 0

  // eslint-disable-next-line no-console
  console.log(`[esecuzione sweep] N=${N} winRate=${winRate.toFixed(3)} spietatezzaRate=${spietatezzaRate.toFixed(3)} execUptakeRate=${execUptakeRate.toFixed(3)} medianTurns=${medianTurns} maxTurns=${maxTurns}`)

  it('is deterministic (same seeds → same outcomes)', () => {
    const again = Array.from({ length: N }, (_, i) => favorEsecuzioneRun(`erun-${i}`)).map(r => r.outcome)
    expect(again).toEqual(runs.map(r => r.outcome))
  }, 30000)
  it('the build can win (not structurally broken)', () => {
    expect(winRate).toBeGreaterThan(0.05)
  })
  it('the build fields execute in a meaningful share of runs (draftable)', () => {
    expect(execUptakeRate).toBeGreaterThan(0.10)
  })
  it('fights resolve before the turn cap (no stalls)', () => {
    expect(maxTurns).toBeLessThan(BALANCE.combat.turnCap)
  })
})
