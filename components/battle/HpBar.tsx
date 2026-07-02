'use client'
import { motion, useReducedMotion } from 'framer-motion'

/** Animated HP bar. Green→amber→red as HP drops; smoothly tweens on change. */
export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const reduce = useReducedMotion()
  const ratio = maxHp <= 0 ? 0 : Math.min(1, Math.max(0, hp / maxHp))
  const color = ratio > 0.5 ? '#7CFC9B' : ratio > 0.25 ? '#FFD37D' : '#FF6B6B'
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 h-2 rounded-full bg-black/40 overflow-hidden border border-white/10">
        {/* Ghost layer: a crimson chunk that lingers, then catches up ~220ms later,
            so the damage just taken reads at a glance. */}
        <motion.div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: 'linear-gradient(90deg,#e05a4a,#7a1f1f)' }}
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.22 }}
        />
        {/* Front fill: snaps to the new value immediately. */}
        <motion.div
          data-fill
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
        />
      </div>
      <span className="w-12 text-right tabular-nums text-[11px] text-white/70">
        {Math.round(Math.max(0, hp))}
      </span>
    </div>
  )
}
