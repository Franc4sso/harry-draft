'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn, houseTheme } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { CARD_STAT_MAX } from './WizardCard'
import { STAT_CELLS } from './statCells'
import { Chip } from '@/components/ui/Chip'
import { HouseCrest } from '@/components/ui/HouseCrest'
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
        'wizard-col group relative flex w-full select-none flex-col rounded-2xl text-white',
        clickable && 'cursor-pointer', className,
      )}
      style={{
        // Object, not panel: gold double-bevel frame + house glow + deep drop.
        background: `linear-gradient(180deg, ${theme.color}1f 0%, #130f22 42%, #0c0917 100%)`,
        boxShadow: selected
          ? `0 0 0 1px rgba(0,0,0,0.7), 0 0 0 2px #f6ecc4, 0 0 0 3px rgba(0,0,0,0.8), 0 22px 46px -14px rgba(0,0,0,0.85), 0 0 30px -4px ${theme.glow}88${shinyGlow}`
          : `0 0 0 1px rgba(0,0,0,0.7), 0 0 0 2px #a9802f, 0 0 0 3px rgba(0,0,0,0.8), 0 22px 46px -14px rgba(0,0,0,0.85), 0 0 34px -6px ${theme.glow}44${shinyGlow}`,
      }}
    >
      {/* Engraved gold inner hairline + faint house aura at the crown. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 rounded-2xl"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(217,182,95,0.28), inset 0 2px 0 rgba(255,255,255,0.05)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
        style={{ background: `radial-gradient(60% 38% at 50% 6%, ${theme.color}66, transparent 70%)` }}
      />

      {/* PORTRAIT — full width, top, bleeding into the body via a soft mask.
          Image is clipped; the crest/tier/role sit OVER it (outside the clip) so
          their tooltips can escape. */}
      <div className="relative h-44 w-full shrink-0">
        <div
          className="absolute inset-0 overflow-hidden rounded-t-2xl"
          style={{ WebkitMaskImage: 'linear-gradient(180deg,#000 66%,transparent 100%)', maskImage: 'linear-gradient(180deg,#000 66%,transparent 100%)' }}
        >
          <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
          {/* house-tinted wash at the crown + fade into the card body */}
          <div className="absolute inset-0" style={{ background: `radial-gradient(100% 55% at 50% 0%, ${theme.color}6e, transparent 72%)` }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 36%, rgba(19,15,34,0.55) 80%, #130f22 100%)' }} />
          <div aria-hidden className="absolute inset-0" style={{ boxShadow: 'inset 0 0 34px rgba(0,0,0,0.55)' }} />
        </div>
        {/* rarity gem */}
        <div className="absolute left-2.5 top-2.5 z-30">
          <TierBadge tier={wizard.tier} />
        </div>
        {/* house wax-seal crest */}
        <div
          className="absolute right-2.5 top-2 z-30 grid h-9 w-9 place-items-center rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${theme.color} 0%, ${theme.color} 55%, #000 135%)`,
            boxShadow: `0 3px 7px rgba(0,0,0,0.6), 0 0 0 2px rgba(0,0,0,0.55), 0 0 0 3px ${theme.glow}55, inset 0 0 6px rgba(0,0,0,0.5)`,
          }}
        >
          <HouseCrest house={wizard.house} size={18} />
        </div>
        {/* role pip — bottom-right, opposite the crest, clear of the name below */}
        <Tooltip
          className="absolute bottom-3 right-2.5 z-30"
          triggerClassName="grid h-7 w-7 place-items-center rounded-full border border-[#caa24a]/50 bg-black/60 backdrop-blur-sm"
          content={roleTooltip(wizard.role)}
        >
          <RoleIcon role={wizard.role} size={14} className="text-[#f3e0b0]" />
        </Tooltip>
      </div>

      {/* CONTENT — pulled up under the arched portrait bleed. */}
      <div className="relative z-10 -mt-4 flex min-w-0 flex-1 flex-col gap-2 px-3.5 pb-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3
            className="font-display text-[18px] font-bold leading-[1.05]"
            style={{ color: '#f6ecc4', textShadow: '0 2px 7px rgba(0,0,0,0.85)' }}
          >
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

        {/* Engraved stat plate — punchy bars with a min floor so low stats still read. */}
        <div
          className="mt-0.5 flex flex-col gap-1.5 rounded-xl px-3 py-2.5"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.18))', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          {STAT_CELLS.map((c) => {
            const value = stats[c.key as Stat]
            const max = CARD_STAT_MAX[c.key]
            const ratio = Math.min(1, max <= 0 ? 0 : value / max)
            return (
              <div key={c.key} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-[8px] font-bold uppercase tracking-[0.1em] text-white/45">{c.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }}>
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(6, ratio * 100)}%`, background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                </span>
                <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-white">{value}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-auto flex min-w-0 flex-col rounded-xl px-3 py-2.5"
          style={{ background: 'linear-gradient(180deg, rgba(34,24,58,0.55), rgba(12,9,23,0.5))', border: '1px solid rgba(217,182,95,0.2)' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-[14px] font-semibold leading-tight text-white">{spell.name}</p>
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
