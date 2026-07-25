'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { DraftedWizard, RunNode, RunState } from '@/types'
import {
  moveTo, resolveCurrent, reachable as engineReachable, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { saveRun, RUN_KEY } from '@/lib/runStore'
import { prepareCombat, combatRng, type ActiveBattleB } from './useRunB.combat'
import { markSeen, saveProfile, grantCioccorane, spendCioccorane } from '@/lib/metaStore'
import type { MetaProfile } from '@/lib/metaStore'
import { detectDuos } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { eventResolver, resolveEventChoice } from '@/game/engine/resolvers/event'
import { EVENT_BY_ID, type EventRequirement } from '@/data/events'

registerCoreResolvers()

export type RunSharedView =
  | 'draft' | 'map' | 'battle' | 'victory'
  | 'recruit' | 'relic' | 'infirmary' | 'event' | 'spellForge' | 'altare' | 'area-cleared' | 'win' | 'defeat'

export interface EventChoiceView { id: string; label: string; enabled: boolean; reason?: string }
export interface CurrentEventView { id: string; title: string; text: string; choices: EventChoiceView[] }

export const viewForPhase = (p: RunState['phase']): RunSharedView => {
  switch (p) {
    case 'draft': return 'draft'
    case 'map': return 'map'
    case 'battle': return 'battle'
    case 'victory': return 'victory'
    case 'recruit-node': return 'recruit'
    case 'relic-node': return 'relic'
    case 'infirmary-node': return 'infirmary'
    case 'event-node': return 'event'
    case 'spellForge-node': return 'spellForge'
    case 'altare-node': return 'altare'
    case 'area-cleared': return 'area-cleared'
    case 'win': return 'win'
    case 'defeat': return 'defeat'
    default: return 'map'
  }
}

/** Evaluate a single event choice's `requires` against the LIVE run team + profile
 *  Cioccorane balance. Undefined `requires` is always enabled. */
function evalEventRequirement(
  req: EventRequirement | undefined, team: DraftedWizard[], cioccorane: number,
): { enabled: boolean; reason?: string } {
  if (!req) return { enabled: true }
  if ('minCioccorane' in req) {
    return cioccorane >= req.minCioccorane
      ? { enabled: true }
      : { enabled: false, reason: `Richiede ${req.minCioccorane} 🍫 (hai ${cioccorane})` }
  }
  if ('minTeam' in req) {
    return team.length >= req.minTeam
      ? { enabled: true }
      : { enabled: false, reason: `Richiede almeno ${req.minTeam} maghi in squadra` }
  }
  const count = team.filter(d => d.wizard.role === req.role).length
  return count >= req.count
    ? { enabled: true }
    : { enabled: false, reason: `Richiede ${req.count}× ${req.role} in squadra` }
}

export interface UseRunSharedOpts {
  /** Initial RunState (mode-specific: loaded save vs fresh start). */
  initialRun: RunState
  /** Initial view; defaults to viewForPhase(initialRun.phase). */
  initialView?: RunSharedView
  /** Mutable profile ref, owned by the caller (campaign restricts draft/relic pools
   *  before mount; endless may not). Shared logic reads/writes it for codex tracking
   *  (markSeen) but does not own its lifecycle. */
  profileRef: React.MutableRefObject<MetaProfile>
  /** Invoked after every commit with the just-committed RunState + resolved view, BEFORE
   *  this hook's own state updates are read back by the caller. Used by the campaign
   *  hook to fire the once-only reward ceremony on 'win'/'defeat'; endless mode may pass
   *  a no-op or a different terminal handler. */
  onCommit?: (next: RunState, view: RunSharedView) => void
  /** localStorage key `commit` persists under (via lib/runStore's saveRun). Defaults to
   *  the campaign RUN_KEY. Endless passes RUN_KEY_ENDLESS so an in-progress endless run
   *  and an in-progress campaign run never clobber each other's save. */
  runKey?: string
}

export interface RunSharedController {
  run: RunState; view: RunSharedView
  battle: ActiveBattleB | null
  lastFallen: string[]
  runRef: React.MutableRefObject<RunState>
  /** Low-level state setter used by mode-specific code (e.g. campaign's advanceArea,
   *  restart) to commit a RunState transition through the same single pipeline
   *  (ref sync + persistence + view resolution + onCommit) as every shared callback. */
  commit: (next: RunState, v?: RunSharedView) => void
  setBattle: (b: ActiveBattleB | null) => void
  setLastFallen: (names: string[]) => void
  reachable: RunNode[]
  currentNode: RunNode | undefined
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  skipRecruit: () => void
  chooseRelic: (relicId: string, assignedTo?: string, replaceRelicId?: string) => void
  buyAltare: (relicId: string, costWizardId?: string, costRelicId?: string, carrierId?: string, replaceRelicId?: string) => void
  skipAltare: () => void
  ackInfirmary: () => void
  currentEvent: CurrentEventView | null
  chooseEventOption: (optionId: string) => void
  chooseSpellUpgrade: (wizardId: string) => void
  /** Duo ids newly added to `profile.codex.duosSeen` by the LAST `chooseNode` call (empty
   *  the rest of the time). Set only when that call entered battle. The battle intro reads
   *  this to render `DuoToast` — see `components/screens/RunBRunner.tsx`'s 'battle' case. */
  newlyDiscoveredDuoIds: string[]
}

/** Mode-agnostic run-driving primitives shared by useRunB (campaign) and the future
 *  endless-mode hook. Owns the run/view/battle/lastFallen state and the node-resolution
 *  callbacks that behave identically regardless of mode. Mode-specific behavior (reward
 *  ceremony, draft/relic pool restriction, area-advance semantics) stays in the caller
 *  and is threaded in via `opts` or layered on top of `commit`/`runRef`. */
export function useRunShared(opts: UseRunSharedOpts): RunSharedController {
  const { initialRun, profileRef, onCommit, runKey = RUN_KEY } = opts
  const [run, setRunState] = useState<RunState>(initialRun)
  const [view, setView] = useState<RunSharedView>(() => opts.initialView ?? viewForPhase(initialRun.phase))
  const [battle, setBattle] = useState<ActiveBattleB | null>(() =>
    initialRun.phase === 'battle' || initialRun.phase === 'victory' ? prepareCombat(initialRun) : null,
  )
  const [lastFallen, setLastFallen] = useState<string[]>([])
  const [newlyDiscoveredDuoIds, setNewlyDiscoveredDuoIds] = useState<string[]>([])
  const runRef = useRef(run); runRef.current = run

  const commit = useCallback((next: RunState, v?: RunSharedView) => {
    runRef.current = next; setRunState(next); saveRun(next, runKey)
    const resolvedView = v ?? viewForPhase(next.phase)
    setView(resolvedView)
    onCommit?.(next, resolvedView)
  }, [onCommit, runKey])

  const chooseNode = useCallback((nodeId: string) => {
    const moved = moveTo(runRef.current, nodeId)
    if (moved.phase === 'battle') {
      runRef.current = moved
      const preparedBattle = prepareCombat(moved)
      setBattle(preparedBattle)
      let p = profileRef.current
      for (const d of preparedBattle.enemy) p = markSeen(p, 'wizard', d.wizard.id)
      for (const a of moved.activeSynergies ?? []) p = markSeen(p, 'synergy', a.synergy.id)
      const node = moved.map!.find(n => n.id === nodeId)
      if (node?.type === 'boss' && node.preview?.bossName) p = markSeen(p, 'boss', node.preview.bossName)
      // Duo discovery: same team/relics source detectDuos uses at battle-resolve time
      // (game/engine/resolvers/combat.ts computes leftDuos from livingOf(team)) — the
      // LIVING team + owned relics going into THIS battle, so a fallen wizard whose
      // role/tag was a signal's second contributor never falsely marks a Duo seen. New
      // (not-yet-seen) active Duos are marked in the SAME profile update as the rest of
      // this node's codex writes, and surfaced for the battle intro's DuoToast.
      const activeDuoIds = detectDuos(livingOf(moved.team), moved.relics).map(a => a.duo.id)
      const newDuoIds = activeDuoIds.filter(id => !p.codex.duosSeen.includes(id))
      for (const id of newDuoIds) p = markSeen(p, 'duo', id)
      profileRef.current = p; saveProfile(p)
      setNewlyDiscoveredDuoIds(newDuoIds)
      commit(moved, 'battle')
    } else {
      setNewlyDiscoveredDuoIds([])
      if (moved.phase === 'relic-node') {
        const node = moved.map!.find(n => n.id === nodeId)!
        const offer = relicOffer(moved, node, createRng(moved.seed))
        let p = profileRef.current
        for (const r of offer) p = markSeen(p, 'relic', r.id)
        profileRef.current = p; saveProfile(p)
      }
      commit(moved) // recruit-node | relic-node
    }
  }, [commit, profileRef])

  const commitBattle = useCallback(() => {
    const before = runRef.current.team
    const next = resolveCurrent(runRef.current, { kind: 'combat-ack' }, combatRng(runRef.current))
    const surviving = new Set(next.team.map(d => d.wizard.id))
    setLastFallen(before.filter(d => !surviving.has(d.wizard.id)).map(d => d.wizard.name))
    commit(next)
  }, [commit])

  const chooseRecruit = useCallback((wizardId: string, replaceId?: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'recruit-pick', wizardId, replaceId }, createRng(runRef.current.seed))
    let p = profileRef.current
    for (const d of next.team) p = markSeen(p, 'wizard', d.wizard.id)
    profileRef.current = p; saveProfile(p)
    commit({ ...next, phase: 'map' }, 'map') // non-combat node: straight back to map
  }, [commit, profileRef])

  // Decline the offer: the resolver leaves the team untouched but the node is still
  // marked resolved, so we simply return to the map.
  const skipRecruit = useCallback(() => {
    const next = resolveCurrent(runRef.current, { kind: 'skip' }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  const chooseRelic = useCallback((relicId: string, assignedTo?: string, replaceRelicId?: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'relic-pick', relicId, assignedTo, replaceRelicId }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  // Altare Oscuro (P5 — Economia del Sacrificio): buy pays its (concretized) sacrificeCost
  // in the SAME resolve call (see altareResolver.resolve) — the cost IS the price, no
  // separate wallet step. 'skip' walks away with the node still marked resolved
  // (see markResolved in resolveCurrentImpl), mirroring skipRecruit.
  const buyAltare = useCallback((relicId: string, costWizardId?: string, costRelicId?: string, carrierId?: string, replaceRelicId?: string) => {
    const next = resolveCurrent(
      runRef.current, { kind: 'altare-buy', relicId, costWizardId, costRelicId, carrierId, replaceRelicId }, createRng(runRef.current.seed),
    )
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  const skipAltare = useCallback(() => {
    const next = resolveCurrent(runRef.current, { kind: 'skip' }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  const ackInfirmary = useCallback(() => {
    const next = resolveCurrent(runRef.current, { kind: 'combat-ack' }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  // Computed from the resolver's `enter` (same eventForNode pick used by resolve/commit),
  // with each choice's `enabled` evaluated against the LIVE team + profile Cioccorane.
  const currentEvent = useMemo<CurrentEventView | null>(() => {
    if (run.phase !== 'event-node') return null
    const node = run.map?.find(n => n.id === run.currentNodeId)
    if (!node) return null
    const entry = eventResolver.enter(run, node, createRng(run.seed))
    const full = entry.event ? EVENT_BY_ID[entry.event.id] : undefined
    if (!entry.event || !full) return null
    const cioccorane = profileRef.current.cioccorane
    const choices = full.choices.map(c => {
      const { enabled, reason } = evalEventRequirement(c.requires, run.team, cioccorane)
      return { id: c.id, label: c.label, enabled, ...(reason ? { reason } : {}) }
    })
    return { id: full.id, title: full.title, text: full.text, choices }
  }, [run, profileRef])

  // Mirrors chooseRecruit/chooseRelic: resolve via the SAME node the offer came from, then
  // apply the run-resource effects to RunState AND the Cioccorane delta to the profile from
  // the SAME (single) applyEventEffects call, so state and currency can never disagree —
  // see resolveEventChoice's doc comment for why the salt/pick logic isn't duplicated here.
  const chooseEventOption = useCallback((optionId: string) => {
    const node = runRef.current.map!.find(n => n.id === runRef.current.currentNodeId)!
    const { state: nextState, cioccoraneDelta } =
      resolveEventChoice(runRef.current, node, optionId, createRng(runRef.current.seed))
    let p = profileRef.current
    if (cioccoraneDelta > 0) p = grantCioccorane(p, cioccoraneDelta)
    else if (cioccoraneDelta < 0) p = spendCioccorane(p, -cioccoraneDelta) ?? p // can't happen: the choice was disabled if unaffordable
    profileRef.current = p; saveProfile(p)
    const map = runRef.current.map!.map(n => (n.id === node.id ? { ...n, resolved: true } : n))
    commit({ ...nextState, map, phase: 'map' }, 'map')
  }, [commit, profileRef])

  const chooseSpellUpgrade = useCallback((wizardId: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'spell-upgrade', wizardId }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map') // non-combat node: straight back to map
  }, [commit])

  const reachable = useMemo(() => engineReachable(run), [run])
  const currentNode = run.map?.find(n => n.id === run.currentNodeId)

  return {
    run, view, battle, lastFallen, runRef, commit, setBattle, setLastFallen,
    reachable, currentNode,
    chooseNode, commitBattle, chooseRecruit, skipRecruit, chooseRelic, buyAltare, skipAltare, ackInfirmary,
    currentEvent, chooseEventOption, chooseSpellUpgrade,
    newlyDiscoveredDuoIds,
  }
}
