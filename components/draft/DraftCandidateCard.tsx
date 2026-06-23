'use client'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { wizardAffiliations } from '@/lib/affiliations'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  const affs = wizardAffiliations(drafted.wizard)
  return (
    <div
      className="relative w-60"
      onPointerEnter={onConsider}
      onFocus={onConsider}
      tabIndex={0}
    >
      <WizardCard drafted={drafted} onClick={onPick} />
      {affs.length > 0 && (
        // Anchored ON the portrait (top-left) so the synergy tags read as part of
        // the character, not a detached strip floating below the card.
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[62%] flex-col items-start gap-1">
          {affs.map((a) => {
            const hot = hotSynergyIds?.has(a.synergyId) ?? false
            return (
              <span
                key={a.synergyId}
                data-synergy={a.synergyId}
                data-hot={hot ? '' : undefined}
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.6)] backdrop-blur-sm"
                style={
                  hot
                    ? { color: '#f3e6c4', borderColor: '#b08d57', background: 'rgba(120,90,40,0.78)', boxShadow: '0 0 8px rgba(176,141,87,0.5)' }
                    : { color: '#ead9b0', borderColor: 'rgba(168,140,90,0.6)', background: 'rgba(20,16,34,0.72)' }
                }
              >
                {a.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
