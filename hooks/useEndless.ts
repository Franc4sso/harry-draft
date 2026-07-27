'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { DraftedWizard, RunNode, RunState } from '@/types'
import {
  startRunB, confirmDraftPicks,
  useConsumableRelic as useConsumableRelicEngine,
} from '@/game/engine/runEngine'
import { advanceEndlessArea, scoreForEndlessRun, globalFloor } from '@/game/engine/endless'
import { createRng } from '@/game/engine/rng'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { loadProfile } from '@/lib/metaStore'
import type { MetaProfile } from '@/lib/metaStore'
import { encodeChallenge } from '@/lib/challengeCode'
import { ENGINE_VERSION, type PlayerAction, type RunLog } from '@/game/engine/endlessReplay'
import { RUN_KEY_ENDLESS } from '@/lib/runStore'
import type { ActiveBattleB } from './useRunB.combat'
import { useRunShared, type RunSharedView, type CurrentEventView } from './useRunShared'

export type EndlessView = RunSharedView

export interface EndlessController {
  run: RunState; view: EndlessView
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  floor: number; score: number | null
  lastFallen: string[]
  newlyDiscoveredDuoIds: string[]
  completeDraft: (picked: DraftedWizard[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  acknowledgeVictory: () => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  skipRecruit: () => void
  chooseRelic: (relicId: string, assignedTo?: string, replaceRelicId?: string) => void
  ackInfirmary: () => void
  currentEvent: CurrentEventView | null
  chooseEventOption: (optionId: string) => void
  useConsumableRelic: (relicId: string) => void
  advanceArea: () => void
  getChallengeCode: () => string
}

/** Endless-mode run controller. Mirrors useRunB's shape but: drafts from the FULL
 *  roster (Decision 4 — no profile pool restriction), advances areas forever via
 *  advanceEndlessArea (never 'win'), and RECORDS every player action into an
 *  internal log so a finished run can be exported as a replayable challenge code
 *  (getChallengeCode). The recorded actions must exactly match, in the same order,
 *  what replayRun (game/engine/endlessReplay.ts) re-applies — see each wrapped
 *  callback below. */
export function useEndless(seed: string): EndlessController {
  const [initialRun] = useState<RunState>(() => ({ ...startRunB(seed), endless: true }))
  const profileRef = useRef<MetaProfile>(loadProfile())

  // Decision 4: endless drafts from the full roster, never the profile's unlocked
  // subset — unlike useRunB, no setRelicPoolRestriction either (relic pool stays
  // whatever the campaign last set; the relic resolver's offers aren't gated by
  // this task, only the draft pool is called out in the brief). Runs synchronously
  // during render, before any offer is computed downstream, same as useRunB.
  useMemo(() => { setDraftPoolRestriction(null) }, [])

  // Actions recorded in call order — the single source of truth for getChallengeCode().
  // A ref (not state) because pushing to it must never trigger a re-render, and every
  // wrapped callback below appends to it synchronously in the same order the player
  // actually performed them (chooseNode/resolve/use-consumable), mirroring
  // exactly the loop replayRun re-applies.
  const actionsRef = useRef<PlayerAction[]>([])
  const draftPicksRef = useRef<string[]>([])
  const [score, setScore] = useState<number | null>(null)

  const onCommit = useCallback((next: RunState) => {
    if (next.team.length > 0 && next.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)) {
      setScore(scoreForEndlessRun(next))
    }
  }, [])

  const shared = useRunShared({ initialRun, profileRef, onCommit, runKey: RUN_KEY_ENDLESS })
  const { run, view, battle, lastFallen, newlyDiscoveredDuoIds, runRef, commit } = shared

  const completeDraft = useCallback((picked: DraftedWizard[]) => {
    draftPicksRef.current = picked.map(d => d.wizard.id)
    const next = confirmDraftPicks({ ...runRef.current, endless: true }, picked, createRng(runRef.current.seed))
    commit({ ...next, endless: true }, 'map')
  }, [commit, runRef])

  const chooseNode = useCallback((nodeId: string) => {
    actionsRef.current.push({ t: 'move', nodeId })
    shared.chooseNode(nodeId)
  }, [shared])

  const commitBattle = useCallback(() => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'combat-ack' } })
    shared.commitBattle()
  }, [shared])

  // 'victory' (non-boss combat win) is a UI-only pause — replayRun's move/resolve loop
  // never special-cases it (moveTo doesn't gate on phase; see game/engine/runEngine.ts),
  // so unlike every other transition here this one is NOT recorded as a PlayerAction:
  // the next real decision (a 'move') is what replay actually re-applies. Mirrors
  // useRunB's acknowledgeVictory (same phase-only commit back to 'map').
  const acknowledgeVictory = useCallback(() => {
    commit({ ...runRef.current, phase: 'map' }, 'map')
  }, [commit, runRef])

  const chooseRecruit = useCallback((wizardId: string, replaceId?: string) => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'recruit-pick', wizardId, replaceId } })
    shared.chooseRecruit(wizardId, replaceId)
  }, [shared])

  const skipRecruit = useCallback(() => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'skip' } })
    shared.skipRecruit()
  }, [shared])

  const chooseRelic = useCallback((relicId: string, assignedTo?: string, replaceRelicId?: string) => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'relic-pick', relicId, assignedTo, replaceRelicId } })
    shared.chooseRelic(relicId, assignedTo, replaceRelicId)
  }, [shared])

  const ackInfirmary = useCallback(() => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'combat-ack' } })
    shared.ackInfirmary()
  }, [shared])

  const chooseEventOption = useCallback((optionId: string) => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'event-choice', optionId } })
    shared.chooseEventOption(optionId)
  }, [shared])

  const useConsumableRelicCb = useCallback((relicId: string) => {
    actionsRef.current.push({ t: 'use-consumable', relicId })
    commit(useConsumableRelicEngine(runRef.current, relicId))
  }, [commit, runRef])

  // Endless never wins — always regenerate the next area (Decision: infinite run).
  const advanceArea = useCallback(() => {
    commit(advanceEndlessArea(runRef.current, createRng(runRef.current.seed)))
  }, [commit, runRef])

  const getChallengeCode = useCallback((): string => {
    const log: RunLog = {
      v: 1,
      engine: ENGINE_VERSION,
      seed: runRef.current.seed,
      draftPicks: draftPicksRef.current,
      actions: actionsRef.current,
    }
    return encodeChallenge(log)
  }, [runRef])

  return {
    run, view, battle, reachable: shared.reachable, currentNode: shared.currentNode,
    floor: globalFloor(run), score,
    lastFallen, newlyDiscoveredDuoIds,
    completeDraft,
    chooseNode, commitBattle, acknowledgeVictory,
    chooseRecruit, skipRecruit, chooseRelic, ackInfirmary,
    currentEvent: shared.currentEvent, chooseEventOption,
    useConsumableRelic: useConsumableRelicCb,
    advanceArea,
    getChallengeCode,
  }
}
