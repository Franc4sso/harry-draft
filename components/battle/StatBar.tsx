'use client'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/theme'

const STAT_REF = 60 // reference max for the bar fill

/** One labeled stat with a proportional fill bar, tinted by buff direction. */
export function StatBar({
  label, value, base, color, icon: Icon,
}: {
  label: string
  value: number
  base: number
  color: string
  icon: LucideIcon
}) {
  const buff = value > base ? 'up' : value < base ? 'down' : 'none'
  const pct = Math.min(100, (value / STAT_REF) * 100)
  const valueColor = buff === 'up' ? 'text-emerald-300' : buff === 'down' ? 'text-rose-300' : 'text-white/85'
  return (
    <div data-stat={label} data-buff={buff} className="flex items-center gap-2 w-full">
      <Icon size={12} aria-hidden className="shrink-0 text-white/45" />
      <span className="w-8 shrink-0 text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-[#C9A24B]/15">
        <span data-role="fill" className={cn('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('w-7 shrink-0 text-right text-xs font-semibold tabular-nums', valueColor)}>{value}</span>
      {buff !== 'none' && <span aria-hidden className={cn('w-2 text-[9px]', valueColor)}>{buff === 'up' ? '▲' : '▼'}</span>}
    </div>
  )
}
