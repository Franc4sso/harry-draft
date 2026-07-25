import type { ActiveSynergy, DraftedWizard, BattleResult, House } from './index'
import type { ActiveRelic } from './relic'

export type RunPhase =
  | 'menu' | 'draft' | 'team' | 'battle'
  | 'victory' | 'defeat' | 'win'
  // Fase 1 redesign (Plan B):
  | 'house' | 'starter' | 'map' | 'recruit-node' | 'relic-node' | 'infirmary-node' | 'event-node' | 'spellForge-node' | 'spellSwap-node' | 'area-cleared' | 'altare-node'

export type RunNodeType =
  // Fase 1 — generati e risolti
  | 'battle' | 'elite' | 'boss' | 'recruit' | 'relic' | 'infirmary' | 'spellForge' | 'spellSwap'
  // Fasi 2-3 — catalogati ora, generati dopo
  | 'event' | 'commonRoom'
  | 'library' | 'potions' | 'forest'
  | 'altare'

export interface NodeBattle {
  /** The drafted enemy team (stat-rolls already fixed). */
  enemyTeam: DraftedWizard[]
  /** Enemy relics for elite/boss nodes (empty otherwise). */
  enemyRelics: ActiveRelic[]
  /** Displayed enemy level (menace was removed 2026-07-01; difficulty now comes from level + budget). */
  enemyLevel: number
  /** Exclusive synergy carried by the FINAL boss only. */
  bossSynergy?: ActiveSynergy
  /** Wall archetype: per-unit direct-damage reduction for the enemy boss team (boss nodes only). */
  unitDamageReduction?: number
  /** Bellatrix signature: enemy boss side ignores the player Tank's taunt (boss nodes only). */
  ignoresTaunt?: boolean
}

export interface NodePreview {
  /** synergy.id list for the map telegraph badges. */
  synergyIds: string[]
  /** Final-boss display name (boss nodes only). */
  bossName?: string
  /** Telegraph copy for a scripted boss weakness (e.g. Muro → veleno). */
  bossHint?: string
  /** The scripted boss's leader portrait id + house, so the map seal shows the boss's
   *  face instead of the generic crown. Absent for leaderless bosses (e.g. Il Muro). */
  bossFace?: { id: string; house: House }
}

export interface RunNode {
  id: string
  type: RunNodeType
  /** ids of reachable nodes (branching graph). */
  next: string[]
  /** true once the node has been completed (for save/render). */
  resolved?: boolean
  /** Pre-generated battle package (combat nodes only; absent on legacy saves). */
  battle?: NodeBattle
  /** Telegraph data derived from `battle` (combat nodes only). */
  preview?: NodePreview
}

/** Narrative log entry — seeds the Fase 4 end-of-run story screen. */
export interface RunEvent {
  area: number
  nodeId: string
  kind: 'recruit' | 'relic' | 'elite' | 'boss' | 'levelMilestone' | 'infirmary' | 'event' | 'spellForge' | 'altare' | 'spellSwap'
  /** 'spoglie': la Spoglia scelta dopo una vittoria normale (Marchio / Allenamento / Ristoro). */
  | 'spoglie'
  summary: string
}

/** A wizard crossing a milestone level, awaiting the player's growth choice. */
export interface PendingLevelUp {
  wizardId: string
  atLevel: number
}

/** Modificatori permanenti di run firmati con un Patto (P5). Campi discreti, tutti opzionali.
 *  Invariante: ogni campo è un sentinel `true`-only (presente = attivo, assente = inattivo).
 *  Mai `false` — `canPay('runModifier')` e il case `setRunModifier` assumono questa forma. */
export interface RunModifiers {
  /** Voto Infrangibile: nessuna recluta per il resto della run (resolver + eventi addWizard no-op). */
  noRecruits?: true
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
  // Fase 1 redesign (Plan B) — all optional so the legacy loop keeps compiling.
  house?: House
  area?: number
  teamMax?: number
  log?: RunEvent[]
  pendingLevelUps?: PendingLevelUp[]
  endless?: boolean
  runModifiers?: RunModifiers
}
