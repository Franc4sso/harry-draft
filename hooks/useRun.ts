'use client'
import { useState, useRef, useCallback } from 'react'
import type { ActiveSynergy, BattleResult, DraftedWizard, Relic, RunNode, RunState } from '@/types'
import { startRun, confirmTeam, nextBattle, addRelic, advanceToNode, nodeById, relicOfferRngChannel } from '@/game/engine/run'
import { nodeDepth } from '@/game/engine/map'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

export type RunView = 'team' | 'map' | 'battle' | 'victory' | 'defeat' | 'win' | 'relic-choice'

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
  /**
   * The player roster AS IT ENTERED this fight (before casualties are removed)
   * plus the synergies active during it. The replay must render from this — not
   * from run.team, which nextBattle already reduced to survivors — so a wizard
   * who dies this battle still appears and animates to death instead of vanishing.
   */
  playerTeam: DraftedWizard[]
  playerSyn: ActiveSynergy[]
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
  /** Names of player wizards permanently lost in the most recent battle. */
  lastFallen: string[]
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
  const [lastFallen, setLastFallen] = useState<string[]>([])
  const runRef = useRef(run)
  runRef.current = run

  // enemyCount / battleNumber definition (graph-derived, honest + monotonic):
  //   The map has floors 0..maxDepth; floor maxDepth is the boss. Floor 0 is the
  //   player's START position — in the UI flow the player enters the map and
  //   picks a *reachable* next node (floor 1) to fight, so floor 0 is never
  //   itself a fought "Sfida". The fought non-boss floors are therefore 1..(maxDepth-1),
  //   which is exactly (maxDepth - 1) battles. We define:
  //     enemyCount   = maxDepth - 1          (total non-boss fights, Y in "Sfida X di Y")
  //     battleNumber = nodeDepth(current)    (depth-1 → "Sfida 1", depth-4 → "Sfida 4")
  //   So the first fight reads "Sfida 1 di N", the last non-boss fight "Sfida N di N",
  //   then the boss — monotonic and exhaustive. Falls back to the BALANCE constant
  //   when no map is present (legacy/linear callers).
  const maxDepth = run.map ? Math.max(...run.map.map(n => nodeDepth(n.id))) : undefined
  const enemyCount = maxDepth !== undefined ? maxDepth - 1 : BALANCE.campaign.enemyCount

  const enterMap = useCallback(() => setView('map'), [])

  const startBattle = useCallback(() => {
    // Snapshot the roster + synergies BEFORE nextBattle reduces them to
    // survivors — these are exactly what the engine simulated with, so the
    // replay's HP pools line up and the fallen still render (then die on-screen).
    const before = runRef.current.team
    const beforeSyn = runRef.current.activeSynergies
    const { state, result, enemy, enemySyn, isBoss } = nextBattle(runRef.current)
    const survivingIds = new Set(state.team.map(d => d.wizard.id))
    const fallen = before.filter(d => !survivingIds.has(d.wizard.id)).map(d => d.wizard.name)
    setLastFallen(fallen)
    runRef.current = state
    setRun(state)
    setBattle({ result, enemy, enemySyn, isBoss, playerTeam: before, playerSyn: beforeSyn })
    setView('battle')
  }, [])

  const revealResult = useCallback(() => {
    // After nextBattle, phase is exactly one of victory | win | defeat — all valid RunView members.
    setView(runRef.current.phase as 'victory' | 'win' | 'defeat')
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
  // 1-based "Sfida X" index = the current node's floor depth (floor 0 is the
  // un-fought start position; floor 1 is the first fight = "Sfida 1").
  const battleNumber = currentNode ? nodeDepth(currentNode.id) : 1

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
    lastFallen,
    startBattle,
    revealResult,
    advance,
    chooseRelic,
    chooseNode,
    enterMap,
  }
}
