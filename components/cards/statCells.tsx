import { CARD_STAT_MAX } from './cardStats'

export const STAT_CELLS: Array<{ key: keyof typeof CARD_STAT_MAX; label: string; color: string }> = [
  { key: 'hp', label: 'HP', color: '#7CFC9B' },
  { key: 'atk', label: 'ATK', color: '#FF8A7A' },
  { key: 'def', label: 'DIF', color: '#7DB7FF' },
  { key: 'spd', label: 'VEL', color: '#FFD37D' },
]

export function StatCell({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const ratio = Math.min(1, max <= 0 ? 0 : value / max)
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 shrink-0 text-[8px] font-semibold uppercase tracking-wide text-white/40">{label}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/45">
        <span className="block h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </span>
      <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-white/80">{value}</span>
    </div>
  )
}
