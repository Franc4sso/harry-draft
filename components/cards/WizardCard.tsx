'use client'
import type { DraftedWizard, Tier } from '@/types'
import { tierFrame } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { ROLE_ACCENT } from '@/lib/roleInfo'
import { primaryArchetype } from '@/lib/archetypes'
import { tagsOf } from '@/game/engine/roster'
import { SpellLine } from './parts/SpellLine'
import { StatBand } from './parts/StatBand'
import { AbilitySeal } from './parts/AbilitySeal'
import { RarityPips } from './parts/RarityPips'

export type CardDensity = 'full' | 'combat' | 'row'

const PORTRAIT: Record<CardDensity, number> = { full: 240, combat: 118, row: 0 }

/**
 * LA carta del mago — una sola, identica in ogni schermata (requisito esplicito
 * dell'utente). Prima erano tre componenti distinti (WizardCardColumn,
 * WizardCardRow, UnitBust) che disegnavano lo stesso mago in tre modi diversi.
 *
 * Cambia solo la DENSITÀ, cioè quanto mostra:
 *   full   — pesca e reclutamento: ritratto grande, magia con descrizione
 *   combat — battaglia: + barra vita, − descrizione della magia
 *   row    — squadra, mappa, anteprima nemici: ritratto a lato, dati in riga
 * Struttura, ordine delle informazioni e scrittura degli effetti restano gli stessi.
 */
export function WizardCard({
  drafted, density = 'full', currentHp, selected, onClick, className, testId, portraitHeight,
}: {
  drafted: DraftedWizard
  density?: CardDensity
  currentHp?: number
  selected?: boolean
  onClick?: () => void
  className?: string
  testId?: string
  portraitHeight?: number
}) {
  const { wizard, stats, spell } = drafted
  const frame = tierFrame(wizard.tier as Tier)
  const clickable = Boolean(onClick)
  const accent = ROLE_ACCENT[wizard.role]
  const archetype = primaryArchetype(tagsOf(drafted))
  const isRow = density === 'row'
  const portH = portraitHeight ?? PORTRAIT[density]
  const hpPct = currentHp !== undefined ? Math.max(0, Math.min(100, (currentHp / stats.hp) * 100)) : 100

  return (
    <div
      data-testid={testId}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      className={`relative flex flex-col rounded-[15px] p-px ${clickable ? 'cursor-pointer' : ''} ${className ?? ''}`}
      style={{
        background: frame.background,
        boxShadow: selected ? `0 0 0 2px #f6ecc4, ${frame.boxShadow}` : frame.boxShadow,
      }}
    >
      <div className={`relative flex flex-1 overflow-hidden rounded-[14px] ${isRow ? 'flex-row items-stretch' : 'flex-col'}`}
           style={{ background: 'linear-gradient(180deg,#141223,#0c0a17)' }}>

        {/* RITRATTO */}
        <div
          className={`relative shrink-0 ${isRow ? 'w-[54px]' : ''}`}
          style={{ height: isRow ? undefined : portH, background: 'linear-gradient(160deg,#2f3557,#1a1f36)' }}
        >
          <span aria-hidden className="absolute inset-0"
            style={{ background: 'radial-gradient(118% 84% at 50% 34%, transparent 48%, rgba(6,4,12,.7) 100%)' }} />
          {!isRow && (
            <>
              <RarityPips tier={wizard.tier as Tier} />
              {archetype && (
                <span className="absolute right-2 top-2 z-10 rounded border border-white/20 bg-[rgba(10,8,18,.6)] px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-[.1em] text-[#dbe9ff]">
                  {archetype.glyph} {archetype.name}
                </span>
              )}
              <AbilitySeal wizardId={wizard.id} />
              <div className="absolute inset-x-0 bottom-0 z-[3] px-3 pb-2.5 pt-6"
                style={{ background: 'linear-gradient(0deg, rgba(8,6,15,.96) 34%, rgba(8,6,15,.5) 68%, transparent)' }}>
                <div className="mb-1.5 flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-[.2em]"
                  style={{ color: accent }}>
                  {wizard.role}
                  <span aria-hidden className="h-px flex-1 opacity-40"
                    style={{ background: 'linear-gradient(90deg, currentColor, transparent)' }} />
                </div>
                <h3 className="font-display text-[20px] font-black leading-[.98] text-white"
                  style={{ textShadow: '0 3px 16px rgba(0,0,0,.9)' }}>
                  {displayName(drafted)}
                </h3>
              </div>
            </>
          )}
        </div>

        {/* CORPO */}
        {isRow ? (
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-2.5 py-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-display text-[11px] font-extrabold leading-none text-white">
                {displayName(drafted)}
              </span>
              <span className="shrink-0 text-[7px] font-extrabold uppercase tracking-[.14em]" style={{ color: accent }}>
                {wizard.role}
              </span>
            </div>
            {currentHp !== undefined && (
              <span className="h-[3px] overflow-hidden rounded-full bg-[rgba(124,220,125,.2)]">
                <i data-testid="card-hp-bar" className="block h-full rounded-full bg-[#7cdc7d]" style={{ width: `${hpPct}%` }} />
              </span>
            )}
            <StatBand stats={stats} currentHp={currentHp} compact />
          </div>
        ) : (
          <>
            {currentHp !== undefined && (
              <div className="px-2.5 pt-2">
                <span className="block h-1.5 overflow-hidden rounded-full bg-[rgba(124,220,125,.2)]">
                  <i data-testid="card-hp-bar" className="block h-full rounded-full bg-[#7cdc7d]" style={{ width: `${hpPct}%` }} />
                </span>
              </div>
            )}
            <SpellLine spell={spell} compact={density !== 'full'} />
            <StatBand stats={stats} currentHp={currentHp} />
          </>
        )}
      </div>
    </div>
  )
}
