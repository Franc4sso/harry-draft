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
      <motion.div
        className="absolute inset-0 opacity-40"
        style={{ background: 'radial-gradient(60% 50% at 50% 30%, rgba(124,58,237,0.18), transparent 70%), radial-gradient(50% 50% at 50% 80%, rgba(176,141,87,0.14), transparent 70%)' }}
        animate={reduce ? {} : { opacity: [0.3, 0.5, 0.3], scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
