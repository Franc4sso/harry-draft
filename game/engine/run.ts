import type { ActiveSynergy, BattleResult, DraftedWizard, Relic, RunState } from '@/types'
import { createRng } from './rng'
import { detectSynergies } from './synergy'
import { simulateBattle } from './combat/simulate'
import { generateEnemyTeam, generateBossTeam, budgetForStage } from './combat/teamGen'
import { BALANCE } from '@/data/constants'
import { BOSSES } from '@/data/bosses'

export const draftRngChannel = 1
export const combatRngChannel = 2
export const relicOfferRngChannel = 3

export function startRun(seed: string): RunState {
  return { seed, phase: 'draft', team: [], activeSynergies: [], stage: 0, relics: [] }
}

export function addRelic(state: RunState, relic: Relic): RunState {
  return { ...state, relics: [...state.relics, { relic, stageObtained: state.stage }] }
}

export function confirmTeam(state: RunState, team: DraftedWizard[]): RunState {
  return { ...state, team, activeSynergies: detectSynergies(team), phase: 'team' }
}

export interface BattleOutcome {
  state: RunState
  result: BattleResult
  /** The enemy team faced this battle — needed to render/replay the fight. */
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  isBoss: boolean
}

export function nextBattle(state: RunState): BattleOutcome {
  const isBoss = state.stage >= BALANCE.campaign.enemyCount
  const base = createRng(state.seed).fork(combatRngChannel)
  const enemyRng = base.fork(state.stage + 1)
  const battleRng = base.fork(state.stage + 100)

  const enemy = isBoss
    ? generateBossTeam(enemyRng, BOSSES[0]!)
    : generateEnemyTeam(enemyRng, budgetForStage(state.stage))
  const enemySyn = detectSynergies(enemy)

  const result = simulateBattle(state.team, enemy, battleRng, {
    leftSyn: state.activeSynergies, rightSyn: enemySyn,
  })

  const won = result.winner === 'left'
  const nextStage = state.stage + 1
  const phase: RunState['phase'] = !won
    ? 'defeat'
    : isBoss ? 'win' : 'victory'

  return {
    state: { ...state, stage: nextStage, lastBattle: result, phase },
    result, enemy, enemySyn, isBoss,
  }
}
