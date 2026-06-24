'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import type { LogEntry } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { UnitBust } from './UnitBust'
import { SpellFx, ShieldFx, type FxPoint } from './SpellFx'
import { floatFor } from './damageFloat'
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

  // Measure the real on-screen caster/target busts so the projectile flies between
  // their actual positions (not fixed arena percentages). Read layout AFTER the busts
  // lay out for this frame: useLayoutEffect keyed on the frame + caster/target.
  const arenaRef = useRef<HTMLDivElement>(null)
  const [fx, setFx] = useState<{ from: FxPoint; to: FxPoint } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const arena = arenaRef.current
      if (!arena || !actingKey || !targetKey) { setFx(null); return }
      const casterEl = arena.querySelector(`[data-unit-key="${CSS.escape(actingKey)}"]`)
      const targetEl = arena.querySelector(`[data-unit-key="${CSS.escape(targetKey)}"]`)
      if (!casterEl || !targetEl) { setFx(null); return }
      const arenaRect = arena.getBoundingClientRect()
      if (arenaRect.width === 0 || arenaRect.height === 0) { setFx(null); return }
      const center = (el: Element): FxPoint => {
        const r = el.getBoundingClientRect()
        return {
          x: ((r.left + r.width / 2 - arenaRect.left) / arenaRect.width) * 100,
          y: ((r.top + r.height / 2 - arenaRect.top) / arenaRect.height) * 100,
        }
      }
      setFx({ from: center(casterEl), to: center(targetEl) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [frameKey, actingKey, targetKey])

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
    <div ref={arenaRef} data-testid="battle-arena" className="relative flex items-start justify-center gap-4 sm:gap-10 w-full">
      <section className="flex flex-col items-center gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
      </section>

      <div className="self-center font-display text-2xl text-white/30 select-none">VS</div>

      <section className="flex flex-col items-center gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">{renderSide(right, true)}</div>
      </section>

      {!blocked && <SpellFx entry={entry} from={fx?.from} to={fx?.to} fxKey={frameKey} />}
    </div>
  )
}
