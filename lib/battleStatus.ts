import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

export type BattleStatusToken = 'dot' | 'stun' | 'shield'

/** How many subsequent frames a hint persists. */
const WINDOW = 2

/**
 * Presentational status hints for each unit at a given frame, derived from the
 * log flags. NOT authoritative engine state — it never affects HP, it only
 * surfaces what the log already says so the icons aren't "buried in the log".
 */
export function statusesAt(replay: Replay, index: number): Record<string, BattleStatusToken[]> {
  // lastSeen[key][token] = frame index where the hint was last (re)applied.
  const lastSeen: Record<string, Partial<Record<BattleStatusToken, number>>> = {}
  const dead = new Set<string>()

  const mark = (key: string, token: BattleStatusToken, at: number) => {
    ;(lastSeen[key] ??= {})[token] = at
  }

  for (let i = 1; i <= index && i < replay.frames.length; i++) {
    const e = replay.frames[i]!.entry
    if (!e) continue
    const actor = e.actorSide ? unitKey(e.actorSide, e.actorId) : null
    const target = e.targetSide && e.targetId ? unitKey(e.targetSide, e.targetId) : null

    if (e.flags.includes('kill') && target) dead.add(target)
    if (e.action === 'KO' && target) dead.add(target)

    if (e.flags.includes('dot') && target) mark(target, 'dot', i)
    if ((e.flags.includes('stun') || e.action === 'Stordito') && (target ?? actor)) {
      mark((target ?? actor)!, 'stun', i)
    }
    if ((e.type === 'Difesa' || e.flags.includes('block')) && actor) mark(actor, 'shield', i)
  }

  const out: Record<string, BattleStatusToken[]> = {}
  for (const [key, tokens] of Object.entries(lastSeen)) {
    if (dead.has(key)) continue
    const active: BattleStatusToken[] = []
    for (const [token, at] of Object.entries(tokens) as Array<[BattleStatusToken, number]>) {
      if (index - at < WINDOW) active.push(token)
    }
    if (active.length) out[key] = active
  }
  return out
}
