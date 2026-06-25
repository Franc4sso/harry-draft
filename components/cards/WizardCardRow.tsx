'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn, houseTheme } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { CARD_STAT_MAX } from './WizardCard'
import { Chip } from '@/components/ui/Chip'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { affiliationChips } from '@/lib/affiliationChips'
import { spellTypeChip, spellEffectChips, formatSpellStats } from '@/lib/glossary'
import { roleTooltip } from '@/lib/roleInfo'
import { Tooltip } from '@/components/ui/Tooltip'
import { TRAIT_BY_ID } from '@/data/traits'

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

export function WizardCardRow({
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
  const theme = houseTheme(wizard.house)
  const typeChip = spellTypeChip(spell.type)
  const effectChips = spellEffectChips(spell)
  const spellStats = formatSpellStats(spell)
  const specialChips = affiliationChips(wizard).filter((c) => c.kind === 'special')
  const traitChips = (wizard.traits ?? [])
    .map((id) => TRAIT_BY_ID[id])
    .filter((t): t is NonNullable<typeof t> => t != null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      data-house={wizard.house}
      className={cn(
        'wizard-row group relative flex w-full select-none overflow-hidden rounded-2xl text-white',
        clickable && 'cursor-pointer', className,
      )}
      style={{
        border: `2px solid ${theme.color}`,
        background: `linear-gradient(100deg, ${theme.color}cc 0%, ${theme.color}44 26%, #0c0a16 62%)`,
        boxShadow: selected
          ? `0 8px 28px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.85), 0 0 16px ${theme.glow}55`
          : `0 8px 28px rgba(0,0,0,0.5), 0 0 14px ${theme.glow}33, inset 0 0 26px ${theme.color}22`,
      }}
    >
      {/* Hover sheen — CSS only, no transform, so the card never moves out from under the cursor. */}
      <span aria-hidden className="wizard-row__sheen" />

      {/* LEFT: portrait, full card height */}
      <div className="relative w-28 shrink-0 self-stretch overflow-hidden">
        <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, transparent 28%, #0c0a16 96%)' }} />
        <div className="absolute left-1.5 top-1.5"><TierBadge tier={wizard.tier} /></div>
        <Tooltip
          className="absolute bottom-1.5 left-1.5"
          triggerClassName="grid h-6 w-6 place-items-center rounded-full border border-white/25 bg-black/55 backdrop-blur-sm"
          content={roleTooltip(wizard.role)}
        >
          <RoleIcon role={wizard.role} size={13} className="text-white/90" />
        </Tooltip>
      </div>

      {/* BODY: identity on top, then stats + spell (side by side on sm+, stacked on mobile) */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-base leading-tight truncate">{wizard.name}</h3>
          {specialChips.length > 0 && (
            <div data-testid="affiliation-strip" className="flex flex-wrap items-center gap-1">
              {specialChips.map((c) => {
                const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
                return (
                  <span
                    key={c.id}
                    data-synergy={c.synergyId}
                    data-hot={hot ? '' : undefined}
                    className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                    style={
                      hot
                        ? { color: '#f3e6c4', borderColor: '#caa24a', background: 'rgba(120,90,40,0.6)', boxShadow: '0 0 8px rgba(202,162,74,0.6)' }
                        : { color: '#ead9b0', borderColor: 'rgba(176,141,87,0.55)', background: 'rgba(176,141,87,0.12)' }
                    }
                  >
                    <span aria-hidden style={{ color: '#caa24a' }}>◆</span>
                    {c.label}
                  </span>
                )
              })}
            </div>
          )}
          {traitChips.map((trait) => (
            <Tooltip key={trait.id} content={trait.desc}>
              <span
                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ color: '#c4dff3', borderColor: 'rgba(100,160,220,0.5)', background: 'rgba(60,110,180,0.18)' }}
              >
                {trait.name}
              </span>
            </Tooltip>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-4">
          {/* Stats */}
          <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 self-center">
            {STAT_CELLS.map((c) => (
              <StatCell key={c.key} label={c.label} value={stats[c.key as Stat]} max={CARD_STAT_MAX[c.key]} color={c.color} />
            ))}
          </div>

          {/* Spell */}
          <div className="shrink-0 rounded-lg bg-black/30 p-2 sm:w-44 sm:border-l sm:border-white/10 sm:bg-transparent sm:pl-4">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-xs font-semibold">{spell.name}</p>
              <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/70">
              {spellStats.map((s) => (
                <span key={s.label} className="tabular-nums">
                  <span className="text-white/45">{s.label}</span> <span className="text-white/85">{s.value}</span>
                </span>
              ))}
            </div>
            {effectChips.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {effectChips.map((e) => (
                  <Chip key={e.label} label={e.label} color={e.color} icon={e.icon} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
