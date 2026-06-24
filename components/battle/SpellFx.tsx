'use client'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import { archetypeFor, archetypeStyle } from '@/lib/spellArchetype'

/**
 * The travelling-spell effect: a projectile crosses caster→target. Phases
 * (charge→cast→flight→impact) are compressed into one motion timeline so it
 * stays cheap on mobile (transform/opacity only). Heal (handled by the float),
 * shield (ShieldFx), and system entries render nothing here.
 */
/** A point on the arena, expressed as a percentage (0–100) of the arena box. */
export type FxPoint = { x: number; y: number }

export function SpellFx({
  entry, from, to, fxKey,
}: { entry: LogEntry | null; from?: FxPoint | null; to?: FxPoint | null; fxKey: number | string }) {
  const reduce = useReducedMotion()
  const archetype = archetypeFor(entry)
  if (archetype === 'none' || archetype === 'shield' || archetype === 'heal') return null
  // No measured caster/target (e.g. a unit unmounted/dead, or a no-target frame): nothing to fly.
  if (!from || !to) return null
  const style = archetypeStyle(archetype)

  const fromX = `${from.x}%`, fromY = `${from.y}%`
  const toX = `${to.x}%`, toY = `${to.y}%`

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        <motion.span
          key={fxKey}
          data-testid="spell-fx"
          data-archetype={archetype}
          initial={reduce ? { opacity: 1, left: toX, top: toY } : { opacity: 0.2, left: fromX, top: fromY, scale: 0.6 }}
          animate={{ opacity: 1, left: toX, top: toY, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.42, ease: 'easeIn' }}
          className="absolute h-3 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${style.color} 0%, ${style.trail} 70%, transparent 100%)`,
            boxShadow: `0 0 16px ${style.trail}`,
          }}
        />
      </AnimatePresence>
    </div>
  )
}

/**
 * Protego dome: a translucent blue sphere around the defender plus a "PARATO"
 * label and shockwave. Teaches the mechanic by contrast with a hit that lands.
 */
export function ShieldFx({ active, fxKey }: { active: boolean; fxKey: number | string }) {
  const reduce = useReducedMotion()
  if (!active) return null
  return (
    <div data-testid="shield-fx" className="pointer-events-none absolute inset-0 grid place-items-center">
      <motion.div
        key={`dome-${fxKey}`}
        initial={reduce ? { opacity: 0.5, scale: 1 } : { opacity: 0.1, scale: 0.6 }}
        animate={{ opacity: [0.6, 0.3], scale: [1, 1.15] }}
        transition={{ duration: reduce ? 0 : 0.5 }}
        className="h-24 w-24 rounded-full border-2 border-sky-300/70"
        style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.25) 0%, transparent 70%)' }}
      />
      <span className="absolute font-display text-xs font-bold uppercase tracking-[0.22em] text-sky-200">
        Parato
      </span>
    </div>
  )
}
