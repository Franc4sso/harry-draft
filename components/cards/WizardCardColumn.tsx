'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn, houseTheme } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { CARD_STAT_MAX } from './WizardCard'
import { StatCell, STAT_CELLS } from './statCells'
import { Chip } from '@/components/ui/Chip'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { affiliationChips } from '@/lib/affiliationChips'
import { spellTypeChip, spellEffectChips, spellEffectDetails, formatSpellStats } from '@/lib/glossary'
import { roleTooltip } from '@/lib/roleInfo'
import { Tooltip } from '@/components/ui/Tooltip'
import { TRAIT_BY_ID } from '@/data/traits'
import { SIGNATURE_BY_ID } from '@/data/signatures'
import { displayName } from '@/lib/displayName'

/**
 * Vertical "collectible" card for the draft. Portrait on top, spell panel at the
 * bottom. Sibling to WizardCardRow (which stays horizontal for team/recruit).
 * Root is NOT overflow-hidden (only the bg + portrait clip) so tooltips escape.
 */
export function WizardCardColumn({
  drafted, selected, onClick, className, hotSynergyIds, testId,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
  hotSynergyIds?: ReadonlySet<string>
  testId?: string
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)
  const theme = houseTheme(wizard.house)
  const typeChip = spellTypeChip(spell.type)
  const effectChips = spellEffectChips(spell)
  const effectDetails = spellEffectDetails(spell)
  const spellStats = formatSpellStats(spell)
  const specialChips = affiliationChips(wizard).filter((c) => c.kind === 'special')
  const shinyTrait = drafted.shiny ? TRAIT_BY_ID[drafted.shiny.traitId] : undefined
  const shinyGlow = drafted.shiny ? ', 0 0 22px rgba(255,200,80,0.55), inset 0 0 0 2px rgba(255,210,90,0.7)' : ''
  const signature = SIGNATURE_BY_ID[wizard.id]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      data-house={wizard.house}
      data-testid={testId}
      className={cn(
        'wizard-col relative flex w-full select-none flex-col rounded-2xl text-white',
        clickable && 'cursor-pointer', className,
      )}
      style={{
        border: `2px solid ${theme.color}`,
        boxShadow: selected
          ? `0 10px 30px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.85), 0 0 18px ${theme.glow}55${shinyGlow}`
          : `0 10px 30px rgba(0,0,0,0.5), 0 0 16px ${theme.glow}30${shinyGlow}`,
      }}
    >
      {/* Background layer, clipped to the rounded corners. Root stays un-clipped. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${theme.color}22 0%, #0c0a16 60%)` }} />
      </div>

      {/* PORTRAIT — full width, top. Image clipped; badges over it stay outside the clip. */}
      <div className="relative h-40 w-full shrink-0">
        <div className="absolute inset-0 overflow-hidden rounded-t-[14px]">
          <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, #0c0a16 96%)' }} />
        </div>
        <div className="absolute left-2 top-2">
          <TierBadge tier={wizard.tier} />
        </div>
        <Tooltip
          className="absolute bottom-2 left-2"
          triggerClassName="grid h-6 w-6 place-items-center rounded-full border border-white/25 bg-black/55 backdrop-blur-sm"
          content={roleTooltip(wizard.role)}
        >
          <RoleIcon role={wizard.role} size={13} className="text-white/90" />
        </Tooltip>
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-[17px] leading-none">
            {displayName(drafted)}
            {drafted.shiny && <span aria-hidden className="ml-1 text-amber-300">✨</span>}
          </h3>
        </div>
        {specialChips.length > 0 && (
          <div data-testid="affiliation-strip" className="flex flex-wrap items-center gap-1">
            {specialChips.map((c) => {
              const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
              return (
                <span
                  key={c.id}
                  data-synergy={c.synergyId}
                  data-hot={hot ? '' : undefined}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={
                    hot
                      ? { color: '#f3e6c4', borderColor: '#caa24a', background: 'rgba(120,90,40,0.65)', boxShadow: '0 0 8px rgba(202,162,74,0.6)' }
                      : { color: '#ead9b0', borderColor: 'rgba(176,141,87,0.55)', background: 'rgba(176,141,87,0.14)' }
                  }
                >
                  <span aria-hidden style={{ color: '#caa24a' }}>◆</span>
                  {c.label}
                </span>
              )
            })}
          </div>
        )}

        {signature && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-300/60">Abilità</span>
            <Tooltip content={signature.desc}>
              <span
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ color: '#f3e0b0', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(120,90,40,0.28)' }}
              >
                <span aria-hidden className="text-amber-300">★</span>
                {signature.name}
              </span>
            </Tooltip>
          </div>
        )}

        {shinyTrait && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-sky-300/55">Tratto</span>
            <Tooltip content={shinyTrait.desc}>
              <span
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ color: '#bcd9f5', borderColor: 'rgba(96,156,214,0.55)', background: 'rgba(40,92,162,0.22)' }}
              >
                <span aria-hidden className="text-sky-300">✦</span>
                {shinyTrait.name}
              </span>
            </Tooltip>
          </div>
        )}

        <div className="mt-1 grid grid-cols-1 content-center gap-y-1">
          {STAT_CELLS.map((c) => (
            <StatCell key={c.key} label={c.label} value={stats[c.key as Stat]} max={CARD_STAT_MAX[c.key]} color={c.color} />
          ))}
        </div>

        <div className="mt-auto flex min-w-0 flex-col rounded-xl border border-white/12 bg-black/35 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-sm leading-tight">{spell.name}</p>
            <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/70">
            {spellStats.map((s) => (
              <span key={s.label} className="tabular-nums">
                <span className="text-white/45">{s.label}</span> <span className="text-white/90">{s.value}</span>
              </span>
            ))}
          </div>
          {spell.type === 'Controllo' && effectDetails.length > 0 ? (
            <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] leading-snug text-white/80">
              {effectDetails.map((line) => (<span key={line}>{line}</span>))}
            </div>
          ) : effectChips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {effectChips.map((e) => (<Chip key={e.label} label={e.label} color={e.color} icon={e.icon} />))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
