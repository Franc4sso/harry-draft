import type { Spell } from '@/types'
import { SPELL_TYPE_META } from '@/lib/glossary'
import { spellHeadline, spellVerb, spellAccuracy, spellCadence } from '@/lib/spellText'

/**
 * La riga della magia. Il valore che il giocatore confronta esce dalla frase e
 * prende una COLONNA FISSA a sinistra, numero grande con l'unità sotto — la
 * stessa forma della fascia delle statistiche in fondo alla carta.
 *
 * Perché: con `nome · valore · verbo` su una riga sola, i nomi da 6 a 18 caratteri
 * mandavano la riga a capo in un punto diverso per ogni magia, e il valore finiva
 * ogni volta altrove. In colonna resta allineato fra carte affiancate.
 */
export function SpellLine({ spell, compact }: { spell: Spell; compact?: boolean }) {
  const head = spellHeadline(spell)
  const verb = spellVerb(spell)
  const acc = spellAccuracy(spell)
  const cad = spellCadence(spell)
  const accent = SPELL_TYPE_META[spell.type].color
  // Sotto il 70% la precisione è un rischio, non un dettaglio: si tinge di rosso
  // così «rischiosa» si legge prima del numero.
  const risky = acc.pct < 70

  return (
    <div className="relative flex items-start gap-2.5 px-3 pb-2.5 pt-3">
      <span
        aria-hidden
        className="absolute inset-x-3 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.14) 22%, rgba(255,255,255,.14) 78%, transparent)' }}
      />
      <span data-testid="spell-headline" className="min-w-[46px] shrink-0 text-center">
        <span className="block text-[17px] font-black tabular-nums leading-none" style={{ color: accent }}>
          {head.value}
        </span>
        {head.unit && (
          <span className="mt-1 block text-[7.5px] font-bold uppercase tracking-[.11em] text-white/35">
            {head.unit}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block break-words font-display text-[13px] font-extrabold leading-tight text-white">
          {spell.name}
        </span>
        {!compact && verb && (
          <span data-testid="spell-verb" className="mt-1 block text-[10px] leading-snug text-white/60">
            {verb}
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-1.5 text-[9px] font-bold tabular-nums text-white/35">
          <span className={risky ? 'text-[#ffb4b4]' : 'text-white/80'}>{acc.label}</span>
          <span className="h-[2.5px] min-w-[18px] flex-1 overflow-hidden rounded-sm bg-white/10">
            <i
              data-testid="spell-accuracy-bar"
              className="block h-full rounded-sm"
              style={{ width: `${acc.pct}%`, background: risky ? '#f07272' : accent }}
            />
          </span>
          <span data-testid="spell-cadence" className="flex items-center gap-[2.5px]" title={cad.label}>
            {Array.from({ length: cad.turns }, (_, i) => (
              <s
                key={i}
                aria-hidden
                className="h-[3.5px] w-[3.5px] rounded-full no-underline"
                style={{ background: i === 0 ? accent : 'currentColor', opacity: i === 0 ? 1 : .3 }}
              />
            ))}
            <span className="sr-only">{cad.label}</span>
          </span>
        </span>
      </span>
    </div>
  )
}
