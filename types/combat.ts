import type { Spell, SpellType, Stat } from './spell'
import type { Stats, Wizard } from './wizard'

export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
}

export interface ActiveEffect {
  kind: 'buff' | 'debuff' | 'dot' | 'stun'
  stat?: Stat
  amount?: number
  remaining: number
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
  action: string
  targetId?: string
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
