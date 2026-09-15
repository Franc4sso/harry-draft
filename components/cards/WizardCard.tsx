'use client'
import type { DraftedWizard, Tier } from '@/types'
import { tierFrame } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { ROLE_ACCENT } from '@/lib/roleInfo'
import { ARCHETYPE_BY_TAG, archetypeTooltip, primaryArchetype } from '@/lib/archetypes'
import { tagsOf } from '@/game/engine/roster'
import { SpellLine } from './parts/SpellLine'
import { spellHeadline } from '@/lib/spellText'
import { SPELL_TYPE_META } from '@/lib/glossary'
import { StatBand } from './parts/StatBand'
import { AbilitySeal } from './parts/AbilitySeal'
import { RarityPips } from './parts/RarityPips'
import { MarchioMarks } from './MarchioMarks'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { Tooltip } from '@/components/ui/Tooltip'
import { TRAIT_BY_ID } from '@/data/traits'

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
  drafted, density = 'full', currentHp, selected, onClick, className, testId, portraitHeight, style,
}: {
  drafted: DraftedWizard
  density?: CardDensity
  currentHp?: number
  selected?: boolean
  onClick?: () => void
  className?: string
  testId?: string
  /** Altezza del ritratto in px, oppure 'fill' per prendere lo spazio residuo
   *  quando la carta è stirata da una griglia. */
  portraitHeight?: number | 'fill'
  /** Sovrascrive lo stile della cornice — usato in battaglia per tingere il lato
   *  (rosso i nemici, verde i tuoi) invece del filo di rarità. */
  style?: React.CSSProperties
}) {
  const { wizard, stats, spell } = drafted
  const frame = tierFrame(wizard.tier as Tier)
  const clickable = Boolean(onClick)
  const accent = ROLE_ACCENT[wizard.role]
  const effectiveTags = tagsOf(drafted)
  const archetype = primaryArchetype(effectiveTags)
  const archetypeTag = effectiveTags.find((t): t is keyof typeof ARCHETYPE_BY_TAG => t in ARCHETYPE_BY_TAG)
  // Valore e colore della magia: in densità `row` la SpellLine non c'è (troppo alta
  // per una riga da 62px), ma il dato serve lo stesso nell'anteprima dei nemici.
  const head = spellHeadline(spell)
  const spellAccent = SPELL_TYPE_META[spell.type].color
  const shinyTrait = drafted.shiny ? TRAIT_BY_ID[drafted.shiny.traitId] : undefined
  const isRow = density === 'row'
  const fillPortrait = portraitHeight === 'fill'
  const portH = typeof portraitHeight === 'number' ? portraitHeight : PORTRAIT[density]
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
        ...style,
      }}
    >
      <div className={`relative flex flex-1 overflow-hidden rounded-[14px] ${isRow ? 'flex-row items-stretch' : 'flex-col'}`}
           style={{ background: 'linear-gradient(180deg,#141223,#0c0a17)' }}>

        {/* RITRATTO — con `portraitHeight="fill"` prende tutta l'altezza che avanza
            invece di una misura fissa. Serve dove la carta è stirata dalla griglia
            (la pesca): senza, la carta si allungava ma il contenuto no, e restava un
            vuoto fra la magia e le statistiche. Il ritratto è la parte che l'utente
            ha chiesto di tenere grande, quindi è quella che cresce. */}
        <div
          className={`relative overflow-hidden ${fillPortrait ? 'min-h-0 flex-1' : 'shrink-0'} ${isRow ? 'w-[54px]' : ''}`}
          style={{
            height: isRow || fillPortrait ? undefined : portH,
            background: 'linear-gradient(160deg,#2f3557,#1a1f36)',
          }}
        >
          <PortraitImage
            id={wizard.id}
            house={wizard.house}
            alt={wizard.name}
            variant={density === 'combat' ? 'bust' : 'card'}
          />
          <span aria-hidden className="absolute inset-0"
            style={{ background: 'radial-gradient(118% 84% at 50% 34%, transparent 48%, rgba(6,4,12,.7) 100%)' }} />
          {!isRow && (
            <>
              <RarityPips tier={wizard.tier as Tier} />
              {density === 'combat' && drafted.level !== undefined && (
                <span
                  data-testid="card-level-badge"
                  className="absolute left-2 top-2 z-10 rounded border border-[#C9A24B]/45 bg-[#C9A24B]/25 px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-[.1em] text-[#F4DE9A]"
                >
                  Lv. {drafted.level}
                </span>
              )}
              {archetype && archetypeTag && (
                <Tooltip
                  label={`Archetipo ${archetype.name}`}
                  content={archetypeTooltip(archetypeTag)}
                  className="absolute right-2 top-2 z-10"
                >
                  <span
                    data-testid="archetype-badge"
                    data-archetype={archetypeTag}
                    className="rounded border border-white/20 bg-[rgba(10,8,18,.6)] px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-[.1em] text-[#dbe9ff]"
                  >
                    {archetype.glyph} {archetype.name}
                  </span>
                </Tooltip>
              )}
              {/* Il sigillo sta DENTRO la targa (non come suo fratello) perché si
                  ancora con `bottom-full`: così si appoggia al bordo superiore del
                  nome qualunque altezza abbia la targa, invece di galleggiare a
                  metà ritratto con un offset fisso in pixel. */}
              <div className="absolute inset-x-0 bottom-0 z-[3] px-3 pb-2.5 pt-6"
                style={{ background: 'linear-gradient(0deg, rgba(8,6,15,.96) 34%, rgba(8,6,15,.5) 68%, transparent)' }}>
                <AbilitySeal wizardId={wizard.id} />
                <div className="mb-1.5 flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-[.2em]"
                  style={{ color: accent }}>
                  {wizard.role}
                  <span aria-hidden className="h-px flex-1 opacity-40"
                    style={{ background: 'linear-gradient(90deg, currentColor, transparent)' }} />
                </div>
                <h3 className="font-display text-[20px] font-black leading-[.98] text-white"
                  style={{ textShadow: '0 3px 16px rgba(0,0,0,.9)' }}>
                  {displayName(drafted)}
                  {drafted.shiny && shinyTrait && (
                    <Tooltip
                      label="Cimelio raro"
                      content={`${shinyTrait.name} — ${shinyTrait.desc}`}
                      triggerClassName="ml-1.5 inline-flex align-middle"
                    >
                      <span
                        data-testid="shiny-foil"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          color: '#3a2a08',
                          background: 'linear-gradient(135deg, #ffe9a8, #d9a94a)',
                          boxShadow: '0 0 8px rgba(255,205,90,0.7), inset 0 1px 0 rgba(255,255,255,0.6)',
                        }}
                        aria-hidden
                      >
                        ✦
                      </span>
                    </Tooltip>
                  )}
                </h3>
                {/* Il Marchio (tag CONCESSO a runtime, es. Spoglie della Vittoria) è distinto dal
                    nastro archetipo sopra: quel nastro mostra solo IL PRIMO tag, quindi un mago con
                    un archetipo nativo che riceve un Marchio diverso non lo vedrebbe da nessuna
                    parte senza questa pill dedicata. */}
                <div className="mt-1"><MarchioMarks drafted={drafted} /></div>
                {drafted.corrotto && (
                  <span
                    data-testid="corrotto-badge"
                    title="Corrotto — non curabile"
                    className="mt-1 inline-flex items-center gap-0.5 rounded-full border border-purple-400/60 bg-purple-950/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-purple-200"
                  >
                    <span aria-hidden>☠</span> Corrotto — non curabile
                  </span>
                )}
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
                {drafted.shiny && shinyTrait && (
                  <Tooltip
                    label="Cimelio raro"
                    content={`${shinyTrait.name} — ${shinyTrait.desc}`}
                    triggerClassName="ml-1 inline-flex align-middle"
                  >
                    <span
                      data-testid="shiny-foil"
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                      style={{
                        color: '#3a2a08',
                        background: 'linear-gradient(135deg, #ffe9a8, #d9a94a)',
                        boxShadow: '0 0 6px rgba(255,205,90,0.7), inset 0 1px 0 rgba(255,255,255,0.6)',
                      }}
                      aria-hidden
                    >
                      ✦
                    </span>
                  </Tooltip>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {drafted.level !== undefined && (
                  <span
                    data-testid="card-level-badge"
                    className="rounded border border-[#C9A24B]/45 bg-[#C9A24B]/25 px-1 text-[8px] font-extrabold tabular-nums text-[#F4DE9A]"
                  >
                    Lv. {drafted.level}
                  </span>
                )}
                <span className="text-[7px] font-extrabold uppercase tracking-[.14em]" style={{ color: accent }}>
                  {wizard.role}
                </span>
              </span>
            </div>
            {/* Magia e archetipo anche in riga: è l'anteprima con cui il giocatore
                decide se entrare in un nodo battaglia, e sapere solo nome e vita di
                un nemico non basta — serve cosa LANCIA e a che archetipo appartiene.
                Una riga sola, il valore prima del nome come sulla carta piena. */}
            <div className="flex items-baseline gap-1.5 text-[9px] leading-none">
              <span className="shrink-0 font-black tabular-nums" style={{ color: spellAccent }}>
                {head.value}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-[10px] font-bold text-white/85">
                {spell.name}
              </span>
              {archetype && (
                <span
                  data-testid="row-archetype"
                  title={archetypeTag ? archetypeTooltip(archetypeTag) : undefined}
                  className="shrink-0 rounded border border-white/20 bg-white/5 px-1 py-px text-[7px] font-extrabold uppercase tracking-[.08em] text-[#dbe9ff]"
                >
                  {archetype.glyph} {archetype.name}
                </span>
              )}
            </div>
            <MarchioMarks drafted={drafted} />
            {drafted.corrotto && (
              <span
                data-testid="corrotto-badge"
                title="Corrotto — non curabile"
                className="inline-flex w-fit items-center gap-0.5 rounded-full border border-purple-400/60 bg-purple-950/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-purple-200"
              >
                <span aria-hidden>☠</span> Corrotto — non curabile
              </span>
            )}
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
