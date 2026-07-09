'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { DraftedWizard, House, RunNode, RunState } from '@/types'
import {
  startRunB, starterOffer as starterOfferEngine, chooseStarters as chooseStartersEngine,
  setWizardSpell, useConsumableRelic as useConsumableRelicEngine,
} from '@/game/engine/runEngine'
import { advanceEndlessArea, scoreForEndlessRun, globalFloor } from '@/game/engine/endless'
import { createRng } from '@/game/engine/rng'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { loadProfile } from '@/lib/metaStore'
import type { MetaProfile } from '@/lib/metaStore'
import { encodeChallenge } from '@/lib/challengeCode'
import { ENGINE_VERSION, type PlayerAction, type RunLog } from '@/game/engine/endlessReplay'
import type { ActiveBattleB } from './useRunB.combat'
import { useRunShared, type RunSharedView, type CurrentEventView } from './useRunShared'

export type EndlessView = RunSharedView

export interface EndlessController {
  run: RunState; view: EndlessView
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  floor: number; score: number | null
  lastFallen: string[]
  starterOffer: (house: House) => DraftedWizard[]
  chooseStarters: (house: House, starterIds: string[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  skipRecruit: () => void
  chooseRelic: (relicId: string, assignedTo?: string) => void
  ackInfirmary: () => void
  currentEvent: CurrentEventView | null
  chooseEventOption: (optionId: string) => void
  chooseSpellUpgrade: (wizardId: string) => void
  setWizardSpell: (wizardId: string, spellId: string) => void
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
  // actually performed them (chooseNode/resolve/set-spell/use-consumable), mirroring
  // exactly the loop replayRun re-applies.
  const actionsRef = useRef<PlayerAction[]>([])
  const houseRef = useRef<House | null>(null)
  const starterIdsRef = useRef<string[]>([])
  const [score, setScore] = useState<number | null>(null)

  const onCommit = useCallback((next: RunState) => {
    if (next.team.length > 0 && next.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)) {
      setScore(scoreForEndlessRun(next))
    }
  }, [])

  const shared = useRunShared({ initialRun, profileRef, onCommit })
  const { run, view, battle, lastFallen, runRef, commit } = shared

  const starterOffer = useCallback((house: House) => starterOfferEngine(seed, house), [seed])

  const chooseStarters = useCallback((house: House, starterIds: string[]) => {
    houseRef.current = house
    starterIdsRef.current = starterIds
    const next = chooseStartersEngine(runRef.current, house, starterIds, createRng(runRef.current.seed))
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

  const chooseRecruit = useCallback((wizardId: string, replaceId?: string) => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'recruit-pick', wizardId, replaceId } })
    shared.chooseRecruit(wizardId, replaceId)
  }, [shared])

  const skipRecruit = useCallback(() => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'skip' } })
    shared.skipRecruit()
  }, [shared])

  const chooseRelic = useCallback((relicId: string, assignedTo?: string) => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'relic-pick', relicId, assignedTo } })
    shared.chooseRelic(relicId, assignedTo)
  }, [shared])

  const ackInfirmary = useCallback(() => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'combat-ack' } })
    shared.ackInfirmary()
  }, [shared])

  const chooseEventOption = useCallback((optionId: string) => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'event-choice', optionId } })
    shared.chooseEventOption(optionId)
  }, [shared])

  const chooseSpellUpgrade = useCallback((wizardId: string) => {
    actionsRef.current.push({ t: 'resolve', choice: { kind: 'spell-upgrade', wizardId } })
    shared.chooseSpellUpgrade(wizardId)
  }, [shared])

  const setWizardSpellCb = useCallback((wizardId: string, spellId: string) => {
    actionsRef.current.push({ t: 'set-spell', wizardId, spellId })
    commit(setWizardSpell(runRef.current, wizardId, spellId))
  }, [commit, runRef])

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
      house: houseRef.current ?? runRef.current.house!,
      starterIds: starterIdsRef.current,
      actions: actionsRef.current,
    }
    return encodeChallenge(log)
  }, [runRef])

  return {
    run, view, battle, reachable: shared.reachable, currentNode: shared.currentNode,
    floor: globalFloor(run), score,
    lastFallen,
    starterOffer, chooseStarters,
    chooseNode, commitBattle,
    chooseRecruit, skipRecruit, chooseRelic, ackInfirmary,
    currentEvent: shared.currentEvent, chooseEventOption, chooseSpellUpgrade,
    setWizardSpell: setWizardSpellCb,
    useConsumableRelic: useConsumableRelicCb,
    advanceArea,
    getChallengeCode,
  }
}
