'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { DraftedWizard, RunNode, RunState } from '@/types'
import {
  startRunB, confirmDraftPicks, clearAreaAndAdvance,
  useConsumableRelic as useConsumableRelicEngine,
  leaveShop as leaveShopEngine, rerollShop as rerollShopEngine,
} from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { randomSeed } from '@/lib/seed'
import { loadRun, clearRun } from '@/lib/runStore'
import { BALANCE } from '@/data/constants'
import type { ActiveBattleB } from './useRunB.combat'
import { loadProfile, saveProfile, markSeen, spendCioccorane } from '@/lib/metaStore'
import type { MetaProfile } from '@/lib/metaStore'
import { buildRunEndSummary, recordRunEnd } from '@/lib/metaProgress'
import { shopOffer, shopResolver } from '@/game/engine/resolvers/shop'
import { STARTER_WIZARDS, STARTER_RELICS, type UnlockTarget } from '@/data/unlocks'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { setRelicPoolRestriction } from '@/game/engine/relics'
import { useRunShared, type RunSharedView, type CurrentEventView } from './useRunShared'
import { applySpoilChoice, rollSpoils, spoilLogEvent, spoilsRngForNode, type SpoilChoice } from '@/game/engine/spoils'

export type RunBView = RunSharedView

export interface RunReward { earned: number; unlocked: UnlockTarget[]; profile: MetaProfile }

export type { EventChoiceView, CurrentEventView } from './useRunShared'

export interface RunBController {
  run: RunState; view: RunBView
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  area: number; areasTotal: number; lastFallen: string[]
  newlyDiscoveredDuoIds: string[]
  runReward: RunReward | null
  completeDraft: (picked: DraftedWizard[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  acknowledgeVictory: () => void
  chooseSpoil: (choice: SpoilChoice) => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  skipRecruit: () => void
  chooseRelic: (relicId: string, assignedTo?: string, replaceRelicId?: string) => void
  buyAltare: (relicId: string, costWizardId?: string, costRelicId?: string, carrierId?: string, replaceRelicId?: string) => void
  skipAltare: () => void
  ackInfirmary: () => void
  currentEvent: CurrentEventView | null
  chooseEventOption: (optionId: string) => void
  chooseSpellUpgrade: (wizardId: string) => void
  chooseSpellSwap: (wizardId: string, spellId: string) => void
  useConsumableRelic: (relicId: string) => void
  cioccorane: number
  buyShopItem: (slotId: string, opts?: { carrierId?: string; targetWizardId?: string; replaceRelicId?: string }) => void
  rerollShop: () => void
  leaveShop: () => void
  advanceArea: () => void
  restart: () => void
}

export function useRunB(seed: string): RunBController {
  const [initialRun] = useState<RunState>(() => loadRun() ?? startRunB(seed))
  const [runReward, setRunReward] = useState<RunReward | null>(null)
  const rewardFiredRef = useRef(false)
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

  // Campaign-specific terminal handling: fire the once-only reward ceremony when the
  // shared commit pipeline resolves into 'win'/'defeat'.
  const onCommit = useCallback((next: RunState, view: RunSharedView) => {
    if ((view === 'win' || view === 'defeat') && !rewardFiredRef.current) {
      rewardFiredRef.current = true
      const summary = buildRunEndSummary(next)
      const res = recordRunEnd(profileRef.current, summary)
      profileRef.current = res.profile; saveProfile(res.profile)
      setRunReward({ earned: res.earned, unlocked: res.unlocked, profile: res.profile })
    }
  }, [])

  const shared = useRunShared({ initialRun, profileRef, onCommit })
  const { run, view, battle, lastFallen, newlyDiscoveredDuoIds, runRef, commit, setBattle, setLastFallen } = shared

  const completeDraft = useCallback((picked: DraftedWizard[]) => {
    const next = confirmDraftPicks(runRef.current, picked, createRng(runRef.current.seed))
    let p = profileRef.current
    for (const d of next.team) p = markSeen(p, 'wizard', d.wizard.id)
    profileRef.current = p; saveProfile(p)
    commit(next, 'map')
  }, [commit, runRef])

  const acknowledgeVictory = useCallback(() => { commit({ ...runRef.current, phase: 'map' }, 'map') }, [commit, runRef])

  /** LE SPOGLIE DELLA VITTORIA (solo campagna — §6 del piano: l'endless ri-simula le run per
   *  validare i punteggi, quindi una scelta a metà run è superficie anti-cheat che non apriamo).
   *  L'offerta NON viaggia dalla UI: si RIGENERA qui dal seed+nodo con lo stesso
   *  `spoilsRngForNode` che ha prodotto quella mostrata, e `applySpoilChoice` accetta solo id
   *  che le appartengono — stesso pattern anti-fiducia di `buyShopItem`/`chooseSpellSwap`.
   *  Poi registra la scelta nel `log` (Fase B ha lasciato di proposito la riga al chiamante). */
  const chooseSpoil = useCallback((choice: SpoilChoice) => {
    const cur = runRef.current
    const node = cur.map?.find(n => n.id === cur.currentNodeId)
    if (!node) return
    const offer = rollSpoils(cur, spoilsRngForNode(cur.seed, node.id))
    const spoil = offer.find(s => s.id === choice.spoilId)
    if (!spoil) { commit({ ...cur, phase: 'map' }, 'map'); return }
    const applied = applySpoilChoice(cur, offer, choice)
    // Il log si scrive sullo stato GIÀ applicato: il nome del bersaglio si legge lì.
    const ev = spoilLogEvent(applied, node.id, spoil, choice.wizardId)
    commit({ ...applied, log: [...(applied.log ?? []), ev], phase: 'map' }, 'map')
  }, [commit, runRef])

  const buyShopItem = useCallback((slotId: string, opts?: { carrierId?: string; targetWizardId?: string; replaceRelicId?: string }) => {
    const node = runRef.current.map!.find(n => n.id === runRef.current.currentNodeId)!
    const slot = shopOffer(runRef.current, node, createRng(runRef.current.seed)).slots.find(s => s.id === slotId)
    if (!slot) return
    // Apply the purchase FIRST (pure); a no-op (already bought / remove-guard / relic-cap
    // rejection without a chosen swap) must not charge.
    const next = shopResolver.resolve(runRef.current, node,
      { kind: 'shop-buy', slotId, carrierId: opts?.carrierId, targetWizardId: opts?.targetWizardId, replaceRelicId: opts?.replaceRelicId }, createRng(runRef.current.seed))
    if (next === runRef.current) return
    // Deduct the wallet; if unaffordable, abort with NO state change (discard `next`).
    const spent = spendCioccorane(profileRef.current, slot.price)
    if (!spent) return
    profileRef.current = spent; saveProfile(spent)
    commit({ ...next, phase: 'shop-node' }, 'shop')
  }, [commit, runRef])

  const rerollShop = useCallback(() => {
    const spent = spendCioccorane(profileRef.current, BALANCE.shop.reroll)
    if (!spent) return
    profileRef.current = spent; saveProfile(spent)
    commit({ ...rerollShopEngine(runRef.current), phase: 'shop-node' }, 'shop')
  }, [commit, runRef])

  const leaveShop = useCallback(() => { commit(leaveShopEngine(runRef.current), 'map') }, [commit, runRef])

  const useConsumableRelicCb = useCallback((relicId: string) => {
    commit(useConsumableRelicEngine(runRef.current, relicId))
  }, [commit, runRef])

  const advanceArea = useCallback(() => { commit(clearAreaAndAdvance(runRef.current, createRng(runRef.current.seed))) }, [commit, runRef])

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
  }, [commit, applyPoolRestrictions, setBattle, setLastFallen])

  return {
    run, view, battle, reachable: shared.reachable, currentNode: shared.currentNode,
    area: run.area ?? 0, areasTotal: BALANCE.map.areas, lastFallen, newlyDiscoveredDuoIds, runReward,
    completeDraft, chooseNode: shared.chooseNode, commitBattle: shared.commitBattle, acknowledgeVictory, chooseSpoil,
    chooseRecruit: shared.chooseRecruit, skipRecruit: shared.skipRecruit, chooseRelic: shared.chooseRelic,
    buyAltare: shared.buyAltare, skipAltare: shared.skipAltare, ackInfirmary: shared.ackInfirmary,
    currentEvent: shared.currentEvent, chooseEventOption: shared.chooseEventOption, chooseSpellUpgrade: shared.chooseSpellUpgrade,
    chooseSpellSwap: shared.chooseSpellSwap,
    useConsumableRelic: useConsumableRelicCb,
    cioccorane: profileRef.current.cioccorane,
    buyShopItem, rerollShop, leaveShop,
    advanceArea, restart,
  }
}
