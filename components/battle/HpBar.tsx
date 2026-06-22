'use client'
import { motion } from 'framer-motion'

/** Animated HP bar. Green→amber→red as HP drops; smoothly tweens on change. */
export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const ratio = maxHp <= 0 ? 0 : Math.min(1, Math.max(0, hp / maxHp))
  const color = ratio > 0.5 ? '#7CFC9B' : ratio > 0.25 ? '#FFD37D' : '#FF6B6B'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-black/40 overflow-hidden border border-white/10">
        <motion.div
          data-fill
          className="h-full rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 30 }}
        />
      </div>
      <span className="w-12 text-right tabular-nums text-[11px] text-white/70">
        {Math.round(Math.max(0, hp))}
      </span>
    </div>
  )
}
