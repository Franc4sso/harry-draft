'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { Frame } from '@/components/ui/Frame'
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
            className="group relative flex items-center gap-2"
            title={displayName(p)}
          >
            <Frame variant="round" className="h-9 w-9 shrink-0" innerClassName="flex items-center justify-center">
              <span
                className="flex h-full w-full items-center justify-center rounded-full text-sm font-bold text-black"
                style={{ background: theme.color }}
              >
                {p.wizard.name.charAt(0)}
              </span>
            </Frame>
            <span className="flex items-center gap-1 text-xs font-semibold text-white/90">
              <HouseCrest house={p.wizard.house} size={12} />{displayName(p)}
            </span>
          </motion.div>
        )
      })}
      {Array.from({ length: empties }).map((_, i) => (
        <div
          key={`empty-${i}`}
          data-empty
          className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/20 text-xs text-white/30"
        >
          ?
        </div>
      ))}
    </div>
  )
}
