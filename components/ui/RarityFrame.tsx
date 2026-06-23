import type { ReactNode } from 'react'
import type { Tier } from '@/types'
import { rarityStyle } from '@/lib/rarity'
import { cn } from '@/lib/cn'

export function RarityFrame({
  tier, selected, className, children,
}: { tier: Tier; selected?: boolean; className?: string; children: ReactNode }) {
  const r = rarityStyle(tier)
  const baseGlow = r.glow > 0
    ? `0 0 ${10 + r.glow * 26}px ${r.color}${Math.round(r.glow * 90).toString(16).padStart(2, '0')}`
    : '0 8px 30px rgba(0,0,0,0.5)'
  const boxShadow = selected ? `${baseGlow}, 0 0 0 2px rgba(255,255,255,0.85)` : baseGlow
  return (
    <div
      data-rarity={r.label}
      className={cn('relative rounded-2xl overflow-hidden', r.animated && 'resa-animated', className)}
      style={{
        background: r.bgGradient,
        border: `${tier === 1 ? 2 : 1}px solid ${r.borderColor}`,
        boxShadow,
      }}
    >
      {r.hasCrown && (
        <span data-crown className={cn('absolute top-2 left-3 z-10 text-sm', r.animated && 'resa-animated')}
          style={{ filter: 'drop-shadow(0 0 6px #f3e6a0cc)' }}>👑</span>
      )}
      {r.hasGem && (
        <span data-gem className="absolute top-3 right-3 z-10 block h-3 w-3 rotate-45 rounded-[3px]"
          style={{ background: r.color, boxShadow: `0 0 10px ${r.color}` }} />
      )}
      {children}
    </div>
  )
}
