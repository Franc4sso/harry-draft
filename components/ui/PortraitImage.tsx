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
        className="relative h-full w-full overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${theme.color}40 0%, #0c0a16 78%)` }}
      >
        {/* Stylised shoulders-up bust silhouette in the house colour. */}
        <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[88%] w-full">
          <defs>
            <linearGradient id={`sil-${house}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.glow} stopOpacity="0.55" />
              <stop offset="100%" stopColor={theme.color} stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="7.5" r="3.6" fill={`url(#sil-${house})`} />
          <path d="M4.5 24c0-5.2 3.4-8.2 7.5-8.2s7.5 3 7.5 8.2z" fill={`url(#sil-${house})`} />
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
      loading="lazy"
      decoding="async"
      width={512}
      height={512}
    />
  )
}
