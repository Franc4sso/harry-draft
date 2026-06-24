import type { House } from '@/types'

const CREST: Record<House, { ring: string; fill: string; glyph: string }> = {
  Grifondoro: { ring: '#ae0001', fill: '#ffc500', glyph: 'M12 3l2.2 4.6L19 8l-3.5 3.4.9 4.9L12 14l-4.4 2.3.9-4.9L5 8l4.8-.4z' },
  Serpeverde: { ring: '#1a472a', fill: '#9fd6a8', glyph: 'M7 5c5 0 5 4 0 4s-5 4 0 4 6 3 6 3M9 5.2h.01' },
  Corvonero: { ring: '#222f5b', fill: '#7db7ff', glyph: 'M12 4l5 5-5 11-5-11z' },
  Tassorosso: { ring: '#ecb939', fill: '#372e29', glyph: 'M6 10c0-3 2.7-5 6-5s6 2 6 5-2.7 6-6 9c-3.3-3-6-6-6-9z' },
}

export function HouseCrest({ house, size = 18 }: { house: House; size?: number }) {
  const c = CREST[house]
  return (
    <svg
      role="img"
      aria-label={house}
      data-house={house}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ filter: `drop-shadow(0 0 4px ${c.ring}88)` }}
    >
      <path d={c.glyph} fill={c.fill} stroke={c.fill} strokeWidth="0.6" strokeLinejoin="round" fillRule="evenodd" />
    </svg>
  )
}
