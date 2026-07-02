'use client'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Decorative, non-interactive arena backdrop: a slow drifting magical glow.
 * Transform/opacity only; static under reduced motion. Sits behind the busts.
 */
export function ArenaBackdrop() {
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
      {/* floor fade + vignette for depth */}
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.5))' }} />
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 130px rgba(0,0,0,0.72)' }} />
    </div>
  )
}
