'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard, Stat } from '@/types'
import { cn } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleBadge } from './RoleBadge'
import { AbilityPlate } from './AbilityPlate'
import { Chip } from '@/components/ui/Chip'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HouseFrame } from './HouseFrame'
import { affiliationChips } from '@/lib/affiliationChips'
import { spellEffectLines, formatSpellStats } from '@/lib/glossary'
import { ROLE_ACCENT, ROLE_INFO } from '@/lib/roleInfo'
import { synergyName } from '@/lib/synergyBadge'
import { TRAIT_BY_ID } from '@/data/traits'
import { displayName } from '@/lib/displayName'

export const CARD_STAT_MAX = { hp: 150, atk: 120, def: 120, spd: 120 } as const

const STAT_CELLS: Array<{ key: keyof typeof CARD_STAT_MAX; label: string; color: string }> = [
  { key: 'hp', label: 'HP', color: '#7CFC9B' },
  { key: 'atk', label: 'ATT', color: '#FF8A7A' },
  { key: 'def', label: 'DIF', color: '#7DB7FF' },
  { key: 'spd', label: 'VEL', color: '#FFD37D' },
]

export function WizardCard({
  drafted, selected, onClick, className, hotSynergyIds, showLevel,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
  hotSynergyIds?: ReadonlySet<string>
  /** Show the `Lv. N` chip. Off in the draft/recruit offer (all level 1); on for
   *  the real roster (team panel, level-up). */
  showLevel?: boolean
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)
  const reduceMotion = useReducedMotion()
  const accent = ROLE_ACCENT[wizard.role]
  const effectLines = spellEffectLines(spell)
  const spellStats = formatSpellStats(spell)
  // House and role are shown by the frame + role badge/word, so the strip
  // carries only the special (group/origin) synergies — usually short or empty.
  const specialChips = affiliationChips(wizard).filter((c) => c.kind === 'special')
  // TEMP stub — replaced by abilityFor in Task 5. The real per-wizard personal
  // ability text (name + blurb) lands in lib/wizardAbilities.ts; until then the
  // plate shows the equipped spell's name paired with the role's behaviour blurb.
  const ability = { name: spell.name, blurb: ROLE_INFO[wizard.role] }
  const firstHotSynergy = hotSynergyIds?.size ? [...hotSynergyIds][0] : undefined

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={clickable && !reduceMotion ? { y: -6, scale: 1.03 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      className={cn('flex w-56 flex-col select-none text-white', clickable && 'cursor-pointer', className)}
    >
      <RarityFrame tier={wizard.tier} selected={selected} className="flex min-h-[27rem] flex-1 flex-col">
        <HouseFrame house={wizard.house} className="flex flex-1 flex-col">
          {/* HERO — full-bleed portrait + role-accent wash + gradient + vignette. */}
          <div className="relative h-[248px] shrink-0 overflow-hidden">
            <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
            {/* role-accent wash, soft-light */}
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-soft-light opacity-40"
              style={{ background: `radial-gradient(85% 55% at 50% 14%, ${accent}, transparent 66%)` }}
            />
            <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.42), transparent 30%)' }} />
            <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 44%, rgba(6,5,11,0.5) 76%, #0a0a12 99%)' }} />
            <div aria-hidden className="absolute inset-0" style={{ boxShadow: 'inset 0 0 100px 16px rgba(0,0,0,0.5)' }} />

            <div className="absolute left-3 top-3">
              <RoleBadge role={wizard.role} />
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1">
              {showLevel && <Chip label={`Lv. ${drafted.level ?? 1}`} color="#F0D98A" />}
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
            </div>

            {drafted.shiny && (
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 0 2px rgba(255,210,90,0.8), 0 0 18px rgba(255,200,80,0.5)' }} />
            )}
          </div>

          {/* BODY */}
          <div className="flex flex-1 flex-col p-3.5 pt-3">
            {(specialChips.length > 0 || drafted.shiny) && (
              <div className="mb-2.5 flex flex-wrap items-center gap-1">
                {specialChips.length > 0 && (
                  <div data-testid="affiliation-strip" className="flex flex-wrap items-center gap-1">
                    {specialChips.map((c) => {
                      const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
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
                {drafted.shiny && (() => {
                  const trait = TRAIT_BY_ID[drafted.shiny.traitId]
                  return trait ? (
                    <span
                      className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ color: '#c4dff3', borderColor: 'rgba(100,160,220,0.5)', background: 'rgba(60,110,180,0.18)' }}
                    >
                      {trait.name}
                    </span>
                  ) : null
                })()}
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
              {effectLines.length > 0 && (
                <div className="space-y-0.5 px-3.5 pb-2.5">
                  {effectLines.map((e) => (
                    <p key={e.label} className="text-[11px] leading-snug text-white/70">
                      <span className="font-semibold" style={{ color: e.color }}>{e.label}:</span> {e.blurb}
                    </p>
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
        </HouseFrame>
      </RarityFrame>
    </motion.div>
  )
}
