import type { RunState } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { generateArea, parseAreaNodeId } from './map'
import { areaRng } from './runEngine'
import { endlessScore } from './endlessScore'

/** Global floor index across the infinite run: completed areas × floorsPerArea plus
 *  the floor-within-area of the current node. */
export function globalFloor(state: RunState): number {
  const area = state.area ?? 0
  const within = state.currentNodeId ? parseAreaNodeId(state.currentNodeId).floor : 0
  return area * BALANCE.map.floorsPerArea + within
}

/** Endless counterpart to runEngine.clearAreaAndAdvance: ALWAYS generates the next area
 *  (never returns phase:'win'), with the same guaranteed full-recovery heal at the
 *  boundary. Enemy difficulty for the new area comes from endlessEnemyLevel(globalFloor). */
export function advanceEndlessArea(state: RunState, _rng: Rng): RunState {
  const nextArea = (state.area ?? 0) + 1
  const map = generateArea(areaRng(state.seed, nextArea), state.seed, nextArea,
    { teamSize: state.team.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  const team = state.team.map(dw => ({ ...dw, currentHp: dw.maxHp }))
  return { ...state, team, area: nextArea, map, currentNodeId: entry.id, phase: 'map' }
}

/** Extracts score inputs from a finished/wiped Endless run and returns the final score.
 *  NOTE: elite/boss kills are counted from resolved nodes in `state.map`, which holds
 *  only the CURRENT area's nodes (regenerated each area by advanceEndlessArea) — so
 *  this counts kills in the final area only, not cumulatively across the whole run.
 *  (The combat resolver never pushes 'elite'/'boss' RunEvents into state.log, despite
 *  those kinds existing in the RunEvent.kind union, so state.log cannot be used here.) */
export function scoreForEndlessRun(state: RunState): number {
  const floorsCleared = globalFloor(state)
  const map = state.map ?? []
  const eliteKills = map.filter(n => n.type === 'elite' && n.resolved).length
  const bossKills = map.filter(n => n.type === 'boss' && n.resolved).length
  const team = state.team
  const hpFraction = team.length
    ? team.reduce((a, d) => a + (d.maxHp > 0 ? (d.currentHp ?? d.maxHp) / d.maxHp : 0), 0) / team.length
    : 0
  return endlessScore({ floorsCleared, eliteKills, bossKills, hpFraction })
}
