'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { houseTheme } from '@/lib/theme'
import { displayName } from '@/lib/displayName'

export function SquadPanel({
  picks, teamSize, layout = 'row',
}: {
  picks: DraftedWizard[]
  teamSize: number
  layout?: 'row' | 'column'
}) {
  const reduce = useReducedMotion()
  const empties = Math.max(0, teamSize - picks.length)
  const wrap = layout === 'column' ? 'flex flex-col gap-2' : 'flex flex-row flex-wrap gap-2'
  return (
    <div className={wrap}>
      {picks.map((p) => {
        const theme = houseTheme(p.wizard.house)
        return (
          <motion.div
            key={p.wizard.id}
            initial={reduce ? false : { opacity: 0, scale: 0.6, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1.5 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)]"
            style={{ borderColor: `${theme.color}55` }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-black" style={{ background: theme.color }}>
              {p.wizard.name.charAt(0)}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-white/90">
              <HouseCrest house={p.wizard.house} size={12} />{displayName(p)}
            </span>
          </motion.div>
        )
      })}
      {Array.from({ length: empties }).map((_, i) => (
        <div key={`empty-${i}`} data-empty className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 p-1.5 opacity-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-xs text-white/40">?</span>
          <span className="text-xs text-white/40">vuoto</span>
        </div>
      ))}
    </div>
  )
}
