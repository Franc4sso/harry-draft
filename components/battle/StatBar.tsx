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
    <div data-stat={label} data-buff={buff} className="flex items-center gap-1 w-full">
      <Icon size={11} aria-hidden className="shrink-0 text-white/50" />
      <span className="w-7 shrink-0 text-[9px] uppercase tracking-wide text-white/40">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <span data-role="fill" className={cn('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums', valueColor)}>{value}</span>
      {buff !== 'none' && <span aria-hidden className={cn('text-[8px]', valueColor)}>{buff === 'up' ? '▲' : '▼'}</span>}
    </div>
  )
}
