'use client'
import { useState, useRef, useCallback } from 'react'
import type { ActiveSynergy, BattleResult, DraftedWizard, Relic, RunNode, RunState } from '@/types'
import { startRun, confirmTeam, nextBattle, addRelic, advanceToNode, nodeById, relicOfferRngChannel } from '@/game/engine/run'
import { nodeDepth } from '@/game/engine/map'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

export type RunView = 'team' | 'map' | 'boss' | 'battle' | 'victory' | 'defeat' | 'win' | 'relic-choice'

/** The selectable next nodes from the run's current node (pure; also used by tests/MapScreen). */
export function reachableFrom(state: RunState): RunNode[] {
  const cur = state.currentNodeId ? nodeById(state, state.currentNodeId) : undefined
  if (!cur) return []
  return cur.next.map(id => nodeById(state, id)).filter((n): n is RunNode => !!n)
}

export interface ActiveBattle {
  result: BattleResult
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  isBoss: boolean
}

export interface RunController {
  run: RunState
  view: RunView
  battle: ActiveBattle | null
  /** Total non-boss enemies before the boss. */
  enemyCount: number
  /** 1-based index of the battle about to be / just fought. */
  battleNumber: number
  /** True when the next fight is the boss. */
  bossNext: boolean
  /** Relics offered to the player at the current stage. */
  relicChoices: Relic[]
  /** The node the player currently sits on in the run map. */
  currentNode: RunNode | undefined
  /** The legal next nodes the player may move to from currentNode. */
  reachable: RunNode[]
  startBattle: () => void
  /** Reveal victory/defeat/win once the replay finishes. */
  revealResult: () => void
  /** From a victory screen: go to relic-choice (or boss intro if last stage). */
  advance: () => void
  /** Pick a relic from relicChoices, add it to the run, then return to the map. */
  chooseRelic: (relic: Relic) => void
  /** Move to a legal next node, then start that node's battle. */
  chooseNode: (nodeId: string) => void
  /** Show the run map (called by TeamScreen once the team is confirmed). */
  enterMap: () => void
}

/**
 * Drives a full campaign run from a confirmed team: 5 enemy teams then the
 * boss. The pure engine (run.ts) owns all combat + RNG; this only sequences
 * the views the player walks through (battle → victory → relic-choice → next → … → win/defeat).
 */
export function useRun(seed: string, team: DraftedWizard[]): RunController {
  const [run, setRun] = useState<RunState>(() => confirmTeam(startRun(seed), team))
  const [view, setView] = useState<RunView>('team')
  const [battle, setBattle] = useState<ActiveBattle | null>(null)
  const runRef = useRef(run)
  runRef.current = run

  const enemyCount = BALANCE.campaign.enemyCount

  const enterMap = useCallback(() => setView('map'), [])

  const startBattle = useCallback(() => {
    const { state, result, enemy, enemySyn, isBoss } = nextBattle(runRef.current)
    runRef.current = state
    setRun(state)
    setBattle({ result, enemy, enemySyn, isBoss })
    setView('battle')
  }, [])

  const revealResult = useCallback(() => {
    // After nextBattle, run.phase is exactly one of victory | win | defeat.
    setView(runRef.current.phase as RunView)
  }, [])

  const advance = useCallback(() => {
    setView('relic-choice')
  }, [])

  const chooseRelic = useCallback((relic: Relic) => {
    const next = addRelic(runRef.current, relic)
    runRef.current = next
    setRun(next)
    setView('map') // back to the map; the player picks the next node
  }, [])

  const chooseNode = useCallback((nodeId: string) => {
    const advanced = advanceToNode(runRef.current, nodeId)
    runRef.current = advanced
    setRun(advanced)
    startBattle() // uses node-depth difficulty via nextBattle reading currentNodeId
  }, [startBattle])

  const relicChoices = offerRelics(
    createRng(seed).fork(relicOfferRngChannel).fork(run.stage),
    run.relics,
    run.stage,
  )

  const currentNode = run.currentNodeId ? nodeById(run, run.currentNodeId) : undefined
  const reachable = reachableFrom(run)

  const bossNext = currentNode?.type === 'boss'
  const battleNumber = currentNode ? nodeDepth(currentNode.id) + 1 : 1

  return {
    run,
    view,
    battle,
    enemyCount,
    battleNumber,
    bossNext,
    relicChoices,
    currentNode,
    reachable,
    startBattle,
    revealResult,
    advance,
    chooseRelic,
    chooseNode,
    enterMap,
  }
}
