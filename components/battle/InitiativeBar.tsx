'use client'
import { motion } from 'framer-motion'
import type { Replay } from '@/game/engine/combat/replay'
import { initiativeAt } from '@/lib/initiative'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { houseTheme, cn } from '@/lib/theme'

/**
 * Speed-order rail: the unit acting now plus the upcoming queue, derived from
 * the replay action sequence. Makes "why the fast one strikes first" explicit.
 */
export function InitiativeBar({ replay, index }: { replay: Replay; index: number }) {
  const { current, upcoming } = initiativeAt(replay, index)
  const byKey = Object.fromEntries(replay.units.map(u => [u.key, u]))
  const sequence = [current, ...upcoming].filter((k): k is string => !!k)

  return (
    <div
      data-testid="initiative-bar"
      className="flex items-center gap-2 overflow-x-auto w-full max-w-lg px-1 py-2"
    >
      <span className="text-[10px] uppercase tracking-widest text-white/35 shrink-0">Turno</span>
      {sequence.map((key, i) => {
        const u = byKey[key]
        if (!u) return null
        const isCurrent = i === 0
        const theme = houseTheme(u.house)
        return (
          <motion.div
            key={`${key}-${i}`}
            data-current={isCurrent || undefined}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isCurrent ? 1 : 0.55, scale: isCurrent ? 1 : 0.85 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className={cn(
              'relative shrink-0 grid place-items-center rounded-full border',
              isCurrent ? 'h-11 w-11 border-white/70' : 'h-8 w-8 border-white/15',
            )}
            style={{ background: theme.gradient, boxShadow: isCurrent ? theme.ring : undefined }}
            title={u.name}
          >
            <HouseCrest house={u.house} size={isCurrent ? 18 : 14} />
          </motion.div>
        )
      })}
    </div>
  )
}
