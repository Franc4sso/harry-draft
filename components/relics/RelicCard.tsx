'use client'
import { motion } from 'framer-motion'
import { Gem, Sparkles } from 'lucide-react'
import type { Relic } from '@/types'
import { cn } from '@/lib/cn'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'

export { RELIC_RARITY_COLOR }

export function RelicCard({
  relic, onClick, className,
}: {
  relic: Relic
  onClick?: () => void
  className?: string
}) {
  const color = RELIC_RARITY_COLOR[relic.rarity]
  const clickable = Boolean(onClick)
  const hasTrigger = Boolean(relic.triggers?.length)
  const Icon = hasTrigger ? Sparkles : Gem

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={clickable ? { y: -6, scale: 1.03 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      className={cn(
        'relative w-56 rounded-2xl p-4 border text-white select-none glass',
        clickable && 'cursor-pointer',
        className,
      )}
      style={{ borderColor: `${color}66`, boxShadow: `0 0 24px ${color}33` }}
    >
      <div className="flex items-center gap-2">
        <Icon size={18} style={{ color }} aria-hidden />
        <h3 className="font-display text-base leading-tight">{relic.name}</h3>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider" style={{ color }}>{relic.rarity}</p>
      <p className="mt-2 text-sm text-white/75 leading-relaxed">{relic.desc}</p>
    </motion.div>
  )
}
