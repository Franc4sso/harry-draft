'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { houseTheme, cn } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { StatBar } from '@/components/ui/StatBar'
import { Chip } from '@/components/ui/Chip'
import { spellTypeChip, spellEffectChips } from '@/lib/glossary'

export const CARD_STAT_MAX = { hp: 150, atk: 120, def: 120, spd: 120 } as const

export function WizardCard({
  drafted, selected, onClick, className,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
}) {
  const { wizard, stats, spell } = drafted
  const theme = houseTheme(wizard.house)
  const clickable = Boolean(onClick)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={clickable ? { y: -8, scale: 1.03 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      className={cn(
        'relative w-60 rounded-2xl p-4 border text-white select-none overflow-hidden',
        clickable && 'cursor-pointer',
        selected ? 'border-white/80' : 'border-white/12',
        className,
      )}
      style={{
        background: theme.gradient,
        boxShadow: selected ? theme.ring : `0 8px 30px rgba(0,0,0,0.5)`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 60px ${theme.glow}14` }} />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg leading-tight">{wizard.name}</h3>
          <p className="text-xs text-white/70">{wizard.house}</p>
        </div>
        <TierBadge tier={wizard.tier} />
      </div>

      <div className="relative mt-2 flex items-center gap-2 text-xs text-white/80">
        <RoleIcon role={wizard.role} />
        <span>{wizard.role}</span>
      </div>

      <div className="relative mt-4 space-y-1.5">
        <StatBar label="HP" value={stats.hp} max={CARD_STAT_MAX.hp} color="#7CFC9B" />
        <StatBar label="ATK" value={stats.atk} max={CARD_STAT_MAX.atk} color="#FF8A7A" />
        <StatBar label="DEF" value={stats.def} max={CARD_STAT_MAX.def} color="#7DB7FF" />
        <StatBar label="VEL" value={stats.spd} max={CARD_STAT_MAX.spd} color="#FFD37D" />
      </div>

      <div className="relative mt-4 rounded-xl bg-black/30 px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{spell.name}</p>
          {(() => { const c = spellTypeChip(spell.type); return <Chip label={c.label} color={c.color} icon={c.icon} /> })()}
        </div>
        <p className="text-xs text-white/70 leading-snug">{spell.desc}</p>
        {(() => {
          const chips = spellEffectChips(spell)
          return chips.length ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {chips.map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
            </div>
          ) : null
        })()}
      </div>
    </motion.div>
  )
}
