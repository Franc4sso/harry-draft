import type {
  ActiveEffect, ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, House, LogEntry, Role, Side, Stats, Tier,
} from '@/types'
import { toBattleUnits } from './simulate'
import { statsWithMods } from '../status'
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
  /** EFFECTIVE speed per unit after this frame (base buffed spd + active status spd
   *  mods), keyed by unitKey. The InitiativeBar sorts by THIS so the order reflects
   *  mid-combat spd buffs/debuffs, not the static start-of-battle value. Optional so
   *  legacy / hand-built frames stay valid (the UI falls back to the static unit spd). */
  spd?: Record<string, number>
}

export interface Replay {
  units: ReplayUnit[]
  frames: ReplayFrame[]
  winner: Side
  mvpId: string
  turns: number
}

/**
 * Primo scatto di ogni Duo in questa battaglia: `duoId` -> indice del PRIMO frame che lo marchia.
 *
 * Pura e derivata dai soli frame (non da un ref o da uno stato di riproduzione): riavvolgere,
 * rigiocare o saltare avanti nel replay dà sempre lo stesso esito. Serve a DUE consumatori che
 * devono per forza concordare, altrimenti il ritmo e l'annuncio si sfasano:
 *  - `BattleArena`, per mostrare l'annuncio centrale col nome del Duo UNA sola volta per battaglia;
 *  - `useBattleReplay` (`frameDelay`), per allungare la sosta SOLO su quel frame — gli scatti
 *    successivi tornano al loro ramo naturale (dot/system, cioè più brevi), altrimenti una build
 *    veleno con 10-15 tick amplificati aggiungerebbe una ventina di secondi di replay.
 */
export function firstDuoFireFrames(frames: ReplayFrame[]): Map<string, number> {
  const m = new Map<string, number>()
  frames.forEach((f, i) => {
    const id = f.entry?.duoId
    if (id && !m.has(id)) m.set(id, i)
  })
  return m
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

  // Base (start-of-battle, post-synergy/relic) stats per unit, so per-frame EFFECTIVE spd
  // can be re-derived from the frame's active statusEffects — mirrors effectiveStats.
  const baseStats: Record<string, Stats> = {}
  for (const u of units) baseStats[u.key] = { hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd }
  const spdFrom = (statusEffects: Record<string, ActiveEffect[]>): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const u of units) out[u.key] = statsWithMods(baseStats[u.key]!, statusEffects[u.key] ?? []).spd
    return out
  }

  const hp: Record<string, number> = {}
  for (const u of [...L, ...R]) hp[unitKey(u.side, u.wizard.id)] = u.hp

  // Index alignment: frames[k] corresponds to log[k-1]; the snapshot captured at that same
  // push is snapshots[k-1]. So frame k reads cooldowns/statusEffects from snapshots[k-1].
  // Frame 0 is the pre-combat state: empty cooldowns/statusEffects.
  // Guard: older/hand-built results may lack `snapshots` — default to empty maps so nothing crashes.
  const snapshots = result.snapshots ?? []
  const stateFrom = (i: number): Pick<ReplayFrame, 'cooldowns' | 'statusEffects' | 'spd'> => {
    const snap = snapshots[i]
    const cooldowns: Record<string, Record<string, number>> = {}
    const statusEffects: Record<string, ActiveEffect[]> = {}
    if (snap) {
      for (const [key, st] of Object.entries(snap)) {
        cooldowns[key] = { ...st.cooldowns }
        statusEffects[key] = st.statusEffects.map(e => ({ ...e }))
      }
    }
    return { cooldowns, statusEffects, spd: spdFrom(statusEffects) }
  }

  const frames: ReplayFrame[] = [{ index: 0, entry: null, hp: { ...hp }, cooldowns: {}, statusEffects: {}, spd: spdFrom({}) }]

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
