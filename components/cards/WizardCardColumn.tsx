'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn, houseTheme } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleBadge } from './RoleBadge'
import { AbilityPlate } from './AbilityPlate'
import { CARD_STAT_MAX } from './WizardCard'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { spellEffectChips, spellEffectDetails, formatSpellStats } from '@/lib/glossary'
import { ROLE_ACCENT } from '@/lib/roleInfo'
import { synergyName } from '@/lib/synergyBadge'
import { TRAIT_BY_ID } from '@/data/traits'
import { abilityFor } from '@/lib/wizardAbilities'
import { epithetFor } from '@/lib/wizardEpithet'
import { displayName } from '@/lib/displayName'

/**
 * Vertical "poster" card for the draft. Full-bleed portrait hero (role badge +
 * tier + role word + monumental name over it), spell block, ability plate, and
 * stat row below. Sibling to WizardCardRow (which stays horizontal for
 * team/recruit). Root is NOT overflow-hidden (only the bg + portrait clip) so
 * tooltips/glows can escape.
 */
// Poster stat labels match the approved mockup ("ATT", not the roster row's
// "ATK"); colors are shared with the row/compact layouts.
const STAT_CELLS: Array<{ key: keyof typeof CARD_STAT_MAX; label: string; color: string }> = [
  { key: 'hp', label: 'HP', color: '#7CFC9B' },
  { key: 'atk', label: 'ATT', color: '#FF8A7A' },
  { key: 'def', label: 'DIF', color: '#7DB7FF' },
  { key: 'spd', label: 'VEL', color: '#FFD37D' },
]

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
  const reduceMotion = useReducedMotion()
  const theme = houseTheme(wizard.house)
  const accent = ROLE_ACCENT[wizard.role]
  const effectChips = spellEffectChips(spell)
  const effectDetails = spellEffectDetails(spell)
  const spellStats = formatSpellStats(spell)
  const shinyTrait = drafted.shiny ? TRAIT_BY_ID[drafted.shiny.traitId] : undefined
  const shinyGlow = drafted.shiny ? ', 0 0 22px rgba(255,200,80,0.55), inset 0 0 0 2px rgba(255,210,90,0.7)' : ''
  const ability = abilityFor(wizard.id)
  const epithet = epithetFor(wizard.id)
  const firstHotSynergy = hotSynergyIds?.size ? [...hotSynergyIds][0] : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={clickable && !reduceMotion ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      data-house={wizard.house}
      data-testid={testId}
      className={cn(
        'wizard-col group relative flex h-full w-full select-none flex-col rounded-2xl text-white',
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

      {/* HERO — full-bleed portrait + role-accent wash + gradient + vignette.
          Image is clipped; the badges/title sit OVER it (outside the clip) so
          the card root can stay un-clipped for escaping tooltips/glows. */}
      <div className="relative h-[248px] w-full shrink-0 overflow-hidden rounded-t-2xl">
        <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
        {/* role-accent wash, soft-light */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-soft-light opacity-40"
          style={{ background: `radial-gradient(85% 55% at 50% 14%, ${accent}, transparent 66%)` }}
        />
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.42), transparent 30%)' }} />
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 44%, rgba(6,5,11,0.5) 76%, #130f22 99%)' }} />
        <div aria-hidden className="absolute inset-0" style={{ boxShadow: 'inset 0 0 100px 16px rgba(0,0,0,0.5)' }} />

        <div className="absolute left-3 top-3">
          <RoleBadge role={wizard.role} />
        </div>
        <div className="absolute right-3 top-3">
          <TierBadge tier={wizard.tier} />
        </div>

        {/* Title block — role word pill + monumental name, over the portrait bottom. */}
        <div className="absolute inset-x-3.5 bottom-2.5">
          <span
            className="mb-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.1em] backdrop-blur-sm"
            style={{ background: `${accent}47`, color: '#fff', border: `1px solid ${accent}80` }}
          >
            {wizard.role}
          </span>
          <h3
            className="font-display text-[26px] font-extrabold leading-[0.95]"
            style={{ textShadow: '0 4px 20px rgba(0,0,0,0.85)' }}
          >
            {displayName(drafted)}
            {drafted.shiny && <span aria-hidden className="ml-1 text-amber-300">✨</span>}
          </h3>
          {epithet && (
            <p
              className="mt-0.5 text-[11px] font-semibold italic text-white/70"
              style={{ textShadow: '0 2px 10px rgba(0,0,0,0.85)' }}
            >
              {epithet}
            </p>
          )}
        </div>

        {drafted.shiny && (
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 0 2px rgba(255,210,90,0.8), 0 0 18px rgba(255,200,80,0.5)' }} />
        )}
      </div>

      {/* BODY */}
      <div className="flex flex-1 flex-col p-3.5 pt-3">
        {shinyTrait && (
          <div className="mb-2.5 flex flex-wrap items-center gap-1">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: '#c4dff3', borderColor: 'rgba(100,160,220,0.5)', background: 'rgba(60,110,180,0.18)' }}
            >
              {shinyTrait.name}
            </span>
          </div>
        )}

        {/* SPELL BLOCK — hero move. No type chip: the role-accent bar carries
            the "kind" cue instead. */}
        <div
          data-testid="spell-block"
          className="relative overflow-hidden rounded-[15px] border"
          style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))', borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
          <div className="px-3.5 pb-1.5 pt-2.5">
            <p className="font-display text-lg font-extrabold leading-none">{spell.name}</p>
          </div>
          {spell.type === 'Controllo' && effectDetails.length > 0 ? (
            <div className="space-y-0.5 px-3.5 pb-2.5 text-[11px] leading-snug text-white/80">
              {effectDetails.map((line) => (<p key={line}>{line}</p>))}
            </div>
          ) : effectChips.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3.5 pb-2.5">
              {effectChips.map((e) => (
                <span
                  key={e.label}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ color: e.color, background: `${e.color}22`, border: `1px solid ${e.color}55` }}
                >
                  {e.label}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-3.5 gap-y-0.5 border-t px-3.5 py-2 text-[11px]" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)', color: '#a4a1b6' }}>
            {spellStats.map((s) => (
              <span key={s.label} className="tabular-nums">
                <span>{s.label}:</span> <span className="font-bold" style={{ color: '#e8e5f2' }}>{s.value}</span>
              </span>
            ))}
          </div>
        </div>

        <AbilityPlate name={ability.name} blurb={ability.blurb} />

        <div className="mt-3.5 flex justify-between px-1">
          {STAT_CELLS.map((c) => (
            <div key={c.key} className="flex flex-col items-center gap-0.5">
              <span className="text-[9.5px] font-bold uppercase tracking-wide text-white/45">{c.label}</span>
              <span className="text-lg font-black tabular-nums" style={{ color: c.color }}>{stats[c.key as Stat]}</span>
            </div>
          ))}
        </div>

        {firstHotSynergy && (
          <div
            data-testid="synergy-nudge"
            className="mt-2.5 rounded-lg border px-2.5 py-1.5 text-center text-[11px] font-semibold"
            style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.5)', background: 'rgba(120,90,40,0.22)' }}
          >
            Aggiunge {synergyName(firstHotSynergy)}
          </div>
        )}
      </div>
    </motion.div>
  )
}
