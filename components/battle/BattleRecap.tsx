'use client'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { recapTotals } from '@/lib/battleRecap'

/**
 * Live damage/heal recap for one team. Bars are scaled to the team's current
 * max combined total so the leader's bar is full and the rest are relative.
 * Pass a sliced `frames` for the running (partial) totals during replay.
 */
export function BattleRecap({
  frames, units, side = 'left',
}: {
  frames: ReplayFrame[]
  units: ReplayUnit[]
  side?: 'left' | 'right'
}) {
  const rows = recapTotals(frames, units, side)
  const max = Math.max(1, ...rows.map(r => r.dealt + r.healed))

  return (
    <div data-testid="battle-recap" className="glass rounded-2xl p-3 w-full max-w-md">
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/50">Resoconto squadra</p>
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
}
