'use client'
import type { ReactNode } from 'react'
import type { House } from '@/types'
import { houseTheme, cn } from '@/lib/theme'

/**
 * A house-coloured inner frame: a thin border tinted to the wizard's house plus
 * a soft inner glow, so the house reads from the card's edge instead of a text
 * pill. Sits INSIDE the rarity frame (rarity = outer treatment, house = inner
 * accent), keeping the two signals visually distinct. Carries `data-house` for
 * testing/accessibility.
 */
export function HouseFrame({
  house, className, children,
}: { house: House; className?: string; children: ReactNode }) {
  const theme = houseTheme(house)
  return (
    <div
      data-house={house}
      className={cn('relative rounded-xl', className)}
      style={{
        // Inner house-tinted hairline + soft inward glow of the house colour.
        boxShadow: `inset 0 0 0 1.5px ${theme.color}, inset 0 0 18px ${theme.glow}33`,
      }}
    >
      {children}
    </div>
  )
}
