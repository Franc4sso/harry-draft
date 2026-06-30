import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { detectSynergies } from '@/game/engine/synergy'
import { teamDarkMagic } from '@/game/engine/darkMagic'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { BALANCE } from '@/data/constants'
import type { RunNode, RunState, DraftedWizard } from '@/types'

// Mirror of scudiRigenSweep. Biases to magieOscure wizards + marchio/diadema relics, Serpeverde start.
// Metric: winRate + oscuritaRate + darkUptakeRate + recoilDeaths + medianTurns + maxTurns.
// recoilDeaths is the archetype's risk signature (diagnostic, not a hard threshold).
// Expect a Serpeverde house-power skew (same pattern as esecuzione/veleno sweeps).
//
// DIAGNOSTIC NOTE (2026-06-29):
// Observed: winRate=0.950 oscuritaRate=0.183 darkUptakeRate=0.208 recoilDeaths=2 medianTurns=2 maxTurns=37.
// winRate=0.950 — high (Serpeverde house-power skew, same pattern as esecuzione/veleno sweeps).
// darkUptakeRate=0.208 > 0.10 — bias landing; marchio/diadema appear in offers, dark wizards in recruits.
// recoilDeaths=2/120 battles — low fraction, archetype not self-destructing excessively; no lever change needed.
// maxTurns=37 < turnCap — no stalls.
// bonus and recoil NOT tuned (data/relics.ts unchanged; marchio-nero bonus=0.5, recoil=0.2).
// Post-deatheater-nerf (25→12): winRate now 0.950 (was 0.950). Still > 0.05, kit intact.
//   deatheater synergy fires rarely in tag-biased picks; nerf has negligible effect on win rate.
// Post-enemy-scaling-fix (menaceOffset -1.05→-0.70, 2026-06-29): winRate=0.942 oscuritaRate=0.183
//   darkUptakeRate=0.208 recoilDeaths=2 medianTurns=2 maxTurns=36. Kit viable (>> 0.05 floor).
//   High winRate persists (Serpeverde skew + mageOscure overlap); Slice 2 handles rebalance.
// Post-boss-buff (finalBossMenace -0.50→-0.45, 2026-06-29): winRate=0.942 oscuritaRate=0.200
//   darkUptakeRate=0.217 recoilDeaths=2 medianTurns=2 maxTurns=36. Kit intact. No change; Serpeverde
//   dominance absorbs the marginal boss buff.
// Post-live-infirmary (2026-06-30, C1 fix — menaceOffset -0.70→-0.75, finalBossMenace -0.45→-0.31): winRate=0.925
//   oscuritaRate=0.142 darkUptakeRate=0.142 recoilDeaths=0 medianTurns=2 maxTurns=36. Kit intact (>> 0.05).
registerCoreResolvers()

const DARK_RELICS = new Set(['marchio-nero', 'diadema-corrotto'])
const isDark = (dw: DraftedWizard) => (dw.wizard.tags ?? []).includes('magieOscure')

function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

interface RunMetrics { outcome: 'win' | 'defeat'; oscurita: boolean; darkUptake: boolean; recoilDeaths: number; turns: number[] }

function favorDarkRun(seed: string): RunMetrics {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Serpeverde')
  const starters = [...offer]
    .sort((a, b) => (Number(isDark(b)) - Number(isDark(a))) || (powerOf(b) - powerOf(a)))
    .slice(0, 2).map(d => d.wizard.id)
  s = chooseStarters(s, 'Serpeverde', starters, createRng(seed))
  const m: RunMetrics = { outcome: 'defeat', oscurita: false, darkUptake: false, recoilDeaths: 0, turns: [] }
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
        if (s.lastBattle.log.some(e => e.flags.includes('recoil'))
            && s.lastBattle.log.some(e => e.flags.includes('kill') && e.targetSide === 'left')) {
          m.recoilDeaths += 1
        }
      }
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const pick = [...off].sort((a, b) => (Number(isDark(b)) - Number(isDark(a))) || (powerOf(b) - powerOf(a)))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full
        ? ([...s.team].sort((a, b) => (Number(isDark(a)) - Number(isDark(b))) || (powerOf(a) - powerOf(b)))[0]!.wizard.id)
        : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: pick.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const pick = off.find(r => DARK_RELICS.has(r.id)) ?? off[0]!
      // auto-assign the Marchio to the highest-HP dark caster on the team (sweep has no UI)
      let assignedTo: string | undefined
      if (pick.id === 'marchio-nero') {
        const darkOnTeam = s.team.filter(isDark)
        const pool = darkOnTeam.length ? darkOnTeam : s.team
        assignedTo = [...pool].sort((a, b) => b.stats.hp - a.stats.hp)[0]?.wizard.id
      }
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: pick.id, assignedTo }, createRng(seed))
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
  m.oscurita = synergies.some(a => a.synergy.id === 'oscurita')
  m.darkUptake = Object.keys(teamDarkMagic(s.team, s.relics, synergies)).length > 0
  return m
}

describe('favor-Magie Oscure viability sweep', () => {
  const N = 120
  const runs = Array.from({ length: N }, (_, i) => favorDarkRun(`morun-${i}`))
  const wins = runs.filter(r => r.outcome === 'win').length
  const winRate = wins / N
  const oscuritaRate = runs.filter(r => r.oscurita).length / N
  const darkUptakeRate = runs.filter(r => r.darkUptake).length / N
  const recoilDeaths = runs.reduce((s, r) => s + r.recoilDeaths, 0)
  const allTurns = runs.flatMap(r => r.turns).sort((a, b) => a - b)
  const medianTurns = allTurns.length ? allTurns[Math.floor(allTurns.length / 2)]! : 0
  const maxTurns = allTurns.length ? allTurns[allTurns.length - 1]! : 0

  // eslint-disable-next-line no-console
  console.log(`[magie-oscure sweep] N=${N} winRate=${winRate.toFixed(3)} oscuritaRate=${oscuritaRate.toFixed(3)} darkUptakeRate=${darkUptakeRate.toFixed(3)} recoilDeaths=${recoilDeaths} medianTurns=${medianTurns} maxTurns=${maxTurns}`)

  it('is deterministic (same seeds → same outcomes)', () => {
    const again = Array.from({ length: N }, (_, i) => favorDarkRun(`morun-${i}`)).map(r => r.outcome)
    expect(again).toEqual(runs.map(r => r.outcome))
  })
  it('the build can win (not structurally broken)', () => {
    expect(winRate).toBeGreaterThan(0.05)
  })
  it('the build fields dark magic in a meaningful share of runs (draftable)', () => {
    expect(darkUptakeRate).toBeGreaterThan(0.10)
  })
  it('fights resolve before the turn cap (no stalls)', () => {
    expect(maxTurns).toBeLessThan(BALANCE.combat.turnCap)
  })
})
