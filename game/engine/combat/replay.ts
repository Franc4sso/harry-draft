import type {
  ActiveEffect, ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, House, LogEntry, Role, Side, Tier,
} from '@/types'
import { toBattleUnits } from './simulate'
import { displayName } from '@/lib/displayName'

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
  tier: Tier
  maxHp: number
  atk: number
  def: number
  spd: number
  baseAtk: number
  baseDef: number
  baseSpd: number
  /** Run-progression level (player wizards). Enemies default to 1; the UI shows
   *  a derived enemy level instead. Optional so lightweight test fixtures stay terse. */
  level?: number
  /** The wizard's primary (equipped) spell — what the cooldown row displays. */
  spell: { id: string; name: string; cooldown: number }
}

export interface ReplayFrame {
  /** 0 = initial state (full HP, no action yet); 1..N after each log entry. */
  index: number
  /** The log entry that produced this frame, or null for the initial frame. */
  entry: LogEntry | null
  /** HP of every unit after this frame, keyed by unitKey. Clamped to [0, maxHp]. */
  hp: Record<string, number>
  /** Cooldowns per unit after this frame: unitKey -> (spellId -> turns remaining). */
  cooldowns: Record<string, Record<string, number>>
  /** Active status effects per unit after this frame: unitKey -> effects. */
  statusEffects: Record<string, ActiveEffect[]>
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
 * maxHp is recomputed from the teams + synergies + relics (mirroring simulateBattle) so
 * post-synergy/relic HP pools line up exactly with what the engine simulated.
 */
export function buildReplay(
  result: BattleResult,
  left: DraftedWizard[],
  right: DraftedWizard[],
  opts: {
    leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[]; leftRelics?: ActiveRelic[]
    rightRelics?: ActiveRelic[]; rightMenace?: number; rightDamageReduction?: number; rightIgnoresTaunt?: boolean
  } = {},
): Replay {
  // Mirrors simulateBattle's toBattleUnits calls exactly (see simulate.ts) so the replay's
  // buffedStats — what InitiativeBar sorts by — match what the sim actually used to order
  // turns. Without this, an un-menaced right side can display a lower spd than the sim's
  // menaced spd, making the real (correct) turn order look like a bug.
  const L = toBattleUnits(left, 'left', opts.leftSyn ?? [], opts.leftRelics ?? [])
  const R = toBattleUnits(
    right, 'right', opts.rightSyn ?? [], opts.rightRelics ?? [],
    opts.rightMenace ?? 0, opts.rightDamageReduction ?? 0, opts.rightIgnoresTaunt ?? false,
  )

  const units: ReplayUnit[] = [...L, ...R].map(u => ({
    key: unitKey(u.side, u.wizard.id),
    side: u.side,
    id: u.wizard.id,
    name: displayName(u),
    house: u.wizard.house,
    role: u.wizard.role,
    tier: u.wizard.tier,
    maxHp: u.maxHp,
    atk: u.buffedStats.atk,
    def: u.buffedStats.def,
    spd: u.buffedStats.spd,
    baseAtk: u.stats.atk,
    baseDef: u.stats.def,
    baseSpd: u.stats.spd,
    level: u.level ?? 1,
    spell: { id: u.spell.id, name: u.spell.name, cooldown: u.spell.cooldown ?? 0 },
  }))
  const maxHp: Record<string, number> = {}
  for (const u of units) maxHp[u.key] = u.maxHp

  const hp: Record<string, number> = {}
  for (const u of [...L, ...R]) hp[unitKey(u.side, u.wizard.id)] = u.hp

  // Index alignment: frames[k] corresponds to log[k-1]; the snapshot captured at that same
  // push is snapshots[k-1]. So frame k reads cooldowns/statusEffects from snapshots[k-1].
  // Frame 0 is the pre-combat state: empty cooldowns/statusEffects.
  // Guard: older/hand-built results may lack `snapshots` — default to empty maps so nothing crashes.
  const snapshots = result.snapshots ?? []
  const stateFrom = (i: number): Pick<ReplayFrame, 'cooldowns' | 'statusEffects'> => {
    const snap = snapshots[i]
    const cooldowns: Record<string, Record<string, number>> = {}
    const statusEffects: Record<string, ActiveEffect[]> = {}
    if (snap) {
      for (const [key, st] of Object.entries(snap)) {
        cooldowns[key] = { ...st.cooldowns }
        statusEffects[key] = st.statusEffects.map(e => ({ ...e }))
      }
    }
    return { cooldowns, statusEffects }
  }

  const frames: ReplayFrame[] = [{ index: 0, entry: null, hp: { ...hp }, cooldowns: {}, statusEffects: {} }]

  result.log.forEach((entry, i) => {
    const value = entry.value
    if (typeof value === 'number' && value > 0 && entry.targetId && entry.targetSide) {
      const key = unitKey(entry.targetSide, entry.targetId)
      if (key in hp) {
        const cap = maxHp[key] ?? Infinity
        // heal and revive both ADD HP (a revive raises the fallen back up); everything else subtracts.
        const restores = entry.flags.includes('heal') || entry.flags.includes('revive')
        const next = restores ? hp[key]! + value : hp[key]! - value
        hp[key] = Math.max(0, Math.min(cap, next))
      }
    }
    frames.push({ index: i + 1, entry, hp: { ...hp }, ...stateFrom(i) })
  })

  return { units, frames, winner: result.winner, mvpId: result.mvpId, turns: result.turns }
}
