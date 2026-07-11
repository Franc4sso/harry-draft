import type { RunState } from '@/types'
import type { ResolverChoice } from './resolvers/types'
import {
  startRunB, confirmDraftPicks, moveTo, resolveCurrentChecked,
  useConsumableRelic, reachable, registerCoreResolvers, combatRngForNode, STARTER_PICKS,
} from './runEngine'
import { startDraft, pickFrom } from './draftSession'
import { advanceEndlessArea } from './endless'
import { setDraftPoolRestriction } from './draft'
import { createRng } from './rng'

// Bump when any change to the engine could alter a replay's outcome (Decision 3).
export const ENGINE_VERSION = 'endless-2'

export type PlayerAction =
  | { t: 'move'; nodeId: string }
  | { t: 'resolve'; choice: ResolverChoice }
  | { t: 'use-consumable'; relicId: string }

export interface RunLog {
  v: 1
  engine: string
  seed: string
  draftPicks: string[]
  actions: PlayerAction[]
}

const VALID_ACTION_TAGS = new Set(['move', 'resolve', 'use-consumable'])

/** Structural integrity check for a decoded log, run BEFORE any simulation.
 *  `decodeChallenge` (lib/challengeCode.ts) validates only v/seed/actions — a
 *  hand-crafted or tampered challenge code can still carry non-array
 *  `draftPicks`, or an action with an unrecognized `t` tag. Reject those here
 *  rather than let them throw or silently no-op mid-simulation. */
function structurallyValid(log: RunLog): boolean {
  if (!Array.isArray(log.draftPicks) || !log.draftPicks.every(id => typeof id === 'string')) return false
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

  const rng = createRng(log.seed)
  // Reconstruct the starting team by driving the SAME seeded DraftSession the live draft used,
  // validating each recorded pick was legally on its screen (anti-cheat). Full roster (null) —
  // Decision 4: profile-independent, same as live endless play.
  setDraftPoolRestriction(null)
  let session = startDraft(log.seed, STARTER_PICKS)
  for (const id of log.draftPicks) {
    const idx = session.current.findIndex(c => c.wizard.id === id)
    if (idx < 0) return { state: null as unknown as RunState, valid: false, reason: 'illegal draft pick' }
    session = pickFrom(session, idx)
  }
  if (session.picks.length !== STARTER_PICKS) {
    return { state: null as unknown as RunState, valid: false, reason: 'incomplete draft' }
  }
  // endless:true must be set BEFORE confirmDraftPicks so area-0 excludes shop/spellForge (Task 1).
  let s = confirmDraftPicks({ ...startRunB(log.seed), endless: true }, session.picks, rng)

  for (const a of log.actions) {
    const before = s
    if (a.t === 'move') {
      if (!reachable(s).some(n => n.id === a.nodeId)) return { state: s, valid: false, reason: 'unreachable node' }
      s = moveTo(s, a.nodeId)
    } else if (a.t === 'resolve') {
      // Use the CHECKED variant: resolveCurrent always rewraps the resolver's raw
      // result (`{ ...resolved, map, phase }`), so its output is a fresh object even
      // when the inner resolver no-op'd on an illegal choice (e.g. a relic-pick /
      // recruit-pick id never offered) — `s === before` below can therefore never
      // observe an illegal resolve. resolveCurrentChecked reports the resolver's raw
      // no-op signal (raw result reference-equal to the input state) directly, before
      // that rewrapping happens. Calls the resolver exactly once — same single RNG
      // draw as resolveCurrent, so no double-draw / determinism hazard.
      //
      // RNG stream must match what LIVE play actually used, or a replayed combat draws
      // different crits/dodges than the original fight (score divergence — the bug the
      // final whole-branch review flagged as CRITICAL). Live combat resolves via
      // hooks/useRunShared.ts's commitBattle, which uses combatRng(run) (now
      // combatRngForNode, hoisted into runEngine.ts as the single source of truth) — a
      // FORKED stream (`fork(combatChannel).fork(area).fork(floor)`), NOT the raw seed
      // rng every non-combat resolver uses (see chooseRecruit/chooseRelic/ackInfirmary/
      // chooseEventOption/chooseSpellUpgrade in useRunShared.ts — all `createRng(seed)`
      // with no fork). Mirror that split here exactly.
      const currentNode = s.map!.find(n => n.id === s.currentNodeId)
      const isCombatNode = currentNode?.type === 'battle' || currentNode?.type === 'elite' || currentNode?.type === 'boss'
      const resolveRng = isCombatNode ? combatRngForNode(log.seed, s.currentNodeId!) : createRng(log.seed)
      const checked = resolveCurrentChecked(s, a.choice, resolveRng)
      // Exemption reasoning (must be exhaustive — every resolver no-op that's NOT
      // cheating has to be listed here, or a legitimate player action gets rejected):
      //  - 'combat-ack': combatResolver ignores the choice and always returns a new
      //    object, so this never actually no-ops today — exempted defensively in case
      //    that ever changes, since ack is always a legitimate combat-resolution step.
      //  - 'skip': the recruit/relic/event resolvers have no dedicated 'skip' branch —
      //    "decline the offer" is implemented by falling through their own
      //    `choice.kind !== expected -> return state` guard (see hooks/useRunShared.ts
      //    skipRecruit, which sends exactly {kind:'skip'}). A real player's skip is
      //    therefore indistinguishable from a no-op by state-equality alone, so it must
      //    be trusted by choice kind, not inferred.
      //  - Everything else that no-ops (wrong choice kind for the node, or a
      //    'relic-pick'/'recruit-pick'/'event-choice'/'spell-upgrade'/'shop-buy' whose
      //    id/target isn't in that node's actual offer) is illegal and must be rejected.
      //    'shop-buy' and 'spell-upgrade' additionally never legitimately appear in an
      //    endless log at all (no shop/spellForge nodes in endless — Decision 2), so a
      //    no-op from either here is illegal by construction too.
      if (checked.wasNoOp && a.choice.kind !== 'combat-ack' && a.choice.kind !== 'skip') {
        return { state: s, valid: false, reason: `illegal resolve choice: ${JSON.stringify(a)}` }
      }
      s = checked.state
    } else if (a.t === 'use-consumable') {
      s = useConsumableRelic(s, a.relicId)
    }
    // Strict legality for move/use-consumable: a no-op here means an illegal
    // action (move already validated via `reachable` above and throws rather than
    // no-op'ing; use-consumable no-ops on invalid ids — see useConsumableRelic
    // doc comment). resolve is handled above via resolveCurrentChecked instead, since
    // resolveCurrent's wrapping defeats reference-equality against `before`.
    if (a.t !== 'resolve' && s === before) {
      return { state: s, valid: false, reason: `no-op action: ${JSON.stringify(a)}` }
    }
    // Advance area at boundary (endless never wins).
    if (s.phase === 'area-cleared' || s.phase === 'win') s = advanceEndlessArea(s, createRng(log.seed))
    if (s.team.length > 0 && s.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)) break // wiped
  }
  return { state: s, valid: true }
}
