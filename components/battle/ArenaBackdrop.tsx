'use client'
import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Deterministic ember field (fixed values → no SSR/client hydration mismatch). Each rises
// slowly over 14–22s, drifting a touch sideways, at low opacity — ambient, never a flash.
const EMBERS = [
  { left: 8, size: 3, dur: 19, delay: 0, drift: 7, peak: 0.34 },
  { left: 17, size: 2, dur: 22, delay: 5, drift: -5, peak: 0.24 },
  { left: 24, size: 2, dur: 16, delay: 9, drift: 6, peak: 0.3 },
  { left: 33, size: 3, dur: 21, delay: 2, drift: -8, peak: 0.28 },
  { left: 41, size: 2, dur: 18, delay: 12, drift: 5, peak: 0.22 },
  { left: 49, size: 2, dur: 24, delay: 7, drift: 8, peak: 0.26 },
  { left: 57, size: 3, dur: 17, delay: 14, drift: -6, peak: 0.32 },
  { left: 65, size: 2, dur: 20, delay: 4, drift: 7, peak: 0.24 },
  { left: 72, size: 2, dur: 15, delay: 10, drift: -5, peak: 0.3 },
  { left: 80, size: 3, dur: 23, delay: 1, drift: 6, peak: 0.26 },
  { left: 88, size: 2, dur: 18, delay: 8, drift: -7, peak: 0.22 },
  { left: 94, size: 2, dur: 21, delay: 15, drift: 5, peak: 0.28 },
] as const

/**
 * Decorative, non-interactive arena backdrop: a slow drifting magical glow, a field of
 * rising embers and a low floor haze — ambient atmosphere, no flashing.
 * Transform/opacity only; static under reduced motion. Sits behind the busts.
 */
// Prop-less: memo makes it render exactly once and skip every parent re-render
// (the replay ticks re-render BattleScreen ~every frame; this ambient backdrop
// never needs to follow — its animations live in the compositor, not React).
export const ArenaBackdrop = memo(function ArenaBackdrop() {
  const reduce = useReducedMotion()
  return (
    <div
      data-testid="arena-backdrop"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
    >
      {/* deep dueling-hall gradient */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #241a12 0%, #17100a 55%, #0c0806 100%)' }} />
      {/* drifting arcane glow — warm on the left, arcane on the right */}
      <motion.div
        className="absolute inset-0 opacity-45"
        style={{ background: 'radial-gradient(50% 45% at 26% 32%, rgba(224,90,74,0.12), transparent 70%), radial-gradient(50% 45% at 74% 68%, rgba(124,58,237,0.15), transparent 72%)' }}
        animate={reduce ? {} : { opacity: [0.32, 0.52, 0.32], scale: [1, 1.04, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* slow floor haze — drifts a few percent side to side over ~26s */}
      <motion.div
        className="absolute inset-x-0 bottom-[7%] h-16"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(180,150,110,0.06) 42%, rgba(180,150,110,0.10) 55%, transparent)', filter: 'blur(9px)' }}
        animate={reduce ? {} : { x: ['-6%', '6%', '-6%'] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* rising ember field — slow, low-opacity, no flashing */}
      {EMBERS.map((e, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ left: `${e.left}%`, bottom: 0, width: e.size, height: e.size, background: '#f6c96a', boxShadow: '0 0 4px rgba(246,201,106,0.5)', filter: 'blur(0.4px)' }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={reduce ? {} : { y: -560, x: e.drift, opacity: [0, e.peak, e.peak, 0] }}
          transition={{ duration: e.dur, delay: e.delay, repeat: Infinity, ease: 'linear', times: [0, 0.15, 0.7, 1] }}
        />
      ))}
      {/* floor fade + vignette for depth */}
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.5))' }} />
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 130px rgba(0,0,0,0.72)' }} />
    </div>
  )
})
