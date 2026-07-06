'use client'
import { memo } from 'react'

// Deterministic ember field (fixed values → no SSR/client hydration mismatch). Rendered as a
// STATIC scatter of faint motes (no rising animation): the arena atmosphere reads the same at a
// glance, but nothing repaints per frame behind the combat. Each mote sits at a fixed height/
// opacity picked from its former mid-rise state so the field still looks alive, not empty.
const EMBERS = [
  { left: 8, size: 3, bottom: 22, peak: 0.34 },
  { left: 17, size: 2, bottom: 48, peak: 0.24 },
  { left: 24, size: 2, bottom: 12, peak: 0.3 },
  { left: 33, size: 3, bottom: 63, peak: 0.28 },
  { left: 41, size: 2, bottom: 30, peak: 0.22 },
  { left: 49, size: 2, bottom: 55, peak: 0.26 },
  { left: 57, size: 3, bottom: 18, peak: 0.32 },
  { left: 65, size: 2, bottom: 42, peak: 0.24 },
  { left: 72, size: 2, bottom: 70, peak: 0.3 },
  { left: 80, size: 3, bottom: 34, peak: 0.26 },
  { left: 88, size: 2, bottom: 58, peak: 0.22 },
  { left: 94, size: 2, bottom: 26, peak: 0.28 },
] as const

/**
 * Decorative, non-interactive arena backdrop: a deep dueling-hall gradient, a warm/arcane glow,
 * a faint static ember scatter, a floor haze and a vignette — ambient atmosphere, no flashing.
 *
 * STATIC by design (perf): the replay reveals a new frame only a few times per second, but the
 * former version ran ~15 infinite framer-motion loops (glow scale/opacity, a blur(9px) drifting
 * haze, 12 rising embers) that repainted the whole arena EVERY compositor frame — and each unit's
 * `backdrop-blur` card re-sampled that moving field on top. Freezing it keeps the exact look while
 * the GPU only paints when an actual attack VFX plays. Attack VFX (SpellFx / UnitBust impact)
 * are untouched — they mount on cast and animate as before. Mirrors the GameShell/MapScreen static
 * background pass.
 */
// Prop-less: memo makes it render exactly once and skip every parent re-render (the replay ticks
// re-render BattleScreen; this ambient backdrop never needs to follow).
export const ArenaBackdrop = memo(function ArenaBackdrop() {
  return (
    <div
      data-testid="arena-backdrop"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
    >
      {/* deep dueling-hall gradient */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #241a12 0%, #17100a 55%, #0c0806 100%)' }} />
      {/* warm/arcane glow — warm on the left, arcane on the right (static, mid-brightness) */}
      <div
        className="absolute inset-0 opacity-45"
        style={{ background: 'radial-gradient(50% 45% at 26% 32%, rgba(224,90,74,0.12), transparent 70%), radial-gradient(50% 45% at 74% 68%, rgba(124,58,237,0.15), transparent 72%)' }}
      />
      {/* floor haze — static (no blur filter, no drift) */}
      <div
        className="absolute inset-x-0 bottom-[7%] h-16"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(180,150,110,0.06) 42%, rgba(180,150,110,0.10) 55%, transparent)' }}
      />
      {/* static ember scatter — faint motes at fixed positions, no animation */}
      {EMBERS.map((e, i) => (
        <div
          key={i}
          data-ember
          className="absolute rounded-full"
          style={{ left: `${e.left}%`, bottom: `${e.bottom}%`, width: e.size, height: e.size, background: '#f6c96a', opacity: e.peak, boxShadow: '0 0 4px rgba(246,201,106,0.5)' }}
        />
      ))}
      {/* floor fade + vignette for depth */}
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.5))' }} />
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 130px rgba(0,0,0,0.72)' }} />
    </div>
  )
})
