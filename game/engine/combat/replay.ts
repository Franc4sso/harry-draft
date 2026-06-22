import type {
  ActiveSynergy, BattleResult, DraftedWizard, House, LogEntry, Role, Side,
} from '@/types'
import { toBattleUnits } from './simulate'

/** Stable identity for a unit within a single battle: side + wizard id. */
export function unitKey(side: Side, id: string): string {
  return `${side}:${id}`
}

export interface ReplayUnit {
  key: string
  side: Side
  id: string
  name: string
  house: House
  role: Role
  maxHp: number
}

export interface ReplayFrame {
  /** 0 = initial state (full HP, no action yet); 1..N after each log entry. */
  index: number
  /** The log entry that produced this frame, or null for the initial frame. */
  entry: LogEntry | null
  /** HP of every unit after this frame, keyed by unitKey. Clamped to [0, maxHp]. */
  hp: Record<string, number>
}

export interface Replay {
  units: ReplayUnit[]
  frames: ReplayFrame[]
  winner: Side
  mvpId: string
  turns: number
}

/**
 * Reconstructs an animatable HP timeline from a BattleResult.
 *
 * The engine pre-computes the whole fight as a log; this turns that log into a
 * sequence of full HP snapshots the UI can step through. Units are keyed by
 * `side:id` so the same wizard appearing on both teams never collides.
 *
 * maxHp is recomputed from the teams + synergies (mirroring simulateBattle) so
 * post-synergy HP pools line up exactly with what the engine simulated.
 */
export function buildReplay(
  result: BattleResult,
  left: DraftedWizard[],
  right: DraftedWizard[],
  opts: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[] } = {},
): Replay {
  const L = toBattleUnits(left, 'left', opts.leftSyn ?? [])
  const R = toBattleUnits(right, 'right', opts.rightSyn ?? [])

  const units: ReplayUnit[] = [...L, ...R].map(u => ({
    key: unitKey(u.side, u.wizard.id),
    side: u.side,
    id: u.wizard.id,
    name: u.wizard.name,
    house: u.wizard.house,
    role: u.wizard.role,
    maxHp: u.maxHp,
  }))
  const maxHp: Record<string, number> = {}
  for (const u of units) maxHp[u.key] = u.maxHp

  const hp: Record<string, number> = {}
  for (const u of units) hp[u.key] = u.maxHp

  const frames: ReplayFrame[] = [{ index: 0, entry: null, hp: { ...hp } }]

  result.log.forEach((entry, i) => {
    const value = entry.value
    if (typeof value === 'number' && value > 0 && entry.targetId && entry.targetSide) {
      const key = unitKey(entry.targetSide, entry.targetId)
      if (key in hp) {
        const cap = maxHp[key] ?? Infinity
        const healed = entry.flags.includes('heal')
        const next = healed ? hp[key]! + value : hp[key]! - value
        hp[key] = Math.max(0, Math.min(cap, next))
      }
    }
    frames.push({ index: i + 1, entry, hp: { ...hp } })
  })

  return { units, frames, winner: result.winner, mvpId: result.mvpId, turns: result.turns }
}
