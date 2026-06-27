'use client'
import { useState, useRef, useCallback, useMemo } from 'react'
import type { DraftedWizard, GrowthChoice, PendingLevelUp, RunNode, RunState } from '@/types'
import {
  startRunB, confirmDraftPicks, reachable as engineReachable,
  moveTo, resolveCurrent, applyLevelUp, clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { saveRun, loadRun, clearRun } from '@/lib/runStore'
import { BALANCE } from '@/data/constants'
import { prepareCombat, combatRng, type ActiveBattleB } from './useRunB.combat'

registerCoreResolvers()

export type RunBView =
  | 'draft' | 'map' | 'battle' | 'victory'
  | 'levelup' | 'recruit' | 'relic' | 'area-cleared' | 'win' | 'defeat'

export interface RunBController {
  run: RunState; view: RunBView
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  area: number; areasTotal: number; pendingLevelUp: PendingLevelUp | null; lastFallen: string[]
  completeDraft: (picked: DraftedWizard[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  acknowledgeVictory: () => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  chooseRelic: (relicId: string) => void
  applyGrowth: (choice: GrowthChoice) => void
  advanceArea: () => void
  restart: () => void
}

const viewForPhase = (p: RunState['phase']): RunBView => {
  switch (p) {
    case 'draft': return 'draft'
    case 'map': return 'map'
    case 'battle': return 'battle'
    case 'victory': return 'victory'
    case 'levelup': return 'levelup'
    case 'recruit-node': return 'recruit'
    case 'relic-node': return 'relic'
    case 'area-cleared': return 'area-cleared'
    case 'win': return 'win'
    case 'defeat': return 'defeat'
    default: return 'map'
  }
}

export function useRunB(seed: string): RunBController {
  const [run, setRunState] = useState<RunState>(() => loadRun() ?? startRunB(seed))
  const [view, setView] = useState<RunBView>(() => viewForPhase((loadRun() ?? startRunB(seed)).phase))
  const [battle, setBattle] = useState<ActiveBattleB | null>(null)
  const [lastFallen, setLastFallen] = useState<string[]>([])
  const runRef = useRef(run); runRef.current = run

  const commit = useCallback((next: RunState, v?: RunBView) => {
    runRef.current = next; setRunState(next); saveRun(next)
    setView(v ?? viewForPhase(next.phase))
  }, [])

  const completeDraft = useCallback((picked: DraftedWizard[]) => {
    const next = confirmDraftPicks(runRef.current, picked, createRng(runRef.current.seed))
    commit(next, 'map')
  }, [commit])

  const chooseNode = useCallback((nodeId: string) => {
    const moved = moveTo(runRef.current, nodeId)
    if (moved.phase === 'battle') {
      runRef.current = moved
      setBattle(prepareCombat(moved))
      commit(moved, 'battle')
    } else {
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
    commit({ ...next, phase: 'map' }, 'map') // non-combat node: straight back to map
  }, [commit])

  const chooseRelic = useCallback((relicId: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'relic-pick', relicId }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  const applyGrowth = useCallback((choice: GrowthChoice) => {
    const p = runRef.current.pendingLevelUps?.[0]
    if (!p) return
    commit(applyLevelUp(runRef.current, p.wizardId, choice))
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
    area: run.area ?? 0, areasTotal: BALANCE.map.areas, pendingLevelUp: run.pendingLevelUps?.[0] ?? null, lastFallen,
    completeDraft, chooseNode, commitBattle, acknowledgeVictory,
    chooseRecruit, chooseRelic, applyGrowth, advanceArea, restart,
  }
}
