import type { ReactNode } from 'react'
import type { Tier } from '@/types'
import { rarityStyle } from '@/lib/rarity'
import { cn } from '@/lib/cn'

/**
 * Neutral card container. Rarity is communicated by the TierBadge tag (top-right
 * of the card), NOT by the frame — so this paints no rarity-coloured border,
 * glow, or icons. The visible border belongs to the house frame inside. The only
 * treatment here is a soft drop shadow and, when selected, a white ring.
 * `data-rarity` is kept for styling hooks and tests.
 */
export function RarityFrame({
  tier, selected, className, children,
}: { tier: Tier; selected?: boolean; className?: string; children: ReactNode }) {
  const r = rarityStyle(tier)
  const base = '0 8px 30px rgba(0,0,0,0.5)'
  const boxShadow = selected ? `${base}, 0 0 0 2px rgba(255,255,255,0.85)` : base
  return (
    <div
      data-rarity={r.label}
      className={cn('relative rounded-2xl overflow-hidden', className)}
      style={{ background: '#0e0c16', boxShadow }}
    >
      {children}
    </div>
  )
}
