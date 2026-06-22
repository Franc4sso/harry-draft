import type { ActiveSynergy, DraftedWizard, BattleResult } from './index'

export type RunPhase =
  | 'menu' | 'draft' | 'team' | 'battle'
  | 'victory' | 'defeat' | 'boss' | 'win'

export interface RunState {
  seed: string
  phase: RunPhase
  team: DraftedWizard[]
  activeSynergies: ActiveSynergy[]
  stage: number
  lastBattle?: BattleResult
}
