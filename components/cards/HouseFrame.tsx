'use client'
import type { ReactNode } from 'react'
import type { House } from '@/types'
import { houseTheme, cn } from '@/lib/theme'

/**
 * The card's house frame: a solid border in the wizard's house colour wrapping
 * the whole card, plus a soft glow of the house colour. The house is the card's
 * ONLY border treatment — rarity is shown by the TierBadge tag, not the frame.
 * Carries `data-house` for testing/accessibility.
 */
export function HouseFrame({
  house, className, children,
}: { house: House; className?: string; children: ReactNode }) {
  const theme = houseTheme(house)
  return (
    <div
      data-house={house}
      className={cn('relative h-full rounded-2xl overflow-hidden', className)}
      style={{
        border: `2px solid ${theme.color}`,
        boxShadow: `0 0 14px ${theme.glow}40, inset 0 0 22px ${theme.color}22`,
      }}
    >
      {children}
    </div>
  )
}
