import type { ActiveSynergy, DraftedWizard, BattleResult } from './index'
import type { ActiveRelic } from './relic'

export type RunPhase =
  | 'menu' | 'draft' | 'team' | 'battle'
  | 'victory' | 'defeat' | 'win'

export type RunNodeType = 'battle' | 'elite' | 'boss' | 'event' | 'shop' | 'relic'

export interface RunNode {
  id: string
  type: RunNodeType
  /** ids of reachable nodes (branching graph). */
  next: string[]
}

export interface RunState {
  seed: string
  phase: RunPhase
  team: DraftedWizard[]
  activeSynergies: ActiveSynergy[]
  stage: number
  lastBattle?: BattleResult
  relics: ActiveRelic[]
  map?: RunNode[]          // populated by a future map-generation spec; absent today
  currentNodeId?: string   // player position on the map
}
