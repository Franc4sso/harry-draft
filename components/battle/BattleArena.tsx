'use client'
import type { LogEntry } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { UnitBust } from './UnitBust'
import { SpellFx, ShieldFx } from './SpellFx'
import { floatFor } from './damageFloat'
import { describeEntry } from './BattleLog'
import { statusesAt } from '@/lib/battleStatus'
import { archetypeFor } from '@/lib/spellArchetype'

/**
 * Staged battlefield: player's busts on the left, enemies on the right, the
 * spell-effect layer between them, and the Protego dome over a blocking
 * defender. Statuses are derived per frame; HP comes from the current frame.
 */
export function BattleArena({
  replay, hp, entry, frameKey = 0, leftTitle = 'La tua squadra', rightTitle = 'Avversari',
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  frameKey?: number
  leftTitle?: string
  rightTitle?: string
}) {
  const actingKey = entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
  const targetKey = entry?.targetSide && entry.targetId ? unitKey(entry.targetSide, entry.targetId) : null
  const float = floatFor(entry)
  const statuses = statusesAt(replay, frameKey)
  const blocked = !!entry && (entry.flags.includes('block') || archetypeFor(entry) === 'shield')

  const left = replay.units.filter(u => u.side === 'left')
  const right = replay.units.filter(u => u.side === 'right')
  const actorMirrored = entry?.actorSide === 'right'

  const renderSide = (units: ReplayUnit[], mirrored: boolean) =>
    units.map(u => (
      <div key={u.key} className="relative">
        <UnitBust
          unit={u}
          hp={hp[u.key] ?? 0}
          acting={u.key === actingKey}
          targeted={u.key === targetKey}
          mirrored={mirrored}
          float={u.key === targetKey ? float : null}
          floatKey={frameKey}
          statuses={statuses[u.key] ?? []}
        />
        {u.key === targetKey && <ShieldFx active={blocked} fxKey={frameKey} />}
      </div>
    ))

  return (
    <div data-testid="battle-arena" className="relative flex items-start justify-center gap-4 sm:gap-10 w-full">
      <section className="flex flex-col items-center gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
      </section>

      <div className="self-center font-display text-2xl text-white/30 select-none">VS</div>

      <section className="flex flex-col items-center gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">{renderSide(right, true)}</div>
      </section>

      {!blocked && <SpellFx entry={entry} fromMirrored={actorMirrored} fxKey={frameKey} />}
    </div>
  )
}

/** One-line synced narration anchoring the animation in text. */
export function ActionBanner({ entry, units }: { entry: LogEntry | null; units: ReplayUnit[] }) {
  const names: Record<string, string> = {}
  for (const u of units) names[u.key] = u.name
  return (
    <div
      data-testid="action-banner"
      className="glass rounded-full px-4 py-1.5 text-sm text-white/80 min-h-[2rem] grid place-items-center"
    >
      {entry ? describeEntry(entry, names) : <span className="text-white/30">…</span>}
    </div>
  )
}
