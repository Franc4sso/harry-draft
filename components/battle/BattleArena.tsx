'use client'
import type React from 'react'
import type { LogEntry } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { UnitBust } from './UnitBust'
import { ArenaBackdrop } from './ArenaBackdrop'
import { PixiArena } from './PixiArena'
import { Callout } from './Callout'
import { floatFor } from './damageFloat'

/**
 * Staged battlefield: player's busts on top, enemies on the bottom, the
 * spell-effect layer between them, and the Protego dome over a blocking
 * defender. Statuses are derived per frame; HP comes from the current frame.
 */
export function BattleArena({
  replay, hp, entry, frameKey = 0, leftTitle = 'La tua squadra', rightTitle = 'Avversari', center, enemyLevel = 1, speed = 1,
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  frameKey?: number
  leftTitle?: string
  rightTitle?: string
  center?: React.ReactNode
  /** Level shown on every enemy bust (menace was removed 2026-07-01). Players use their own. */
  enemyLevel?: number
  /** Replay playback speed — feeds the Pixi VFX layer's time budget. */
  speed?: number
}) {
  const actingKey = entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
  const targetKey = entry?.targetSide && entry.targetId ? unitKey(entry.targetSide, entry.targetId) : null
  const float = floatFor(entry)
  const frame = replay.frames[frameKey]
  const statusEffects = frame?.statusEffects ?? {}
  const cooldowns = frame?.cooldowns ?? {}

  const left = replay.units.filter(u => u.side === 'left')
  const right = replay.units.filter(u => u.side === 'right')

  const anyAction = !!actingKey
  const renderSide = (units: ReplayUnit[], mirrored: boolean) =>
    units.map(u => {
      const involved = u.key === actingKey || u.key === targetKey
      return (
        <div key={u.key} className="relative transition-opacity duration-200" style={{ opacity: anyAction && !involved ? 0.45 : 1 }}>
          <UnitBust
            unit={u}
            hp={hp[u.key] ?? 0}
            acting={u.key === actingKey}
            targeted={u.key === targetKey}
            mirrored={mirrored}
            float={u.key === targetKey ? float : null}
            floatKey={frameKey}
            effects={statusEffects[u.key] ?? []}
            cooldown={cooldowns[u.key]?.[u.spell.id] ?? 0}
            level={u.side === 'right' ? enemyLevel : u.level}
          />
        </div>
      )
    })

  return (
    <div data-testid="battle-arena" className="relative flex flex-col items-center gap-4 w-full">
      <ArenaBackdrop />
      <section className="flex flex-col items-center gap-2 w-full">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
        <div data-testid="row-player" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
      </section>

      <div className="self-center min-h-[1.5rem] w-full flex items-center justify-center">
        {center ?? <span className="font-display text-2xl text-white/30 select-none">VS</span>}
      </div>

      <section className="flex flex-col items-center gap-2 w-full">
        <div data-testid="row-enemies" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(right, true)}</div>
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
      </section>

      <PixiArena entry={entry} frameKey={frameKey} speed={speed} />
      <Callout entry={entry} frameKey={frameKey} />
    </div>
  )
}
