'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { Chip } from '@/components/ui/Chip'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { affiliationChips } from '@/lib/affiliationChips'
import { spellTypeChip, spellEffectChips } from '@/lib/glossary'

export const CARD_STAT_MAX = { hp: 150, atk: 120, def: 120, spd: 120 } as const

const STAT_CELLS: Array<{ key: keyof typeof CARD_STAT_MAX; label: string; color: string }> = [
  { key: 'hp', label: 'HP', color: '#7CFC9B' },
  { key: 'atk', label: 'ATK', color: '#FF8A7A' },
  { key: 'def', label: 'DIF', color: '#7DB7FF' },
  { key: 'spd', label: 'VEL', color: '#FFD37D' },
]

function StatCell({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const ratio = Math.min(1, max <= 0 ? 0 : value / max)
  return (
    <div className="flex items-center gap-1">
      <span className="w-7 shrink-0 text-[9px] uppercase tracking-wide text-white/45">{label}</span>
      <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-white/85">{value}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/40">
        <span className="block h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </span>
    </div>
  )
}

export function WizardCard({
  drafted, selected, onClick, className, hotSynergyIds,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
  hotSynergyIds?: ReadonlySet<string>
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)
  const typeChip = spellTypeChip(spell.type)
  const effectChips = spellEffectChips(spell)
  const chips = affiliationChips(wizard)

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
      className={cn('w-44 select-none text-white', clickable && 'cursor-pointer', className)}
    >
      <RarityFrame tier={wizard.tier} selected={selected}>
        <div className="relative h-28 overflow-hidden">
          <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(12,10,22,0.94))' }} />
          <div className="absolute right-2 top-2"><TierBadge tier={wizard.tier} /></div>
        </div>

        <div className="p-2.5 pt-1.5">
          <h3 className="font-display text-sm leading-tight truncate">{wizard.name}</h3>
          <div data-testid="affiliation-strip" className="mt-1 flex flex-wrap items-center gap-1">
            {chips.map((c) => {
              const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
              const isSpecial = c.kind === 'special'
              return (
                <span
                  key={c.id}
                  data-synergy={c.synergyId}
                  data-hot={hot ? '' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                    hot && 'resa-animated',
                  )}
                  style={
                    hot
                      ? { color: '#f3e6c4', borderColor: '#caa24a', background: 'rgba(120,90,40,0.6)', boxShadow: '0 0 8px rgba(202,162,74,0.6)' }
                      : isSpecial
                        ? { color: '#ead9b0', borderColor: 'rgba(176,141,87,0.55)', background: 'rgba(176,141,87,0.12)' }
                        : { color: 'rgba(255,255,255,0.82)', borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)' }
                  }
                >
                  {c.kind === 'house' && <HouseCrest house={wizard.house} size={11} />}
                  {c.kind === 'role' && <RoleIcon role={wizard.role} size={11} />}
                  {isSpecial && <span aria-hidden style={{ color: '#caa24a' }}>◆</span>}
                  {c.label}
                </span>
              )
            })}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
            {STAT_CELLS.map((c) => (
              <StatCell key={c.key} label={c.label} value={stats[c.key as Stat]} max={CARD_STAT_MAX[c.key]} color={c.color} />
            ))}
          </div>

          <div className="mt-2 rounded-lg bg-black/30 px-2 py-1.5">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-xs font-medium">{spell.name}</p>
              <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />
            </div>
            {effectChips.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {effectChips.map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
              </div>
            )}
          </div>
        </div>
      </RarityFrame>
    </motion.div>
  )
}
