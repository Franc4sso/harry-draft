import type { ActiveSynergy, DraftedWizard, BattleResult } from './index'
import type { ActiveRelic } from './relic'

export type RunPhase =
  | 'menu' | 'draft' | 'team' | 'battle'
  | 'victory' | 'defeat' | 'win'

export type RunNodeType =
  // Fase 1 — generati e risolti
  | 'battle' | 'elite' | 'boss' | 'recruit' | 'relic'
  // Fasi 2-3 — catalogati ora, generati dopo
  | 'shop' | 'event' | 'commonRoom'
  | 'library' | 'potions' | 'forest'

export interface RunNode {
  id: string
  type: RunNodeType
  /** ids of reachable nodes (branching graph). */
  next: string[]
  /** true once the node has been completed (for save/render). */
  resolved?: boolean
}

/** Narrative log entry — seeds the Fase 4 end-of-run story screen. */
export interface RunEvent {
  area: number
  nodeId: string
  kind: 'recruit' | 'relic' | 'elite' | 'boss' | 'levelMilestone'
  summary: string
}

/** A wizard crossing a milestone level, awaiting the player's growth choice. */
export interface PendingLevelUp {
  wizardId: string
  atLevel: number
}

export interface RunState {
  seed: string
  phase: RunPhase
  team: DraftedWizard[]
  activeSynergies: ActiveSynergy[]
  stage: number
  lastBattle?: BattleResult
  relics: ActiveRelic[]
  map?: RunNode[]
  currentNodeId?: string
}
