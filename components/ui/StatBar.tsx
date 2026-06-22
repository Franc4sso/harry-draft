interface StatBarProps {
  label: string
  value: number
  max: number
  color?: string
}

export function StatBar({ label, value, max, color = '#7dd3fc' }: StatBarProps) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max))
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-9 text-white/60 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div data-fill className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <span className="w-8 text-right tabular-nums text-white/80">{value}</span>
    </div>
  )
}
