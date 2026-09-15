'use client'
import { memo } from 'react'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { recapTotals } from '@/lib/battleRecap'
import { cn } from '@/lib/theme'

/**
 * Live damage/heal recap for one team. Bars scale to the team's current max
 * combined total. Pass a sliced `frames` for running totals during replay.
 * `tone` accents the panel for the player (ally) or the enemy team.
 *
 * Memoized: callers (BattleScreen) memoize `frames`/`units` per replay tick so
 * both the desktop and mobile layout copies share one stable reference and
 * this component only re-renders (and re-scans) once per tick, not per copy.
 */
export const BattleRecap = memo(function BattleRecap({
  frames, units, side = 'left', title = 'Resoconto squadra', tone = 'ally', compact = false, className,
}: {
  frames: ReplayFrame[]
  units: ReplayUnit[]
  side?: 'left' | 'right'
  title?: string
  tone?: 'ally' | 'enemy'
  /** Tighter padding/rows for the battle-screen bottom "damage bar" (task 10), where
   *  two of these sit side by side inside a fixed height budget. Same rows, same
   *  data, just less breathing room — the standalone use (still untouched) keeps
   *  the roomier default. */
  compact?: boolean
  className?: string
}) {
  const rows = recapTotals(frames, units, side)
  const max = Math.max(1, ...rows.map(r => r.dealt + r.healed))
  const accent = tone === 'enemy' ? 'border-rose-400/30' : 'border-emerald-400/30'
  const dot = tone === 'enemy' ? 'text-rose-300/80' : 'text-emerald-300/80'

  return (
    <div
      data-testid="battle-recap"
      data-tone={tone}
      className={cn('rounded-2xl border bg-[rgba(20,16,33,0.55)] w-full max-w-md backdrop-blur-sm', accent, compact ? 'p-1.5' : 'p-3', className)}
    >
      <p className={cn('flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]', dot, compact ? 'mb-0.5' : 'mb-2')}>
        <span aria-hidden>◆</span>{title}
      </p>
      <ul className={compact ? 'space-y-0' : 'space-y-1.5'}>
        {rows.map((r) => (
          <li key={r.key} data-testid="battle-recap-row" className={cn('flex items-center gap-2', compact ? 'text-[10px] leading-tight' : 'text-[11px]')}>
            <span className="w-20 truncate text-white/80">{r.name}</span>
            <span className={cn('flex-1 flex overflow-hidden rounded-full bg-white/10', compact ? 'h-1.5' : 'h-2')}>
              <span className="h-full bg-rose-400/80" style={{ width: `${(r.dealt / max) * 100}%` }} />
              <span className="h-full bg-emerald-400/80" style={{ width: `${(r.healed / max) * 100}%` }} />
            </span>
            <span className="w-16 text-right tabular-nums text-white/55">
              <span className="text-rose-300">{r.dealt}</span>
              {r.healed > 0 && <span className="text-emerald-300"> +{r.healed}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
})
