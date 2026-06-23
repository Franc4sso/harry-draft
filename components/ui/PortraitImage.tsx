'use client'
import { useState } from 'react'
import type { House } from '@/types'
import { houseTheme } from '@/lib/theme'

export function PortraitImage({
  id, house, alt, variant = 'card',
}: { id: string; house: House; alt: string; variant?: 'card' | 'bust' }) {
  const [failed, setFailed] = useState(false)
  const fit = variant === 'bust' ? 'object-[50%_14%]' : 'object-[50%_18%]'

  if (failed) {
    const theme = houseTheme(house)
    return (
      <div
        data-fallback={house}
        data-variant={variant}
        aria-label={alt}
        className="h-full w-full"
        style={{ background: `radial-gradient(ellipse at 50% 25%, ${theme.color} 0%, #0c0a16 70%)` }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full opacity-40">
          <circle cx="12" cy="8" r="4" fill={theme.glow} />
          <path d="M4 22c0-5 4-8 8-8s8 3 8 8z" fill={theme.glow} />
        </svg>
      </div>
    )
  }
  return (
    <img
      src={`/portraits/${id}.webp`}
      alt={alt}
      data-variant={variant}
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${fit}`}
    />
  )
}
