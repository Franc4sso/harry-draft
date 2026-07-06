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
  frames, units, side = 'left', title = 'Resoconto squadra', tone = 'ally',
}: {
  frames: ReplayFrame[]
  units: ReplayUnit[]
  side?: 'left' | 'right'
  title?: string
  tone?: 'ally' | 'enemy'
}) {
  const rows = recapTotals(frames, units, side)
  const max = Math.max(1, ...rows.map(r => r.dealt + r.healed))
  const accent = tone === 'enemy' ? 'border-rose-400/30' : 'border-emerald-400/30'
  const dot = tone === 'enemy' ? 'text-rose-300/80' : 'text-emerald-300/80'

  return (
    <div
      data-testid="battle-recap"
      data-tone={tone}
      className={cn('rounded-2xl border bg-[rgba(20,16,33,0.55)] p-3 w-full max-w-md backdrop-blur-sm', accent)}
    >
      <p className={cn('mb-2 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]', dot)}>
        <span aria-hidden>◆</span>{title}
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} data-testid="battle-recap-row" className="flex items-center gap-2 text-[11px]">
            <span className="w-20 truncate text-white/80">{r.name}</span>
            <span className="flex-1 flex h-2 overflow-hidden rounded-full bg-white/10">
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
