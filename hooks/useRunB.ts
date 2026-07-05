'use client'
import { useState, useRef, useCallback, useMemo } from 'react'
import type { DraftedWizard, RunNode, RunState } from '@/types'
import {
  startRunB, confirmDraftPicks, reachable as engineReachable,
  moveTo, resolveCurrent, clearAreaAndAdvance, registerCoreResolvers,
  setWizardSpell,
  useConsumableRelic as useConsumableRelicEngine,
} from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { randomSeed } from '@/lib/seed'
import { saveRun, loadRun, clearRun } from '@/lib/runStore'
import { BALANCE } from '@/data/constants'
import { prepareCombat, combatRng, type ActiveBattleB } from './useRunB.combat'
import { loadProfile, saveProfile, markSeen, grantCioccorane, spendCioccorane } from '@/lib/metaStore'
import type { MetaProfile } from '@/lib/metaStore'
import { buildRunEndSummary, recordRunEnd } from '@/lib/metaProgress'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { shopOffer, shopResolver } from '@/game/engine/resolvers/shop'
import { leaveShop as leaveShopEngine, rerollShop as rerollShopEngine } from '@/game/engine/runEngine'
import { eventResolver, resolveEventChoice } from '@/game/engine/resolvers/event'
import { EVENT_BY_ID, type EventRequirement } from '@/data/events'
import { STARTER_WIZARDS, STARTER_RELICS, type UnlockTarget } from '@/data/unlocks'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { setRelicPoolRestriction } from '@/game/engine/relics'

registerCoreResolvers()

export type RunBView =
  | 'draft' | 'map' | 'battle' | 'victory'
  | 'recruit' | 'relic' | 'infirmary' | 'event' | 'spellForge' | 'shop' | 'area-cleared' | 'win' | 'defeat'

export interface RunReward { earned: number; unlocked: UnlockTarget[]; profile: MetaProfile }

export interface EventChoiceView { id: string; label: string; enabled: boolean; reason?: string }
export interface CurrentEventView { id: string; title: string; text: string; choices: EventChoiceView[] }

export interface RunBController {
  run: RunState; view: RunBView
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  area: number; areasTotal: number; lastFallen: string[]
  runReward: RunReward | null
  completeDraft: (picked: DraftedWizard[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  acknowledgeVictory: () => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  skipRecruit: () => void
  chooseRelic: (relicId: string, assignedTo?: string) => void
  ackInfirmary: () => void
  currentEvent: CurrentEventView | null
  chooseEventOption: (optionId: string) => void
  chooseSpellUpgrade: (wizardId: string) => void
  setWizardSpell: (wizardId: string, spellId: string) => void
  useConsumableRelic: (relicId: string) => void
  cioccorane: number
  buyShopItem: (slotId: string, opts?: { carrierId?: string; targetWizardId?: string }) => void
  rerollShop: () => void
  leaveShop: () => void
  advanceArea: () => void
  restart: () => void
}

const viewForPhase = (p: RunState['phase']): RunBView => {
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
    case 'shop-node': return 'shop'
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

export function useRunB(seed: string): RunBController {
  const [run, setRunState] = useState<RunState>(() => loadRun() ?? startRunB(seed))
  const [view, setView] = useState<RunBView>(() => viewForPhase((loadRun() ?? startRunB(seed)).phase))
  // The battle snapshot is ephemeral (never persisted). On a fresh page load / HMR
  // remount mid-fight, the run is restored in the 'battle' or 'victory' phase, so the
  // snapshot must be rebuilt from the current node — otherwise the battle/victory view
  // dereferences a null `battle`. prepareCombat is deterministic per (seed, node).
  const [battle, setBattle] = useState<ActiveBattleB | null>(() =>
    run.phase === 'battle' || run.phase === 'victory' ? prepareCombat(run) : null,
  )
  const [lastFallen, setLastFallen] = useState<string[]>([])
  const [runReward, setRunReward] = useState<RunReward | null>(null)
  const rewardFiredRef = useRef(false)
  const runRef = useRef(run); runRef.current = run
  const profileRef = useRef(loadProfile())
  // Restrict the player-facing pools to the starter set + whatever the profile has
  // unlocked so far. Runs synchronously during render, before any offer (draft/
  // recruit/relic) is computed downstream — mirrors the loadRun() client-read pattern.
  // Also re-applied on restart() so unlocks earned at the just-finished run's reward
  // ceremony are usable immediately in the next same-session run (no remount needed).
  const applyPoolRestrictions = useCallback(() => {
    const p = profileRef.current
    setDraftPoolRestriction([...STARTER_WIZARDS, ...p.unlockedWizards])
    setRelicPoolRestriction([...STARTER_RELICS, ...p.unlockedRelics])
  }, [])
  useMemo(() => { applyPoolRestrictions() }, [applyPoolRestrictions])

  const commit = useCallback((next: RunState, v?: RunBView) => {
    runRef.current = next; setRunState(next); saveRun(next)
    const view = v ?? viewForPhase(next.phase)
    setView(view)
    if ((view === 'win' || view === 'defeat') && !rewardFiredRef.current) {
      rewardFiredRef.current = true
      const summary = buildRunEndSummary(next)
      const res = recordRunEnd(profileRef.current, summary)
      profileRef.current = res.profile; saveProfile(res.profile)
      setRunReward({ earned: res.earned, unlocked: res.unlocked, profile: res.profile })
    }
  }, [])

  const completeDraft = useCallback((picked: DraftedWizard[]) => {
    const next = confirmDraftPicks(runRef.current, picked, createRng(runRef.current.seed))
    let p = profileRef.current
    for (const d of next.team) p = markSeen(p, 'wizard', d.wizard.id)
    profileRef.current = p; saveProfile(p)
    commit(next, 'map')
  }, [commit])

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
      profileRef.current = p; saveProfile(p)
      commit(moved, 'battle')
    } else {
      if (moved.phase === 'relic-node') {
        const node = moved.map!.find(n => n.id === nodeId)!
        const offer = relicOffer(moved, node, createRng(moved.seed))
        let p = profileRef.current
        for (const r of offer) p = markSeen(p, 'relic', r.id)
        profileRef.current = p; saveProfile(p)
      }
      commit(moved) // recruit-node | relic-node
    }
  }, [commit])

  const commitBattle = useCallback(() => {
    const before = runRef.current.team
    const next = resolveCurrent(runRef.current, { kind: 'combat-ack' }, combatRng(runRef.current))
    const surviving = new Set(next.team.map(d => d.wizard.id))
    setLastFallen(before.filter(d => !surviving.has(d.wizard.id)).map(d => d.wizard.name))
    commit(next)
  }, [commit])

  const acknowledgeVictory = useCallback(() => { commit({ ...runRef.current, phase: 'map' }, 'map') }, [commit])

  const chooseRecruit = useCallback((wizardId: string, replaceId?: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'recruit-pick', wizardId, replaceId }, createRng(runRef.current.seed))
    let p = profileRef.current
    for (const d of next.team) p = markSeen(p, 'wizard', d.wizard.id)
    profileRef.current = p; saveProfile(p)
    commit({ ...next, phase: 'map' }, 'map') // non-combat node: straight back to map
  }, [commit])

  // Decline the offer: the resolver leaves the team untouched but the node is still
  // marked resolved, so we simply return to the map.
  const skipRecruit = useCallback(() => {
    const next = resolveCurrent(runRef.current, { kind: 'skip' }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  const chooseRelic = useCallback((relicId: string, assignedTo?: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'relic-pick', relicId, assignedTo }, createRng(runRef.current.seed))
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
  }, [run])

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
  }, [commit])

  const chooseSpellUpgrade = useCallback((wizardId: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'spell-upgrade', wizardId }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map') // non-combat node: straight back to map
  }, [commit])

  const buyShopItem = useCallback((slotId: string, opts?: { carrierId?: string; targetWizardId?: string }) => {
    const node = runRef.current.map!.find(n => n.id === runRef.current.currentNodeId)!
    const slot = shopOffer(runRef.current, node, createRng(runRef.current.seed)).slots.find(s => s.id === slotId)
    if (!slot) return
    // Apply the purchase FIRST (pure); a no-op (already bought / remove-guard) must not charge.
    const next = shopResolver.resolve(runRef.current, node,
      { kind: 'shop-buy', slotId, carrierId: opts?.carrierId, targetWizardId: opts?.targetWizardId }, createRng(runRef.current.seed))
    if (next === runRef.current) return
    // Deduct the wallet; if unaffordable, abort with NO state change (discard `next`).
    const spent = spendCioccorane(profileRef.current, slot.price)
    if (!spent) return
    profileRef.current = spent; saveProfile(spent)
    commit({ ...next, phase: 'shop-node' }, 'shop')
  }, [commit])

  const rerollShop = useCallback(() => {
    const spent = spendCioccorane(profileRef.current, BALANCE.shop.reroll)
    if (!spent) return
    profileRef.current = spent; saveProfile(spent)
    commit({ ...rerollShopEngine(runRef.current), phase: 'shop-node' }, 'shop')
  }, [commit])

  const leaveShop = useCallback(() => { commit(leaveShopEngine(runRef.current), 'map') }, [commit])

  const setWizardSpellCb = useCallback((wizardId: string, spellId: string) => {
    commit(setWizardSpell(runRef.current, wizardId, spellId))
  }, [commit])

  const useConsumableRelicCb = useCallback((relicId: string) => {
    commit(useConsumableRelicEngine(runRef.current, relicId))
  }, [commit])

  const advanceArea = useCallback(() => { commit(clearAreaAndAdvance(runRef.current, createRng(runRef.current.seed))) }, [commit])

  const restart = useCallback(() => {
    // "Nuova run" must be a genuinely new run, not a replay: roll a FRESH seed rather
    // than reusing the mount-time `seed` prop (which is frozen for the component's
    // lifetime — from the URL ?seed= or a one-off randomSeed()). The run's own
    // `run.seed` is the single source of truth the UI reads (see RunBRunner), so the
    // draft, map and displayed seed all follow this new value. To REPLAY a specific
    // seed, load it via the URL instead.
    clearRun(); const fresh = startRunB(randomSeed())
    rewardFiredRef.current = false; setRunReward(null)
    applyPoolRestrictions() // profileRef.current now holds unlocks earned by the run just ended
    setBattle(null); setLastFallen([]); commit(fresh, 'draft')
  }, [commit, applyPoolRestrictions])

  const reachable = useMemo(() => engineReachable(run), [run])
  const currentNode = run.map?.find(n => n.id === run.currentNodeId)

  return {
    run, view, battle, reachable, currentNode,
    area: run.area ?? 0, areasTotal: BALANCE.map.areas, lastFallen, runReward,
    completeDraft, chooseNode, commitBattle, acknowledgeVictory,
    chooseRecruit, skipRecruit, chooseRelic, ackInfirmary,
    currentEvent, chooseEventOption, chooseSpellUpgrade,
    setWizardSpell: setWizardSpellCb,
    useConsumableRelic: useConsumableRelicCb,
    cioccorane: profileRef.current.cioccorane,
    buyShopItem, rerollShop, leaveShop,
    advanceArea, restart,
  }
}
