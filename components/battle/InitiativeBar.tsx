'use client'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import type { Replay } from '@/game/engine/combat/replay'
import { lastRealActorAt } from '@/lib/initiative'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { houseTheme, cn } from '@/lib/theme'

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
      className="flex items-end gap-2 overflow-x-auto w-full max-w-lg px-1 py-2"
    >
      <span className="text-[10px] uppercase tracking-widest text-white/35 shrink-0 self-center pb-3">
        Ordine
      </span>
      {sequence.map((key, i) => {
        const u = byKey[key]
        if (!u) return null
        const isCurrent = key === current
        const theme = houseTheme(u.house)
        return (
          <motion.div
            key={`${key}-${i}`}
            data-current={isCurrent || undefined}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isCurrent ? 1 : 0.55, scale: isCurrent ? 1 : 0.85 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative shrink-0 flex flex-col items-center gap-0.5"
          >
            <span
              data-role="ora-label"
              className={cn(
                'text-[8px] uppercase tracking-widest leading-none h-2',
                isCurrent ? 'text-white/70' : 'text-transparent',
              )}
            >
              {isCurrent ? 'Ora' : ''}
            </span>
            <div
              className={cn(
                'grid place-items-center rounded-full border',
                isCurrent ? 'h-11 w-11 border-white/70' : 'h-8 w-8 border-white/15',
              )}
              style={{ background: theme.gradient, boxShadow: isCurrent ? theme.ring : undefined }}
            >
              <HouseCrest house={u.house} size={isCurrent ? 18 : 14} />
            </div>
            <span
              className={cn(
                'truncate text-center leading-none text-white/80',
                isCurrent ? 'text-[10px] max-w-[3rem]' : 'text-[9px] max-w-[2.75rem]',
              )}
            >
              {u.name}
            </span>
            <span className="flex items-center gap-0.5 text-[9px] tabular-nums text-white/55 leading-none">
              <Zap className="h-2.5 w-2.5 text-amber-300/80" aria-hidden />
              {u.spd}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
