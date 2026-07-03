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
import { saveRun, loadRun, clearRun } from '@/lib/runStore'
import { BALANCE } from '@/data/constants'
import { prepareCombat, combatRng, type ActiveBattleB } from './useRunB.combat'
import { loadProfile, saveProfile, markSeen } from '@/lib/metaStore'
import { relicOffer } from '@/game/engine/resolvers/recruit'
import { STARTER_WIZARDS, STARTER_RELICS } from '@/data/unlocks'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { setRelicPoolRestriction } from '@/game/engine/relics'

registerCoreResolvers()

export type RunBView =
  | 'draft' | 'map' | 'battle' | 'victory'
  | 'recruit' | 'relic' | 'infirmary' | 'area-cleared' | 'win' | 'defeat'

export interface RunBController {
  run: RunState; view: RunBView
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  area: number; areasTotal: number; lastFallen: string[]
  completeDraft: (picked: DraftedWizard[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  acknowledgeVictory: () => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  skipRecruit: () => void
  chooseRelic: (relicId: string, assignedTo?: string) => void
  ackInfirmary: () => void
  setWizardSpell: (wizardId: string, spellId: string) => void
  useConsumableRelic: (relicId: string) => void
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
    case 'area-cleared': return 'area-cleared'
    case 'win': return 'win'
    case 'defeat': return 'defeat'
    default: return 'map'
  }
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
  const runRef = useRef(run); runRef.current = run
  const profileRef = useRef(loadProfile())
  // Restrict the player-facing pools to the starter set + whatever the profile has
  // unlocked so far. Runs synchronously during render, before any offer (draft/
  // recruit/relic) is computed downstream — mirrors the loadRun() client-read pattern.
  useMemo(() => {
    const p = profileRef.current
    setDraftPoolRestriction([...STARTER_WIZARDS, ...p.unlockedWizards])
    setRelicPoolRestriction([...STARTER_RELICS, ...p.unlockedRelics])
  }, [])

  const commit = useCallback((next: RunState, v?: RunBView) => {
    runRef.current = next; setRunState(next); saveRun(next)
    setView(v ?? viewForPhase(next.phase))
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

  const setWizardSpellCb = useCallback((wizardId: string, spellId: string) => {
    commit(setWizardSpell(runRef.current, wizardId, spellId))
  }, [commit])

  const useConsumableRelicCb = useCallback((relicId: string) => {
    commit(useConsumableRelicEngine(runRef.current, relicId))
  }, [commit])

  const advanceArea = useCallback(() => { commit(clearAreaAndAdvance(runRef.current, createRng(runRef.current.seed))) }, [commit])

  const restart = useCallback(() => {
    clearRun(); const fresh = startRunB(seed)
    setBattle(null); setLastFallen([]); commit(fresh, 'draft')
  }, [seed, commit])

  const reachable = useMemo(() => engineReachable(run), [run])
  const currentNode = run.map?.find(n => n.id === run.currentNodeId)

  return {
    run, view, battle, reachable, currentNode,
    area: run.area ?? 0, areasTotal: BALANCE.map.areas, lastFallen,
    completeDraft, chooseNode, commitBattle, acknowledgeVictory,
    chooseRecruit, skipRecruit, chooseRelic, ackInfirmary, setWizardSpell: setWizardSpellCb,
    useConsumableRelic: useConsumableRelicCb,
    advanceArea, restart,
  }
}
