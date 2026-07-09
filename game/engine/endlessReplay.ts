import type { House, RunState } from '@/types'
import type { ResolverChoice } from './resolvers/types'
import {
  startRunB, chooseStarters, starterOffer, moveTo, resolveCurrent,
  setWizardSpell, useConsumableRelic, reachable, registerCoreResolvers,
} from './runEngine'
import { advanceEndlessArea } from './endless'
import { setDraftPoolRestriction } from './draft'
import { createRng } from './rng'

// Bump when any change to the engine could alter a replay's outcome (Decision 3).
export const ENGINE_VERSION = 'endless-1'

export type PlayerAction =
  | { t: 'move'; nodeId: string }
  | { t: 'resolve'; choice: ResolverChoice }
  | { t: 'set-spell'; wizardId: string; spellId: string }
  | { t: 'use-consumable'; relicId: string }

export interface RunLog {
  v: 1
  engine: string
  seed: string
  house: House
  starterIds: string[]
  actions: PlayerAction[]
}

const VALID_HOUSES = new Set<House>(['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'])
const VALID_ACTION_TAGS = new Set(['move', 'resolve', 'set-spell', 'use-consumable'])

/** Structural integrity check for a decoded log, run BEFORE any simulation.
 *  `decodeChallenge` (lib/challengeCode.ts) validates only v/seed/actions — a
 *  hand-crafted or tampered challenge code can still carry a bogus `house`,
 *  non-array `starterIds`, or an action with an unrecognized `t` tag. Reject
 *  those here rather than let them throw or silently no-op mid-simulation. */
function structurallyValid(log: RunLog): boolean {
  if (!log.house || !VALID_HOUSES.has(log.house)) return false
  if (!Array.isArray(log.starterIds) || !log.starterIds.every(id => typeof id === 'string')) return false
  if (!Array.isArray(log.actions)) return false
  for (const a of log.actions) {
    if (!a || typeof a !== 'object' || !VALID_ACTION_TAGS.has((a as { t?: unknown }).t as string)) return false
  }
  return true
}

export function replayRun(log: RunLog): { state: RunState; valid: boolean; reason?: string } {
  if (log.engine !== ENGINE_VERSION) return { state: null as unknown as RunState, valid: false, reason: 'engine version mismatch' }
  if (!structurallyValid(log)) return { state: null as unknown as RunState, valid: false, reason: 'malformed log' }
  registerCoreResolvers()
  setDraftPoolRestriction(null) // Decision 4: full roster, profile-independent

  const rng = createRng(log.seed)
  // Validate starters are in the deterministic offer for this seed+house.
  const offer = starterOffer(log.seed, log.house)
  const offeredIds = new Set(offer.map(d => d.wizard.id))
  if (!log.starterIds.length || !log.starterIds.every(id => offeredIds.has(id))) {
    return { state: null as unknown as RunState, valid: false, reason: 'illegal starters' }
  }
  let s = chooseStarters(startRunB(log.seed), log.house, log.starterIds, rng)
  s = { ...s, endless: true }

  for (const a of log.actions) {
    const before = s
    if (a.t === 'move') {
      if (!reachable(s).some(n => n.id === a.nodeId)) return { state: s, valid: false, reason: 'unreachable node' }
      s = moveTo(s, a.nodeId)
    } else if (a.t === 'resolve') {
      s = resolveCurrent(s, a.choice, createRng(log.seed))
    } else if (a.t === 'set-spell') {
      s = setWizardSpell(s, a.wizardId, a.spellId)
    } else if (a.t === 'use-consumable') {
      s = useConsumableRelic(s, a.relicId)
    }
    // Strict legality: a resolver/action that returned the SAME state object is a no-op
    // (illegal choice) — invalidate rather than accept a divergent run. (move already
    // validated above; combat-ack legitimately transitions, so exempt ack from this.)
    if (s === before && !(a.t === 'resolve' && a.choice.kind === 'combat-ack')) {
      return { state: s, valid: false, reason: `no-op action: ${JSON.stringify(a)}` }
    }
    // Advance area at boundary (endless never wins).
    if (s.phase === 'area-cleared' || s.phase === 'win') s = advanceEndlessArea(s, createRng(log.seed))
    if (s.team.length > 0 && s.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)) break // wiped
  }
  return { state: s, valid: true }
}
