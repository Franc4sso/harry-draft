'use client'
import type { DraftedWizard } from '@/types'
import { ARCHETYPE_BY_TAG, archetypeTooltip } from '@/lib/archetypes'
import { Tooltip } from '@/components/ui/Tooltip'

/**
 * I MARCHI di un mago: i tag CONCESSI a runtime (`grantedTags` — le Spoglie della Vittoria),
 * distinti dai tag nativi.
 *
 * Perché una pill a parte e non solo il nastro archetipo: il nastro mostra UN archetipo, il
 * PRIMO (vedi `primaryArchetype` in WizardCardColumn). Un mago che ha già un archetipo nativo
 * e riceve un Marchio diverso non lo vedrebbe da nessuna parte — e il giocatore che ha appena
 * speso la sua scelta di vittoria non ritroverebbe il segnale sulla card. Questa pill lo rende
 * sempre visibile, e dice anche che è stato GUADAGNATO, non nativo.
 *
 * Statica (nessuna animazione): indifferente a prefers-reduced-motion.
 */
export function MarchioMarks({ drafted, className }: { drafted: DraftedWizard; className?: string }) {
  const granted = (drafted.grantedTags ?? []).filter(
    (t): t is keyof typeof ARCHETYPE_BY_TAG => t in ARCHETYPE_BY_TAG,
  )
  if (granted.length === 0) return null
  return (
    <div data-testid="marchio-marks" className={`flex flex-wrap items-center gap-1 ${className ?? ''}`}>
      {granted.map(tag => {
        const meta = ARCHETYPE_BY_TAG[tag]
        return (
          <Tooltip
            key={tag}
            label={`Marchio ${meta.name}`}
            content={`Segnale guadagnato dopo una vittoria. ${archetypeTooltip(tag)}`}
          >
            <span
              data-testid="marchio-badge"
              data-tag={tag}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: meta.color, borderColor: `${meta.color}80`, background: `${meta.color}1f` }}
            >
              <span aria-hidden>✦</span> Marchio {meta.name}
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}
