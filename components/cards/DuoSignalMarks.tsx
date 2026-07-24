'use client'
import type { Wizard, DuoSignal } from '@/types'
import { wizardDuoSignals } from '@/game/engine/duos'
import { SIGNAL_LABEL, SIGNAL_ICON, SIGNAL_COLOR, SIGNAL_BLURB } from '@/data/duos'
import { ARCHETYPE_BY_TAG } from '@/lib/archetypes'
import { Tooltip } from '@/components/ui/Tooltip'

// The 4 tag-signals (veleno/esecuzione/scudirigen/magieOscure) are exactly the archetype tags
// the card's ribbon already shows (glyph + fantasy name). Cards that render a ribbon pass
// `excludeArchetypeSignals` so this list doesn't repeat what the ribbon already said.
const ARCHETYPE_SIGNAL_IDS = new Set<string>(Object.keys(ARCHETYPE_BY_TAG))

/** Card label for a signal. Role-named signals (taunt='Tank'…) would just echo the card's
 *  own RoleBadge/crown, so on the card we name what the signal FEEDS instead of the role:
 *  taunt reads "Bersaglio" (draws enemy fire), not "Tank". Tag signals keep their own name. */
const CARD_SIGNAL_LABEL: Partial<Record<DuoSignal, string>> = {
  taunt: 'Bersaglio',
}
function cardLabel(s: DuoSignal): string {
  return CARD_SIGNAL_LABEL[s] ?? SIGNAL_LABEL[s]
}

/** Per-signal marks on a wizard card: the Duo signals this wizard feeds (honest — only signals
 *  used by a shipped Duo). `compact` shows icon-only; otherwise the signal is named so a player
 *  reads WHY the wizard matters for Combos. `excludeArchetypeSignals` drops the 4 tag-signals
 *  (veleno/esecuzione/scudirigen/magieOscure) that a sibling archetype ribbon already shows,
 *  leaving only role-signals like taunt ("Bersaglio"). */
export function DuoSignalMarks({ wizard, compact = false, excludeArchetypeSignals = false }: {
  wizard: Wizard
  compact?: boolean
  excludeArchetypeSignals?: boolean
}) {
  const allSignals = wizardDuoSignals(wizard)
  const signals = excludeArchetypeSignals
    ? allSignals.filter((s) => !ARCHETYPE_SIGNAL_IDS.has(s))
    : allSignals
  if (signals.length === 0) return null
  return (
    <div data-testid="duo-signal-marks" className="flex flex-wrap items-center gap-1.5">
      {signals.map((s) => {
        const color = SIGNAL_COLOR[s]
        return (
          <Tooltip key={s} label={cardLabel(s)} content={SIGNAL_BLURB[s]}>
            <span
              data-signal={s}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{ color, borderColor: `${color}80`, background: `${color}22` }}
            >
              <span aria-hidden>{SIGNAL_ICON[s]}</span>
              {!compact && <span>{cardLabel(s)}</span>}
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}
