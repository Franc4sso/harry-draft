'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { cn } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { StatBar } from '@/components/ui/StatBar'
import { Chip } from '@/components/ui/Chip'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HouseCrest } from '@/components/ui/HouseCrest'
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
      className={cn('w-60 select-none text-white', clickable && 'cursor-pointer', className)}
    >
      <RarityFrame tier={wizard.tier} className={cn(selected && 'ring-2 ring-white/80')}>
        <div className="relative h-40 overflow-hidden">
          <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(12,10,22,0.92))' }} />
          <div className="absolute right-3 top-3"><TierBadge tier={wizard.tier} /></div>
        </div>

        <div className="p-4 pt-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg leading-tight">{wizard.name}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
                <HouseCrest house={wizard.house} size={14} />{wizard.house}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/80">
              <RoleIcon role={wizard.role} /><span>{wizard.role}</span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <StatBar label="HP" value={stats.hp} max={CARD_STAT_MAX.hp} color="#7CFC9B" />
            <StatBar label="ATK" value={stats.atk} max={CARD_STAT_MAX.atk} color="#FF8A7A" />
            <StatBar label="DEF" value={stats.def} max={CARD_STAT_MAX.def} color="#7DB7FF" />
            <StatBar label="VEL" value={stats.spd} max={CARD_STAT_MAX.spd} color="#FFD37D" />
          </div>

          <div className="mt-3 rounded-xl bg-black/30 px-3 py-2 space-y-1.5">
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
        </div>
      </RarityFrame>
    </motion.div>
  )
}
