import type { Spell, SpellType, Stat } from './spell'
import type { StatusKind } from './status'
import type { Stats, Wizard } from './wizard'

export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
  /** Current HP carried across battles in a run. Absent = full (treated as maxHp). */
  currentHp?: number
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
}

export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot'

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

export interface UnitSnapshot { id: string; hp: number; maxHp: number; alive: boolean }

export interface BattleResult {
  winner: Side
  turns: number
  log: LogEntry[]
  mvpId: string
  finalSnapshot: UnitSnapshot[]
}
