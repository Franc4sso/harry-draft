import type { DraftedWizard, GrowthChoice, House, RunNode, RunState } from '@/types'
import type { Rng } from './rng'
import { createRng } from './rng'
import { mapRngChannel } from './map'
import { generateArea, parseAreaNodeId } from './map'
import { createDraftPool } from './draft'
import { draftWizard } from './statRoll'
import { offerRecruits, recruitVia } from './recruit'
import { detectSynergies } from './synergy'
import { applyGrowthChoice } from './leveling'
import { combatResolver } from './resolvers/combat'
import { recruitResolver, relicResolver } from './resolvers/recruit'
import { registerResolver, resolverFor } from './resolvers'
import type { ResolverChoice } from './resolvers/types'
import { BALANCE } from '@/data/constants'

let registered = false
export function registerCoreResolvers(): void {
  if (registered) return
  registerResolver(combatResolver)                 // id 'battle'
  registerResolver({ ...combatResolver, id: 'elite' })
  registerResolver({ ...combatResolver, id: 'boss' })
  registerResolver(recruitResolver)                // id 'recruit'
  registerResolver(relicResolver)                  // id 'relic'
  registered = true
}

export function startRunB(seed: string): RunState {
  return { seed, phase: 'house', team: [], activeSynergies: [], stage: 0, relics: [],
    area: 0, teamMax: BALANCE.draft.teamSize, log: [], pendingLevelUps: [] }
}

/** Deterministic house pool the player picks 2 starters from. */
export function starterOffer(seed: string, house: House): DraftedWizard[] {
  const rng = createRng(seed).fork(draftChannelForStarters)
  const pool = createDraftPool().filter(w => w.house === house)
  return pool.map(w => draftWizard(rng, w, true))
}
const draftChannelForStarters = 11

function areaRng(seed: string, area: number): Rng {
  return createRng(seed).fork(mapRngChannel).fork(area)
}

export function chooseStarters(state: RunState, house: House, starterIds: string[], _rng: Rng): RunState {
  const offer = starterOffer(state.seed, house)
  const starters = starterIds
    .map(id => offer.find(d => d.wizard.id === id))
    .filter((d): d is DraftedWizard => !!d)
    .map(d => recruitVia(d, 'iniziale'))
  const map = generateArea(areaRng(state.seed, 0), 0, { teamSize: starters.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  return { ...state, house, area: 0, team: starters, activeSynergies: detectSynergies(starters),
    map, currentNodeId: entry.id, phase: 'map' }
}

export function reachable(state: RunState): RunNode[] {
  const cur = state.map?.find(n => n.id === state.currentNodeId)
  if (!cur) return []
  return cur.next.map(id => state.map!.find(n => n.id === id)).filter((n): n is RunNode => !!n)
}

const phaseForNode = (t: RunNode['type']): RunState['phase'] =>
  t === 'recruit' ? 'recruit-node' : t === 'relic' ? 'relic-node' : 'battle'

export function moveTo(state: RunState, nodeId: string): RunState {
  const cur = state.map?.find(n => n.id === state.currentNodeId)
  if (!cur || !cur.next.includes(nodeId)) throw new Error(`illegal move ${state.currentNodeId} -> ${nodeId}`)
  const target = state.map!.find(n => n.id === nodeId)!
  return { ...state, currentNodeId: nodeId, phase: phaseForNode(target.type) }
}

function markResolved(state: RunState, nodeId: string): RunNode[] {
  return state.map!.map(n => (n.id === nodeId ? { ...n, resolved: true } : n))
}

export function resolveCurrent(state: RunState, choice: ResolverChoice, rng: Rng): RunState {
  const node = state.map!.find(n => n.id === state.currentNodeId)!
  const resolver = resolverFor(node.type)
  const resolved = resolver.resolve(state, node, choice, rng)
  const map = markResolved(resolved, node.id)
  const wiped = resolved.team.length === 0
  let phase: RunState['phase']
  if (wiped) phase = 'defeat'
  else if (node.type === 'boss') phase = 'win' // single-area win; clearAreaAndAdvance handles multi-area below
  else if ((resolved.pendingLevelUps?.length ?? 0) > 0) phase = 'levelup'
  else phase = 'victory'
  return { ...resolved, map, phase }
}

export function applyLevelUp(state: RunState, wizardId: string, choice: GrowthChoice): RunState {
  const team = state.team.map(dw => (dw.wizard.id === wizardId ? applyGrowthChoice(dw, choice) : dw))
  const queue = (state.pendingLevelUps ?? []).slice(1)
  return { ...state, team, activeSynergies: detectSynergies(team),
    pendingLevelUps: queue, phase: queue.length > 0 ? 'levelup' : 'victory' }
}

/** Called after a non-boss victory acknowledged, or after a boss win to roll the next area. */
export function clearAreaAndAdvance(state: RunState, _rng: Rng): RunState {
  const lastArea = (BALANCE.map.areas - 1)
  const cur = state.area ?? 0
  if (cur >= lastArea) return { ...state, phase: 'win' }
  const nextArea = cur + 1
  const map = generateArea(areaRng(state.seed, nextArea), nextArea,
    { teamSize: state.team.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  return { ...state, area: nextArea, map, currentNodeId: entry.id, phase: 'map' }
}

