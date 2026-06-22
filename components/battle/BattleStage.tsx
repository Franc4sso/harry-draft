'use client'
import type { LogEntry } from '@/types'
import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { BattleUnit } from './BattleUnit'

/**
 * Presentational battlefield: the player's team on the left, enemies on the
 * right, HP driven by the current replay frame. The acting/targeted units are
 * highlighted from the current log entry.
 */
export function BattleStage({
  replay, hp, entry, leftTitle = 'La tua squadra', rightTitle = 'Avversari',
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  leftTitle?: string
  rightTitle?: string
}) {
  const actingKey = entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
  const targetKey = entry?.targetSide && entry.targetId ? unitKey(entry.targetSide, entry.targetId) : null

  const left = replay.units.filter(u => u.side === 'left')
  const right = replay.units.filter(u => u.side === 'right')

  return (
    <div className="flex items-start justify-center gap-6 sm:gap-12 w-full">
      <section className="flex flex-col items-end gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
        {left.map(u => (
          <BattleUnit
            key={u.key}
            unit={u}
            hp={hp[u.key] ?? 0}
            acting={u.key === actingKey}
            targeted={u.key === targetKey}
          />
        ))}
      </section>

      <div className="self-center font-display text-2xl text-white/30 select-none">VS</div>

      <section className="flex flex-col items-start gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
        {right.map(u => (
          <BattleUnit
            key={u.key}
            unit={u}
            hp={hp[u.key] ?? 0}
            acting={u.key === actingKey}
            targeted={u.key === targetKey}
            mirrored
          />
        ))}
      </section>
    </div>
  )
}
