'use client'
import type { Wizard } from '@/types'
import { wizardDuoSignals, duosForSignal } from '@/game/engine/duos'
import { SIGNAL_LABEL, SIGNAL_ICON, SIGNAL_COLOR } from '@/data/duos'
import { Tooltip } from '@/components/ui/Tooltip'

/** Light per-signal marks on a wizard card: shows the Duo signals this wizard feeds (honest —
 *  only signals used by a shipped Duo). Each mark's tooltip names the Duos it feeds. */
export function DuoSignalMarks({ wizard, compact = false }: { wizard: Wizard; compact?: boolean }) {
  const signals = wizardDuoSignals(wizard)
  if (signals.length === 0) return null
  return (
    <div data-testid="duo-signal-marks" className="flex flex-wrap items-center gap-1">
      {signals.map((s) => {
        const color = SIGNAL_COLOR[s]
        const fed = duosForSignal(s).map((d) => d.name).join(' · ')
        return (
          <Tooltip key={s} content={`${SIGNAL_LABEL[s]} → alimenta: ${fed}`}>
            <span
              data-signal={s}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color, borderColor: `${color}66`, background: `${color}1a` }}
            >
              <span aria-hidden>{SIGNAL_ICON[s]}</span>
              {!compact && <span>{SIGNAL_LABEL[s]}</span>}
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}
