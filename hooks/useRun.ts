'use client'
import { useState, useRef, useCallback } from 'react'
import type { ActiveSynergy, BattleResult, DraftedWizard, Relic, RunState } from '@/types'
import { startRun, confirmTeam, nextBattle, addRelic, relicOfferRngChannel } from '@/game/engine/run'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

export type RunView = 'team' | 'boss' | 'battle' | 'victory' | 'defeat' | 'win' | 'relic-choice'

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
  startBattle: () => void
  /** Reveal victory/defeat/win once the replay finishes. */
  revealResult: () => void
  /** From a victory screen: go to relic-choice (or boss intro if last stage). */
  advance: () => void
  /** Pick a relic from relicChoices, add it to the run, then start next battle. */
  chooseRelic: (relic: Relic) => void
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
    if (runRef.current.stage >= enemyCount) setView('boss')
    else setView('relic-choice')
  }, [enemyCount])

  const chooseRelic = useCallback((relic: Relic) => {
    const next = addRelic(runRef.current, relic)
    runRef.current = next
    setRun(next)
    startBattle()
  }, [startBattle])

  const relicChoices = offerRelics(
    createRng(seed).fork(relicOfferRngChannel).fork(run.stage),
    run.relics,
    run.stage,
  )

  const bossNext = run.stage >= enemyCount
  const battleNumber = Math.min(run.stage + 1, enemyCount + 1)

  return {
    run,
    view,
    battle,
    enemyCount,
    battleNumber,
    bossNext,
    relicChoices,
    startBattle,
    revealResult,
    advance,
    chooseRelic,
  }
}
