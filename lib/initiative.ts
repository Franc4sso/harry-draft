import type { LogEntry } from '@/types'
import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

export interface InitiativeSlot {
  /** unitKey of the actor. */
  key: string
  turn: number
}

/**
 * The full ordered sequence of who acts, derived from the replay's already-
 * ordered frames. System frames (KO narration, poison ticks without an actor
 * side) are skipped — they aren't "someone taking their turn". This is a read-
 * only projection: no new turn-queue concept enters the combat engine.
 */
export function initiativeOrder(replay: Replay): InitiativeSlot[] {
  const out: InitiativeSlot[] = []
  for (const f of replay.frames) {
    const e = f.entry
    if (!e || e.type === 'system' || !e.actorSide) continue
    out.push({ key: unitKey(e.actorSide, e.actorId), turn: e.turn })
  }
  return out
}

/**
 * For the frame at `index` (the action index used by useBattleReplay, where 0
 * is the initial full-HP frame), returns the current actor and the next up-to-5
 * distinct upcoming actors. Frames whose entry is system/actorless contribute
 * no `current`.
 */
export function initiativeAt(
  replay: Replay,
  index: number,
): { current: string | null; upcoming: string[] } {
  const frame = replay.frames[index]
  const e = frame?.entry
  const current = e && e.type !== 'system' && e.actorSide ? unitKey(e.actorSide, e.actorId) : null

  const upcoming: string[] = []
  if (current) {
    for (let i = index + 1; i < replay.frames.length && upcoming.length < 5; i++) {
      const fe = replay.frames[i]!.entry
      if (!fe || fe.type === 'system' || !fe.actorSide) continue
      const key = unitKey(fe.actorSide, fe.actorId)
      if (!upcoming.includes(key)) upcoming.push(key)
    }
  }
  return { current, upcoming }
}

/**
 * The replay entry of the most recent REAL action (non-system, with an
 * actorSide) at or before `index`, scanning backwards. System frames (regen,
 * DoT, stun, KO narration) are skipped, so the result "sticks" through them.
 * Returns null before any real action has happened (e.g. the initial frame).
 */
export function lastRealEntryAt(replay: Replay, index: number): LogEntry | null {
  for (let i = Math.min(index, replay.frames.length - 1); i >= 0; i--) {
    const e = replay.frames[i]?.entry
    if (e && e.type !== 'system' && e.actorSide) return e
  }
  return null
}

/**
 * The unitKey of the actor of the most recent real action at or before
 * `index` (see {@link lastRealEntryAt}). This is the persistent "acting now"
 * highlight for the initiative bar: it holds across system frames until the
 * next real action. Returns null before any real action.
 */
export function lastRealActorAt(replay: Replay, index: number): string | null {
  const e = lastRealEntryAt(replay, index)
  return e && e.actorSide ? unitKey(e.actorSide, e.actorId) : null
}
