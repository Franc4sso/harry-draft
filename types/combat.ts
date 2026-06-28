import type { Spell, SpellType, Stat } from './spell'
import type { StatusKind } from './status'
import type { Stats, Wizard } from './wizard'

export interface GrowthChoice {
  atLevel: number
  kind: 'atk' | 'def' | 'spd' | 'hp'
}

export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
  /** Current HP carried across battles in a run. Absent = full (treated as maxHp). */
  currentHp?: number
  /** Rare draft "shiny" nature: grants one trait + a name epithet. Player-only. */
  shiny?: { traitId: string }
  /** Run progression (player wizards only; absent on enemy teams → treated as level 1). */
  level?: number
  exp?: number
  recruitedVia?: string
  growthChoices?: GrowthChoice[]
}

export interface ActiveEffect {
  kind: StatusKind
  stat?: Stat
  amount?: number
  remaining: number
  statusId?: string
  stacks?: number
  sourceId?: string
  absorbLeft?: number
}

export type Side = 'left' | 'right'

export interface BattleUnit extends DraftedWizard {
  side: Side
  hp: number
  cooldowns: Record<string, number>
  statusEffects: ActiveEffect[]
  buffedStats: Stats
  alive: boolean
  /** True when this unit's side has the Tossicità synergy active → veleno it applies ignores maxStacks. */
  velenoUncapped?: boolean
}

export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot' | 'pen' | 'shatter' | 'wait'

export interface LogEntry {
  turn: number
  actorId: string
  /** Side of the acting unit. Optional for backwards-compat; populated by the engine. */
  actorSide?: Side
  action: string
  targetId?: string
  /** Side of the targeted unit. Optional for backwards-compat; populated by the engine. */
  targetSide?: Side
  type: SpellType | 'system'
  value?: number
  flags: LogFlag[]
}

export interface UnitSnapshot { id: string; side: Side; hp: number; maxHp: number; alive: boolean }

/** Per-unit engine state captured at the instant a log entry is pushed. Deep-copied. */
export interface UnitStepState {
  hp: number
  alive: boolean
  cooldowns: Record<string, number>
  statusEffects: ActiveEffect[]
}

/** Full battlefield state at one log step, keyed by `${side}:${id}` (unitKey). */
export type StepSnapshot = Record<string, UnitStepState>

export interface BattleResult {
  winner: Side
  turns: number
  log: LogEntry[]
  mvpId: string
  finalSnapshot: UnitSnapshot[]
  /** 1:1 with `log`: snapshots[i] is the deep-copied state captured when log[i] was pushed. */
  snapshots: StepSnapshot[]
}
