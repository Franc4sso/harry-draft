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
