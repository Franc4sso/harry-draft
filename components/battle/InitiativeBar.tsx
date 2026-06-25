'use client'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import type { Replay } from '@/game/engine/combat/replay'
import { lastRealActorAt } from '@/lib/initiative'
import { houseTheme, cn } from '@/lib/theme'
import { PortraitImage } from '@/components/ui/PortraitImage'

/**
 * Speed-order rail: the STABLE ordered list of currently-alive units, sorted by
 * (buffed) spd descending. Makes "why the fast one strikes first" explicit —
 * each slot shows the crest, the unit name, and its spd. The unit whose action
 * is "now" is highlighted IN PLACE (kept in speed order, labelled "Ora").
 *
 * The order is derived from the frame's HP (alive = hp > 0), not from the
 * action sequence, so it never blanks on system frames. The highlight follows
 * the last REAL action (most recent non-system, actor-bearing entry) and
 * persists through subsequent system frames — no flicker.
 */
export function InitiativeBar({ replay, index }: { replay: Replay; index: number }) {
  const frame = replay.frames[index] ?? replay.frames[replay.frames.length - 1]
  const hp = frame?.hp ?? {}
  const current = lastRealActorAt(replay, index)

  // Stable rail: alive units sorted by spd desc, stable tiebreak by original order.
  const sequence = replay.units
    .map((u, i) => ({ u, i }))
    .filter(({ u }) => (hp[u.key] ?? u.maxHp) > 0)
    .sort((a, b) => b.u.spd - a.u.spd || a.i - b.i)
    .map(({ u }) => u.key)
  const byKey = Object.fromEntries(replay.units.map(u => [u.key, u]))

  return (
    <div
      data-testid="initiative-bar"
      className="flex flex-col items-stretch gap-1.5 w-20 max-h-[34rem] overflow-y-auto py-2"
    >
      <span className="text-[10px] uppercase tracking-widest text-white/35 text-center">Ordine</span>
      {sequence.map((key, i) => {
        const u = byKey[key]
        if (!u) return null
        const isCurrent = key === current
        const mine = u.side === 'left'
        const ring = mine ? 'ring-emerald-400/70' : 'ring-rose-400/70'
        return (
          <motion.div
            key={`${key}-${i}`}
            data-current={isCurrent || undefined}
            data-side={u.side}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isCurrent ? 1 : 0.6, scale: isCurrent ? 1.05 : 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative flex items-center gap-1.5 rounded-lg px-1 py-0.5"
          >
            <div className={cn('relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2', ring, isCurrent && 'ring-4')}>
              <PortraitImage id={u.id} house={u.house} alt={u.name} variant="bust" />
            </div>
            <div className="min-w-0 flex-1 leading-none">
              <div className="flex items-center gap-1">
                <span aria-hidden className={cn('text-[8px]', mine ? 'text-emerald-300' : 'text-rose-300')}>{mine ? '▲' : '▼'}</span>
                <span className="truncate text-[10px] text-white/85">{u.name}</span>
              </div>
              <span className="mt-0.5 flex items-center gap-0.5 text-[9px] tabular-nums text-white/55">
                <Zap className="h-2.5 w-2.5 text-amber-300/80" aria-hidden />{u.spd}
              </span>
            </div>
            {isCurrent && (
              <span data-role="ora-label" className="absolute -top-1 right-1 rounded bg-white/15 px-1 text-[7px] uppercase tracking-widest text-white/80">Ora</span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
