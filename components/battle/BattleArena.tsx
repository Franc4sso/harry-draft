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
  // A lone enemy reads as a boss encounter → ominous treatment on that bust.
  const bossFight = right.length === 1
  const renderSide = (units: ReplayUnit[], mirrored: boolean, boss = false) =>
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
            boss={boss}
            compact={!boss}
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
    <div
      data-testid="battle-arena"
      className="relative mx-auto flex w-full max-w-6xl items-center justify-center rounded-3xl px-2 py-4"
      style={{ minHeight: 480 }}
    >
      <ArenaBackdrop />
      {/* Two teams as facing vertical columns (Slay-the-Spire style). Column & center
          widths are FIXED so the varying ActionPanel content never reflows the field. */}
      <div className="flex items-center justify-center gap-4 sm:gap-10">
        <section className="flex w-24 shrink-0 flex-col items-center gap-2 sm:w-28">
          <h3 className="max-w-full truncate text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
          <div data-testid="row-player" className="flex flex-col items-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
        </section>

        <div className="flex w-64 shrink-0 items-center justify-center self-center sm:w-80">
          {center ?? <span className="font-display text-2xl text-white/30 select-none">VS</span>}
        </div>

        <section className={`flex shrink-0 flex-col items-center gap-2 ${bossFight ? 'w-32 sm:w-40' : 'w-24 sm:w-28'}`}>
          <h3 className="max-w-full truncate text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
          <div data-testid="row-enemies" className="flex flex-col items-center gap-2 sm:gap-3">{renderSide(right, true, bossFight)}</div>
        </section>
      </div>

      <PixiArena entry={entry} frameKey={frameKey} speed={speed} />
      <Callout entry={entry} frameKey={frameKey} />
    </div>
  )
}
