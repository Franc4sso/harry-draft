import type { DraftedWizard, House, RunNode, RunState } from '@/types'
import type { Rng } from './rng'
import { createRng } from './rng'
import { mapRngChannel } from './map'
import { generateArea, parseAreaNodeId } from './map'
import { createDraftPool } from './draft'
import { draftWizard } from './statRoll'
import { offerRecruits, recruitVia } from './recruit'
import { detectSynergies } from './synergy'
import { isDead, livingOf } from './roster'
import { combatResolver } from './resolvers/combat'
import { recruitResolver, relicResolver } from './resolvers/recruit'
import { infirmaryResolver } from './resolvers/infirmary'
import { eventResolver } from './resolvers/event'
import { spellForgeResolver } from './resolvers/spellForge'
import { spellSwapResolver } from './resolvers/spellSwap'
import { altareResolver } from './resolvers/altare'
import { registerResolver, resolverFor } from './resolvers'
import type { ResolverChoice } from './resolvers/types'
import { BALANCE } from '@/data/constants'

/** Pure decision of the phase a node leads to once its resolver has run.
 *  Order: wipeout > boss (area-cleared unless final area → win) > victory.
 *  Levels rise automatically from EXP — there is no level-up decision phase. */
export function phaseAfterNode(opts: {
  isBoss: boolean; area: number; areas: number; wiped: boolean
}): import('@/types').RunPhase {
  if (opts.wiped) return 'defeat'
  if (opts.isBoss) return opts.area >= opts.areas - 1 ? 'win' : 'area-cleared'
  return 'victory'
}

let registered = false
export function registerCoreResolvers(): void {
  if (registered) return
  registerResolver(combatResolver)                 // id 'battle'
  registerResolver({ ...combatResolver, id: 'elite' })
  registerResolver({ ...combatResolver, id: 'boss' })
  registerResolver(recruitResolver)                // id 'recruit'
  registerResolver(relicResolver)                  // id 'relic'
  registerResolver(infirmaryResolver)              // id 'infirmary'
  registerResolver(eventResolver)                  // id 'event'
  registerResolver(spellForgeResolver)             // id 'spellForge'
  registerResolver(spellSwapResolver)              // id 'spellSwap'
  registerResolver(altareResolver)                 // id 'altare'
  registered = true
}

/** Number of starters the player drafts before the run begins. */
export const STARTER_PICKS = 3

export function startRunB(seed: string): RunState {
  return { seed, phase: 'draft', team: [], activeSynergies: [], stage: 0, relics: [],
    area: 0, teamMax: BALANCE.draft.teamSize, log: [], pendingLevelUps: [] }
}

/** Seed the run from the player's drafted starters: build the team, roll area 0, enter the map. */
export function confirmDraftPicks(state: RunState, picked: DraftedWizard[], _rng: Rng): RunState {
  const starters = picked.slice(0, STARTER_PICKS).map(d => recruitVia(d, 'iniziale', 1))
  const map = generateArea(areaRng(state.seed, 0), state.seed, 0,
    { teamSize: starters.length, teamMax: state.teamMax ?? 5 }, state.endless ?? false)
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  return { ...state, area: 0, team: starters, activeSynergies: detectSynergies(starters),
    map, currentNodeId: entry.id, phase: 'map' }
}

/** Deterministic house pool the player picks 2 starters from. */
export function starterOffer(seed: string, house: House): DraftedWizard[] {
  const rng = createRng(seed).fork(draftChannelForStarters)
  const pool = createDraftPool().filter(w => w.house === house)
  return pool.map(w => draftWizard(rng, w, true))
}
const draftChannelForStarters = 11

export function areaRng(seed: string, area: number): Rng {
  return createRng(seed).fork(mapRngChannel).fork(area)
}

/** RNG channel dedicated to combat resolution (distinct from the map/draft channels). */
export const combatChannel = 2

/** Deterministic rng for a combat node: `fork(combatChannel).fork(area).fork(floor)`.
 *  Single source of truth for the fork chain live play uses to resolve a battle — shared by
 *  hooks/useRunB.combat.ts (snapshot + commit) and game/engine/endlessReplay.ts (replay), so
 *  a replayed combat draws from the EXACT same rng stream the original play did. Any other
 *  caller that needs "the rng live combat would use for this node" must go through this
 *  function rather than hand-rolling the fork chain. */
export function combatRngForNode(seed: string, nodeId: string): Rng {
  const { area, floor } = parseAreaNodeId(nodeId)
  return createRng(seed).fork(combatChannel).fork(area).fork(floor)
}

/** Used by BOTH campaign (useRunB) and endless (useEndless). `state.endless` is already
 *  `true` on the incoming state for the endless entry path (useEndless's initialRun sets
 *  it before mount, and endlessReplay.ts sets it on startRunB's result before calling this)
 *  — campaign's startRunB/confirmDraftPicks path never sets it, so it's undefined/false
 *  there. Threading it into generateArea excludes shop/spellForge from endless area 0 too
 *  (every other endless area already gets this via advanceEndlessArea) — without it, the
 *  endless controller's missing shop handler soft-locks on the ~45% of area-0 maps that
 *  roll a shop node. Campaign's call is unaffected: state.endless is always falsy there, so
 *  this preserves byte-identical campaign area-0 generation. */
export function chooseStarters(state: RunState, house: House, starterIds: string[], _rng: Rng): RunState {
  const offer = starterOffer(state.seed, house)
  const starters = starterIds
    .map(id => offer.find(d => d.wizard.id === id))
    .filter((d): d is DraftedWizard => !!d)
    .map(d => recruitVia(d, 'iniziale', 1))
  const map = generateArea(areaRng(state.seed, 0), state.seed, 0,
    { teamSize: starters.length, teamMax: state.teamMax ?? 5 }, state.endless ?? false)
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
  t === 'recruit' ? 'recruit-node' : t === 'relic' ? 'relic-node' : t === 'infirmary' ? 'infirmary-node' :
  t === 'event' ? 'event-node' : t === 'spellForge' ? 'spellForge-node' : t === 'spellSwap' ? 'spellSwap-node' :
  t === 'altare' ? 'altare-node' : 'battle'

export function moveTo(state: RunState, nodeId: string): RunState {
  const cur = state.map?.find(n => n.id === state.currentNodeId)
  if (!cur || !cur.next.includes(nodeId)) throw new Error(`illegal move ${state.currentNodeId} -> ${nodeId}`)
  const target = state.map!.find(n => n.id === nodeId)!
  return { ...state, currentNodeId: nodeId, phase: phaseForNode(target.type) }
}

function markResolved(state: RunState, nodeId: string): RunNode[] {
  return state.map!.map(n => (n.id === nodeId ? { ...n, resolved: true } : n))
}

/** Shared implementation: resolves the current node's choice exactly once
 *  (single RNG draw) and reports whether the resolver treated the choice as
 *  a no-op (raw resolver result reference-equal to the input state — the
 *  resolvers' convention for "illegal/no-op choice", see e.g.
 *  useConsumableRelic above and each resolver's `resolve`). */
function resolveCurrentImpl(state: RunState, choice: ResolverChoice, rng: Rng): { state: RunState; wasNoOp: boolean } {
  const node = state.map!.find(n => n.id === state.currentNodeId)!
  const resolver = resolverFor(node.type)
  const resolved = resolver.resolve(state, node, choice, rng)
  const wasNoOp = resolved === state
  const map = markResolved(resolved, node.id)
  const wiped = resolved.team.length > 0 && resolved.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)
  const phase = phaseAfterNode({
    isBoss: node.type === 'boss',
    area: resolved.area ?? 0,
    areas: BALANCE.map.areas,
    wiped,
  })
  return { state: { ...resolved, map, phase }, wasNoOp }
}

export function resolveCurrent(state: RunState, choice: ResolverChoice, rng: Rng): RunState {
  return resolveCurrentImpl(state, choice, rng).state
}

/** Same work as resolveCurrent, but also reports whether the inner resolver
 *  no-op'd on an illegal/invalid choice (raw result === input state). Used by
 *  replayRun's anti-cheat legality check: resolveCurrent always returns a
 *  FRESH wrapper object (`{ ...resolved, map, phase }`) even on a no-op, so
 *  `newState === oldState` can never catch an illegal resolve — this checked
 *  variant inspects the resolver's raw return before that wrapping happens. */
export function resolveCurrentChecked(state: RunState, choice: ResolverChoice, rng: Rng): { state: RunState; wasNoOp: boolean } {
  return resolveCurrentImpl(state, choice, rng)
}

/** Use a consumable relic identified by `relicId`.
 *  Pure; no RNG. Returns the same state object on any no-op:
 *   - relicId not owned
 *   - the relic is not active:'revive'
 *   - no dead wizard on the team
 *  On success: revives every dead wizard to full HP (wounded-but-alive untouched),
 *  removes the relic from state.relics, and recomputes activeSynergies. */
export function useConsumableRelic(state: RunState, relicId: string): RunState {
  const activeRelic = state.relics.find(a => a.relic.id === relicId)
  if (!activeRelic) return state
  if (activeRelic.relic.active !== 'revive') return state
  const hasDead = state.team.some(dw => isDead(dw))
  if (!hasDead) return state
  const team = state.team.map(dw => isDead(dw) ? { ...dw, currentHp: dw.maxHp } : dw)
  const relics = state.relics.filter(a => a.relic.id !== relicId)
  const activeSynergies = detectSynergies(livingOf(team))
  return { ...state, team, relics, activeSynergies }
}

/** Called after a non-boss victory acknowledged, or after a boss win to roll the next area. */
export function clearAreaAndAdvance(state: RunState, _rng: Rng): RunState {
  const lastArea = (BALANCE.map.areas - 1)
  const cur = state.area ?? 0
  if (cur >= lastArea) return { ...state, phase: 'win' }
  const nextArea = cur + 1
  const map = generateArea(areaRng(state.seed, nextArea), state.seed, nextArea,
    { teamSize: state.team.length, teamMax: state.teamMax ?? 5 })
  const entry = map.find(n => parseAreaNodeId(n.id).floor === 0)!
  // Guaranteed end-of-area recovery: clearing an area's boss fully restores the roster
  // (heals wounded AND revives dead) before the next area begins, matching the Infermeria's
  // full-recovery semantics. This caps HP-persistence bleed at a single area so accumulated
  // wounds never compound across the whole run.
  const team = state.team.map(dw => ({ ...dw, currentHp: dw.maxHp }))
  return { ...state, team, area: nextArea, map, currentNodeId: entry.id, phase: 'map' }
}

