'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn, houseTheme, tierFrame, SHINY_FOIL } from '@/lib/theme'
import { RoleBadge } from './RoleBadge'
import { AbilityPlate } from './AbilityPlate'
import { DuoSignalMarks } from './DuoSignalMarks'
import { CARD_STAT_MAX } from './cardStats'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { spellEffectChips, spellEffectDetails, formatSpellStats } from '@/lib/glossary'
import { ROLE_ACCENT, roleTooltip } from '@/lib/roleInfo'
import { TRAIT_BY_ID } from '@/data/traits'
import { abilityFor } from '@/lib/wizardAbilities'
import { displayName } from '@/lib/displayName'
import { ARCHETYPE_BY_TAG, archetypeTooltip } from '@/lib/archetypes'
import { Tooltip } from '@/components/ui/Tooltip'

/** Primary archetype for the card ribbon: the first of the wizard's tags that has an entry in
 *  ARCHETYPE_BY_TAG (veleno/esecuzione/scudirigen/magieOscure). A wizard can carry more than one
 *  archetype tag (e.g. Voldemort: esecuzione + magieOscure) — the mockup shows a single ribbon,
 *  so we take the first match in tag order. `undefined` when no tag matches (no ribbon). */
function primaryArchetype(tags: string[] | undefined) {
  const tag = (tags ?? []).find((t): t is keyof typeof ARCHETYPE_BY_TAG => t in ARCHETYPE_BY_TAG)
  return tag ? ARCHETYPE_BY_TAG[tag] : undefined
}

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
  drafted, selected, onClick, className, testId,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
  testId?: string
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)
  const reduceMotion = useReducedMotion()
  const theme = houseTheme(wizard.house)
  const frame = tierFrame(wizard.tier)
  const accent = ROLE_ACCENT[wizard.role]
  const effectChips = spellEffectChips(spell)
  const effectDetails = spellEffectDetails(spell)
  const spellStats = formatSpellStats(spell)
  const shinyTrait = drafted.shiny ? TRAIT_BY_ID[drafted.shiny.traitId] : undefined
  const shinyGlow = drafted.shiny ? SHINY_FOIL : ''
  const ability = abilityFor(wizard.id)
  const archetype = primaryArchetype(wizard.tags)
  const isLegendary = wizard.tier === 1

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
      data-tier={wizard.tier}
      data-testid={testId}
      className={cn(
        'wizard-col group relative flex h-full w-full select-none flex-col rounded-2xl p-[9px] text-white',
        clickable && 'cursor-pointer', className,
      )}
      style={{
        // RARITY FRAME — the card's outer identity, by tier (ported from
        // .superpowers/design/rarity-borders.html: pewter → brushed silver → amethyst → gilt).
        // Padding = frame thickness, so the tier metal shows as a ring around the plate.
        // Selected keeps a bright warm ring on top so the chosen state stays distinct from tier.
        background: frame.background,
        boxShadow: selected
          ? `${frame.boxShadow}, 0 0 0 2px #f6ecc4${shinyGlow}`
          : `${frame.boxShadow}${shinyGlow}`,
      }}
    >
      {/* Fine keyline just inside the metal frame, tinted by tier accent (mockup: .plate::after). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[11px] z-20 rounded-[14px]"
        style={{ border: `1px solid ${frame.keyline}` }}
      />

      {/* Shimmer — ONLY tier 1 (legendary), a slow diagonal gleam sweeping the gilded frame.
          Masked to the ~9px frame ring (content-box XOR mask, mockup: .t1 .shimmer) so the gleam
          travels the gold border only, not the portrait/name underneath.
          Respects prefers-reduced-motion: static gleam position, no animation. */}
      {isLegendary && (
        <div
          aria-hidden
          data-testid="tier-shimmer"
          className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl"
          style={{
            mixBlendMode: 'screen',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: 9,
          }}
        >
          <motion.div
            className="absolute -inset-y-1/2 -inset-x-1/2"
            style={{
              background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0) 40%, rgba(255,251,235,.55) 50%, rgba(255,255,255,0) 60%, transparent 70%)',
            }}
            animate={reduceMotion ? undefined : { x: ['20%', '-20%'], y: ['-10%', '10%'] }}
            transition={reduceMotion ? undefined : { duration: 5.5, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>
      )}

      {/* DECO — signature ornaments, gated strictly by tier (mockup: .deco). Static (no motion),
          so they're unaffected by prefers-reduced-motion. No corner gems anywhere — rejected. */}
      {isLegendary && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
          {/* Crown — top-center, above the frame (mockup: .t1 .deco svg, top:-9px). */}
          <svg
            data-testid="tier-legendary-crown"
            width="60"
            height="26"
            viewBox="0 0 60 26"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: -9 }}
          >
            <defs>
              <linearGradient id="wizardCardGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff6d6" />
                <stop offset="55%" stopColor="#ffd34d" />
                <stop offset="100%" stopColor="#a9741f" />
              </linearGradient>
              <radialGradient id="wizardCardGoldGem" cx="38%" cy="32%" r="72%">
                <stop offset="0" stopColor="#fffbe6" />
                <stop offset="40%" stopColor="#ffdf7a" />
                <stop offset="100%" stopColor="#8a5a12" />
              </radialGradient>
            </defs>
            {/* dark backing so the crown reads against the gold frame */}
            <path d="M11 24 L18 8 L30 17 L42 8 L49 24 Z" fill="#1a1206" opacity={0.55} transform="translate(0 1.5)" />
            <path d="M11 24 L18 8 L30 17 L42 8 L49 24 Z" fill="url(#wizardCardGold)" stroke="#fff6d6" strokeWidth={1} />
            <circle cx={18} cy={8} r={2.2} fill="url(#wizardCardGoldGem)" stroke="#fff6d6" strokeWidth={0.5} />
            <circle cx={42} cy={8} r={2.2} fill="url(#wizardCardGoldGem)" stroke="#fff6d6" strokeWidth={0.5} />
            <circle cx={30} cy={17} r={2.8} fill="url(#wizardCardGoldGem)" stroke="#fff6d6" strokeWidth={0.6} />
          </svg>
        </div>
      )}
      {wizard.tier === 2 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30" data-testid="tier-epic-filigree">
          {/* Filigree flourishes — top & bottom center only (mockup: .t2 .deco svg). No corner gems. */}
          <svg
            width="88"
            height="20"
            viewBox="0 0 88 20"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: -3 }}
          >
            <defs>
              <linearGradient id="wizardCardAmsil" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#efe6ff" />
                <stop offset="1" stopColor="#a879e0" />
              </linearGradient>
            </defs>
            <g fill="none" stroke="url(#wizardCardAmsil)" strokeWidth={1.4} strokeLinecap="round">
              <path d="M44 15 C44 8, 38 6, 32 8 C26 10, 24 6, 22 3" />
              <path d="M44 15 C44 8, 50 6, 56 8 C62 10, 64 6, 66 3" />
              <path d="M32 8 C34 4, 30 3, 28 6" />
              <path d="M56 8 C54 4, 58 3, 60 6" />
            </g>
          </svg>
          <svg
            width="88"
            height="20"
            viewBox="0 0 88 20"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: -3, transform: 'translateX(-50%) rotate(180deg)' }}
          >
            <g fill="none" stroke="url(#wizardCardAmsil)" strokeWidth={1.4} strokeLinecap="round">
              <path d="M44 15 C44 8, 38 6, 32 8 C26 10, 24 6, 22 3" />
              <path d="M44 15 C44 8, 50 6, 56 8 C62 10, 64 6, 66 3" />
              <path d="M32 8 C34 4, 30 3, 28 6" />
              <path d="M56 8 C54 4, 58 3, 60 6" />
            </g>
          </svg>
        </div>
      )}

      {/* PLATE — inner content, carries the house wash (soft radial tint from the top). Rarity
          lives in the frame around it; house is now an ambient tint, not the border. */}
      <div
        className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-[14px]"
        style={{ background: `radial-gradient(120% 90% at 50% -18%, ${theme.color}55 0%, transparent 62%), linear-gradient(180deg, #120d16 0%, #0c0810 100%)` }}
      >

      {/* HERO — full-bleed portrait + role-accent wash + gradient + vignette.
          Image is clipped; the badges/title sit OVER it (outside the clip) so
          the card root can stay un-clipped for escaping tooltips/glows. */}
      <div className="relative h-[248px] w-full shrink-0 overflow-hidden">
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
          <Tooltip label={`Ruolo ${wizard.role}`} content={roleTooltip(wizard.role)}>
            <RoleBadge role={wizard.role} />
          </Tooltip>
        </div>
        <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
          {/* ARCHETYPE RIBBON — top-right banner, glyph + fantasy name, tinted by archetype
              color (mockup: .ribbon). Shows the wizard's PRIMARY archetype tag only. */}
          {archetype && (() => {
            const tag = wizard.tags?.find((t): t is keyof typeof ARCHETYPE_BY_TAG => t in ARCHETYPE_BY_TAG)!
            return (
              <Tooltip
                label={`Archetipo ${archetype.name}`}
                content={archetypeTooltip(tag)}
                triggerClassName="rounded-bl-xl"
              >
                <span
                  data-testid="archetype-ribbon"
                  data-archetype={tag}
                  className="inline-flex items-center gap-1 rounded-bl-xl px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white"
                  style={{
                    background: `linear-gradient(180deg, ${archetype.color}, ${archetype.color}99)`,
                    boxShadow: '0 3px 10px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.22)',
                  }}
                >
                  <span aria-hidden>{archetype.glyph}</span> {archetype.name}
                </span>
              </Tooltip>
            )
          })()}
          {drafted.corrotto && (
            <span
              data-testid="corrotto-badge"
              title="Corrotto — non curabile"
              className="mr-3 mt-1 inline-flex items-center gap-1 rounded-full border border-purple-400/60 bg-purple-950/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-200"
            >
              <span aria-hidden>☠</span> Corrotto — non curabile
            </span>
          )}
        </div>

        {/* Title block — monumental name over the portrait bottom. */}
        <div className="absolute inset-x-3.5 bottom-2.5">
          <h3
            className="font-display text-[26px] font-extrabold leading-[0.95]"
            style={{ textShadow: '0 4px 20px rgba(0,0,0,0.85)' }}
          >
            {displayName(drafted)}
            {drafted.shiny && <span aria-hidden className="ml-1 text-amber-300">✨</span>}
          </h3>
        </div>
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

        {/* Named signals so the Combo value is explicit. taunt reads "Bersaglio" (not "Tank")
            to avoid echoing the crown/RoleBadge — see DuoSignalMarks.cardLabel. The 4 tag-signals
            (veleno/esecuzione/scudirigen/magieOscure) are excluded here since the archetype
            ribbon above already shows the wizard's primary one — no redundant pill. */}
        <div className="mb-2"><DuoSignalMarks wizard={wizard} excludeArchetypeSignals /></div>

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

        {/* Stats pinned to the bottom (mt-auto) so cards are the same height regardless
            of spell/ability text length — homogeneous row. */}
        <div className="mt-auto flex justify-between px-1 pt-3.5">
          {STAT_CELLS.map((c) => (
            <div key={c.key} className="flex flex-col items-center gap-0.5">
              <span className="text-[9.5px] font-bold uppercase tracking-wide text-white/45">{c.label}</span>
              <span className="text-lg font-black tabular-nums" style={{ color: c.color }}>{stats[c.key as Stat]}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </motion.div>
  )
}
