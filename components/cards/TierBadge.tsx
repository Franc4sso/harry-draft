import type { Tier } from '@/types'
import { tierLabel, tierColor } from '@/lib/theme'

export function TierBadge({ tier }: { tier: Tier }) {
  const color = tierColor(tier)
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{ color, border: `1px solid ${color}55`, background: `${color}1a` }}
    >
      {tierLabel(tier)}
    </span>
  )
}
